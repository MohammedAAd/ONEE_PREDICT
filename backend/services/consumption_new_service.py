from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class ConsumptionNewService:
    """Service pour la consommation par type - Version fact_long"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_consommation_by_type(
        self,
        centre_id: Optional[str] = None,
        region: str = "all",
        start_year: int = 2020,
        end_year: int = 2030,
        zones: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Récupère la consommation par type (Administrative, Industrielle, Autres, Bornes Fontaines)
        """
        
        years = list(range(start_year, end_year + 1))
        
        query = text("""
            SELECT 
                fl.annee,
                fl.type_consommation,
                SUM(fl.consommation) as consommation
            FROM fact_long fl
            WHERE fl.annee BETWEEN :start_year AND :end_year
            GROUP BY fl.annee, fl.type_consommation
            ORDER BY fl.annee, fl.type_consommation
        """)
        
        params = {"start_year": start_year, "end_year": end_year}
        
        if centre_id:
            query = text("""
                SELECT 
                    fl.annee,
                    fl.type_consommation,
                    SUM(fl.consommation) as consommation
                FROM fact_long fl
                WHERE fl.id_centre_desservi = :centre_id
                AND fl.annee BETWEEN :start_year AND :end_year
                GROUP BY fl.annee, fl.type_consommation
                ORDER BY fl.annee, fl.type_consommation
            """)
            params["centre_id"] = centre_id
        
        if (region is not None and region != "all" or zones) and not centre_id:
            zone_clause = " AND mp.lib_centre_uniformise = ANY(:zones)" if zones else ""
            query = text(f"""
                SELECT 
                    fl.annee,
                    fl.type_consommation,
                    SUM(fl.consommation) as consommation
                FROM fact_long fl
                JOIN master_panel mp ON fl.id_centre_desservi = mp.id_centre_desservi
                    AND fl.annee = mp.annee
                WHERE 1=1
                {"AND mp.code_region_12 = :region" if region is not None and region != "all" else ""}
                {zone_clause}
                AND fl.annee BETWEEN :start_year AND :end_year
                GROUP BY fl.annee, fl.type_consommation
                ORDER BY fl.annee, fl.type_consommation
            """)
            if region is not None and region != "all":
                params["region"] = region
            if zones:
                params["zones"] = [str(zone).strip() for zone in zones if str(zone).strip()]
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        # Afficher toutes les catégories réellement présentes dans fact_long.
        # L'ancienne liste fixe excluait notamment « Population branchée ».
        preferred_order = [
            "Population branchée",
            "Bornes Fontaines",
            "Administrative",
            "Industrielle",
            "Autres",
        ]
        available_types = {
            str(row.type_consommation).strip()
            for row in rows
            if row.type_consommation is not None and str(row.type_consommation).strip()
        }
        types = [item for item in preferred_order if item in available_types]
        types.extend(sorted(available_types - set(types)))
        
        # Initialiser les données par type
        data_by_type = {t: {y: 0 for y in years} for t in types}
        
        for row in rows:
            if row.type_consommation in data_by_type:
                data_by_type[row.type_consommation][row.annee] = float(row.consommation or 0) / 1_000_000
        
        # Formater pour les charts
        datasets = []
        color_keys = ["blue", "teal", "amber", "purple", "green", "red"]
        
        for index, t in enumerate(types):
            datasets.append({
                "label": t,
                "data": [data_by_type[t][y] for y in years],
                "colorKey": color_keys[index % len(color_keys)]
            })
        
        return {
            "labels": [str(y) for y in years],
            "datasets": datasets
        }
    
    async def get_consommation_totale_by_type(
        self,
        year: int = 2024,
        region: str = "all"
    ) -> Dict[str, float]:
        """
        Récupère la consommation totale par type pour une année donnée
        """
        
        query = text("""
            SELECT 
                fl.type_consommation,
                SUM(fl.consommation) as consommation
            FROM fact_long fl
            WHERE fl.annee = :year
            GROUP BY fl.type_consommation
        """)
        
        params = {"year": year}
        
        if region is not None and region != "all":
            query = text("""
                SELECT 
                    fl.type_consommation,
                    SUM(fl.consommation) as consommation
                FROM fact_long fl
                JOIN master_panel mp ON fl.id_centre_desservi = mp.id_centre_desservi
                    AND fl.annee = mp.annee
                WHERE mp.code_region_12 = :region
                AND fl.annee = :year
                GROUP BY fl.type_consommation
            """)
            params["region"] = region
        
        result = await self.db.execute(query, params)
        
        total_by_type = {}
        for row in result:
            total_by_type[row.type_consommation] = float(row.consommation or 0) / 1_000_000
        
        return total_by_type
    
    async def get_consommation_by_centre(
        self,
        centre_id: str,
        start_year: int = 2020,
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """
        Récupère la consommation par type pour un centre spécifique
        """
        return await self.get_consommation_by_type(centre_id, "all", start_year, end_year)
    
    async def get_evolution_by_type(
        self,
        type_consommation: str,
        region: str = "all",
        start_year: int = 2000,
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """
        Récupère l'évolution d'un type de consommation spécifique
        """
        
        data = await self.get_consommation_by_type(None, region, start_year, end_year)
        
        for dataset in data.get("datasets", []):
            if dataset.get("label") == type_consommation:
                return {
                    "type": type_consommation,
                    "labels": data.get("labels", []),
                    "values": dataset.get("data", [])
                }
        
        return {"type": type_consommation, "labels": [], "values": []}
