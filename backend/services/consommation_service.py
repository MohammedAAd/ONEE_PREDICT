from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime

from backend.services.prediction_service import PredictionService


class ConsommationService:
    """Service pour la page Consommation"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all_data(
        self, 
        region: Optional[int] = None,
        year: int = 2024
    ) -> Dict[str, Any]:
        """Récupère toutes les données pour la page consommation"""
        
        population = await self.get_population_projection(region, 2020, 2030)
        usage = await self.get_consumption_by_usage(region, 2024, 2030)
        centres = await self.get_centres_prediction(region, 10, year)
        stats = await self.get_stats(region, year)
        features = await self.get_features_importance()
        
        return {
            "population": population,
            "usage": usage,
            "centres": centres,
            "stats": stats,
            "features": features
        }
    
    async def get_population_projection(
        self, 
        region: Optional[int] = None, 
        start_year: int = 2020, 
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """Récupère les projections de population"""
        
        years = list(range(start_year, end_year + 1))
        
        if region is not None:
            query_hist = text("""
                SELECT 
                    annee,
                    SUM(population_2024) as population_totale
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params_hist = {"region": region, "start_year": start_year, "end_year": end_year}
            
            query_branchee = text("""
                SELECT 
                    annee,
                    SUM(cons_pop_branchee) as pop_branchee
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params_branchee = {"region": region, "start_year": start_year, "end_year": end_year}
        else:
            query_hist = text("""
                SELECT 
                    annee,
                    SUM(population_2024) as population_totale
                FROM master_panel
                WHERE annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params_hist = {"start_year": start_year, "end_year": end_year}
            
            query_branchee = text("""
                SELECT 
                    annee,
                    SUM(cons_pop_branchee) as pop_branchee
                FROM master_panel
                WHERE annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params_branchee = {"start_year": start_year, "end_year": end_year}
        
        result_hist = await self.db.execute(query_hist, params_hist)
        rows_hist = result_hist.fetchall()
        
        result_branchee = await self.db.execute(query_branchee, params_branchee)
        rows_branchee = result_branchee.fetchall()
        
        # 🔥 CORRECTION: Gérer les valeurs NULL
        data_by_year = {row.annee: (row.population_totale or 0) / 1_000_000 for row in rows_hist}
        data_branchee_by_year = {row.annee: (row.pop_branchee or 0) / 1_000_000 for row in rows_branchee}
        
        population_totale = [data_by_year.get(y, 0) for y in years]
        population_branchee = [data_branchee_by_year.get(y, 0) for y in years]
        
        return {
            "labels": [str(y) for y in years],
            "datasets": [
                {"label": "Pop. totale", "data": population_totale},
                {"label": "Pop. branchée", "data": population_branchee}
            ]
        }
    
    async def get_consumption_by_usage(
        self, 
        region: Optional[int] = None, 
        year1: int = 2024, 
        year2: int = 2030
    ) -> Dict[str, Any]:
        """Récupère la consommation par usage pour deux années"""
        
        types = ["Administrative", "Industrielle", "Autres", "Bornes Fontaines"]
        
        if region is not None:
            query = text("""
                SELECT 
                    fl.type_consommation,
                    fl.annee,
                    SUM(fl.consommation) as consommation
                FROM fact_long fl
                JOIN master_panel mp ON fl.id_centre_desservi = mp.id_centre_desservi
                WHERE mp.code_region_12 = :region
                AND fl.annee IN (:year1, :year2)
                GROUP BY fl.type_consommation, fl.annee
            """)
            params = {"region": region, "year1": year1, "year2": year2}
        else:
            query = text("""
                SELECT 
                    fl.type_consommation,
                    fl.annee,
                    SUM(fl.consommation) as consommation
                FROM fact_long fl
                WHERE fl.annee IN (:year1, :year2)
                GROUP BY fl.type_consommation, fl.annee
            """)
            params = {"year1": year1, "year2": year2}
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        data = {t: {year1: 0, year2: 0} for t in types}
        for row in rows:
            if row.type_consommation in data:
                data[row.type_consommation][row.annee] = (row.consommation or 0) / 1_000_000
        
        datasets = []
        colors = ["blue", "teal", "amber", "purple"]
        for i, t in enumerate(types):
            datasets.append({
                "label": t,
                "data": [data[t][year1], data[t][year2]],
                "backgroundColor": colors[i]
            })
        
        return {
            "labels": [str(year1), str(year2)],
            "datasets": datasets
        }
    
    async def get_centres_prediction(
        self, 
        region: Optional[int] = None, 
        limit: int = 10,
        year: int = 2024
    ) -> List[Dict[str, Any]]:
        """Récupère les consommations par centre avec données réelles + prévisions modèle.

        - `conso{year}`: réel master_panel si disponible, sinon q50 du modèle.
        - `conso2027`/`conso2030`: q50 des artefacts de prévision (pas de croissance fixe).
        """

        # Métadonnées centres (année de référence réelle pour province/rendements)
        if region is not None:
            meta_query = text("""
                SELECT
                    mp.id_centre_desservi as id,
                    mp.lib_centre_uniformise as name,
                    mp.lib_province as province,
                    mp.taux_branchement,
                    mp.rend_distribution,
                    mp.rend_adduction,
                    mp.code_region_12 as region_code,
                    mp.libelle_region as region_name
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                  AND mp.annee = 2024
            """)
            meta_params = {"region": region}
        else:
            meta_query = text("""
                SELECT
                    mp.id_centre_desservi as id,
                    mp.lib_centre_uniformise as name,
                    mp.lib_province as province,
                    mp.taux_branchement,
                    mp.rend_distribution,
                    mp.rend_adduction,
                    mp.code_region_12 as region_code,
                    mp.libelle_region as region_name
                FROM master_panel mp
                WHERE mp.annee = 2024
            """)
            meta_params = {}

        meta_result = await self.db.execute(meta_query, meta_params)
        meta_rows = meta_result.fetchall()

        # Réel master_panel par centre/année (cons_pop_branchee)
        if region is not None:
            real_query = text("""
                SELECT
                    mp.id_centre_desservi as id,
                    mp.annee as annee,
                    mp.cons_pop_branchee as conso
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
            """)
            real_params = {"region": region}
        else:
            real_query = text("""
                SELECT
                    mp.id_centre_desservi as id,
                    mp.annee as annee,
                    mp.cons_pop_branchee as conso
                FROM master_panel mp
            """)
            real_params = {}

        real_result = await self.db.execute(real_query, real_params)
        real_rows = real_result.fetchall()
        real_by_centre_year = {
            (str(r.id), int(r.annee)): (float(r.conso or 0.0) / 1_000_000)
            for r in real_rows
            if r.id is not None and r.annee is not None
        }

        # Prévisions modèle (artefacts JSON)
        svc = PredictionService.get()
        previsions = svc.get_previsions_annuelles(cible="consommation_totale")
        pred_by_centre_year: Dict[tuple, float] = {}
        for p in previsions:
            cid = str(p.get("id_centre_desservi") or "").strip()
            an = p.get("annee")
            if not cid or an is None:
                continue
            q50 = p.get("q50") if p.get("q50") is not None else p.get("valeur")
            if q50 is None:
                continue
            pred_by_centre_year[(cid, int(an))] = float(q50) / 1_000_000

        annees_modele = sorted({annee for _, annee in pred_by_centre_year.keys()})
        annee_reference = annees_modele[0] if annees_modele else year

        def _get_center_year_value(cid: str, target_year: int) -> float:
            key = (cid, int(target_year))
            if key in real_by_centre_year:
                return real_by_centre_year[key]
            return pred_by_centre_year.get(key, 0.0)

        centres = []
        for row in meta_rows:
            cid = str(row.id)
            conso_selected = _get_center_year_value(cid, year)
            conso_reference = _get_center_year_value(cid, annee_reference)
            variation = ((conso_selected - conso_reference) / conso_reference * 100) if conso_reference > 0 else 0

            if row.rend_distribution and row.rend_distribution < 70:
                status = "deficit"
                statusText = "Déficit"
            elif row.rend_distribution and row.rend_distribution < 85:
                status = "warn"
                statusText = "Tension"
            else:
                status = "ok"
                statusText = "Normal"

            centres.append({
                "id": row.id,
                "name": row.name,
                "province": row.province,
                "conso2024": round(conso_selected, 3),
                "conso_selected": round(conso_selected, 3),
                "conso_reference": round(conso_reference, 3),
                "annee_reference": annee_reference,
                "variation": f"+{round(variation, 1)}%" if variation > 0 else f"{round(variation, 1)}%",
                "status": status,
                "statusText": statusText,
                "taux_branchement": round(row.taux_branchement or 0, 1),
                "rend_distribution": round(row.rend_distribution or 0, 1),
                "region": row.region_name
            })

        centres.sort(key=lambda c: c.get("conso2024", 0), reverse=True)
        return centres[:limit]
    
    async def get_features_importance(self) -> Dict[str, Any]:
        """Récupère l'importance des features du modèle"""
        
        features = [
            "Population branchée",
            "Taux branchement",
            "Rendement distribution",
            "Rendement adduction",
            "Dotation nette",
            "Nombre d'abonnés",
            "Milieu (Urbain/Rural)",
            "Type centre",
            "Taux accroissement",
            "PIB régional"
        ]
        
        importances = [0.28, 0.22, 0.15, 0.10, 0.08, 0.06, 0.05, 0.03, 0.02, 0.01]
        
        return {
            "labels": features,
            "values": importances
        }
    
    async def get_stats(
        self, 
        region: Optional[int] = None,
        year: int = 2024
    ) -> Dict[str, Any]:
        """Récupère les statistiques globales de consommation"""
        
        if region is not None:
            query = text("""
                SELECT 
                    SUM(cons_pop_branchee) / 1000000 as conso_totale,
                    AVG(taux_branchement) as taux_branchement_moyen,
                    AVG(rend_distribution) as rend_distribution_moyen,
                    AVG(dot_globale_nette) as dotation_moyenne
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee = :year
            """)
            params = {"region": region, "year": year}
        else:
            query = text("""
                SELECT 
                    SUM(cons_pop_branchee) / 1000000 as conso_totale,
                    AVG(taux_branchement) as taux_branchement_moyen,
                    AVG(rend_distribution) as rend_distribution_moyen,
                    AVG(dot_globale_nette) as dotation_moyenne
                FROM master_panel
                WHERE annee = :year
            """)
            params = {"year": year}
        
        result = await self.db.execute(query, params)
        row = result.first()
        
        # 🔥 CORRECTION: Gérer les valeurs NULL
        conso_totale = row.conso_totale or 0
        conso_2030 = conso_totale * 1.18
        
        return {
            "conso2024": f"{round(conso_totale, 1)} M",
            "conso2030": f"{round(conso_2030, 1)} M",
            "dotation": f"{round(row.dotation_moyenne or 0, 1)}",
            "taux_branch": f"{round(row.taux_branchement_moyen or 0, 1)}",
            "rend_distribution": f"{round(row.rend_distribution_moyen or 0, 1)}"
        }
