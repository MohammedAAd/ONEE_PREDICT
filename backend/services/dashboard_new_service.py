from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime


class DashboardNewService:
    """Service pour les données du dashboard ONEE - Version master_panel"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_dashboard_data(
        self,
        region: str = "all",
        start_year: int = 2020,
        end_year: int = 2030,
        mode: str = "pred"
    ) -> Dict[str, Any]:
        """Récupère toutes les données pour le dashboard depuis master_panel"""
        
        timeseries = await self._get_timeseries(region, start_year, end_year, mode)
        timeseries_detail = await self._get_timeseries_detail(region, start_year, end_year, mode)
        stats = await self._get_statistics(region, end_year)
        bilan_zones = await self._get_bilan_by_zone(region, end_year)
        bilan_provinces = await self._get_bilan_by_province(region, end_year)
        bilan_regions = await self._get_bilan_by_region(end_year)
        rendements = await self._get_rendements(region)
        alerts = await self._get_alerts(region)
        vulnerability = await self._get_vulnerability(region)
        filters = await self._get_available_filters()
        
        return {
            "timeseries": timeseries,
            "timeseries_detail": timeseries_detail,
            "stats": stats,
            "bilan": bilan_zones,
            "bilan_provinces": bilan_provinces,
            "bilan_regions": bilan_regions,
            "rendements": rendements,
            "alerts": alerts,
            "vulnerability": vulnerability,
            "filters": filters
        }
    
    async def _get_timeseries(
        self,
        region: Optional[int],  # Changé: str → Optional[int]
        start_year: int,
        end_year: int,
        mode: str
    ) -> Dict[str, Any]:
        """Récupère la série temporelle consommation vs production"""
        
        years = list(range(start_year, end_year + 1))
        
        if region is not None and region != "all":
            # region est un entier
            query = text("""
                SELECT 
                    mp.annee,
                    SUM(mp.production) as production,
                    SUM(mp.distribution) as distribution,
                    SUM(mp.cons_pop_branchee) as consommation
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                AND mp.annee BETWEEN :start_year AND :end_year
                GROUP BY mp.annee
                ORDER BY mp.annee
            """)
            params = {"region": region, "start_year": start_year, "end_year": end_year}
        else:
            query = text("""
                SELECT 
                    mp.annee,
                    SUM(mp.production) as production,
                    SUM(mp.distribution) as distribution,
                    SUM(mp.cons_pop_branchee) as consommation
                FROM master_panel mp
                WHERE mp.annee BETWEEN :start_year AND :end_year
                GROUP BY mp.annee
                ORDER BY mp.annee
            """)
            params = {"start_year": start_year, "end_year": end_year}
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        data_by_year = {row.annee: {
            "prod": float(row.production or 0) / 1_000_000,
            "conso": float(row.consommation or 0) / 1_000_000,
            "dist": float(row.distribution or 0) / 1_000_000
        } for row in rows}
        
        prod_data = []
        conso_data = []
        dist_data = []
        
        for year in years:
            prod_data.append(data_by_year.get(year, {}).get("prod", None))
            conso_data.append(data_by_year.get(year, {}).get("conso", None))
            dist_data.append(data_by_year.get(year, {}).get("dist", None))
        
        if mode == "pred":
            prod_data, conso_data = self._add_predictions(prod_data, conso_data, years)
        
        return {
            "labels": [str(y) for y in years],
            "prod": prod_data,
            "conso": conso_data,
            "distribution": dist_data,
            "mode": mode,
            "real_end_year": end_year if mode == "real" else 2024
        }
    
    async def _get_timeseries_detail(
        self,
        region: str,
        start_year: int,
        end_year: int,
        mode: str
    ) -> Dict[str, Any]:
        """Récupère la série détaillée depuis master_panel"""
        
        years = list(range(start_year, end_year + 1))
        
        query = text("""
            SELECT 
                mp.annee,
                SUM(mp.production) / 1000000 as production,
                SUM(mp.distribution) / 1000000 as distribution,
                SUM(mp.cons_pop_branchee) / 1000000 as consommation
            FROM master_panel mp
            WHERE mp.annee BETWEEN :start_year AND :end_year
            GROUP BY mp.annee
            ORDER BY mp.annee
        """)
        
        params = {"start_year": start_year, "end_year": end_year}
        
        if region != "all":
            query = text("""
                SELECT 
                    mp.annee,
                    SUM(mp.production) / 1000000 as production,
                    SUM(mp.distribution) / 1000000 as distribution,
                    SUM(mp.cons_pop_branchee) / 1000000 as consommation
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                AND mp.annee BETWEEN :start_year AND :end_year
                GROUP BY mp.annee
                ORDER BY mp.annee
            """)
            params["region"] = region
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        data_by_year = {row.annee: {
            "production": float(row.production or 0),
            "distribution": float(row.distribution or 0),
            "consommation": float(row.consommation or 0)
        } for row in rows}
        
        production = []
        distribution = []
        consommation = []
        
        for year in years:
            production.append(data_by_year.get(year, {}).get("production", 0))
            distribution.append(data_by_year.get(year, {}).get("distribution", 0))
            consommation.append(data_by_year.get(year, {}).get("consommation", 0))
        
        if mode == "pred":
            production = self._add_forecast(production)
            distribution = self._add_forecast(distribution)
            consommation = self._add_forecast(consommation)
        
        return {
            "labels": [str(y) for y in years],
            "production": production,
            "distribution": distribution,
            "consommation": consommation
        }
    
    async def _get_statistics(self, region: str, target_year: int) -> Dict[str, Any]:
        """Récupère les statistiques globales depuis master_panel"""
        
        params = {"year": target_year}
        
        if region != "all":
            query = text("""
                SELECT 
                    COUNT(DISTINCT mp.id_centre_desservi) as nb_centres,
                    SUM(mp.population_2024) as population_totale,
                    SUM(mp.cons_pop_branchee) as consommation_totale
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                AND mp.annee = :year
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    COUNT(DISTINCT mp.id_centre_desservi) as nb_centres,
                    SUM(mp.population_2024) as population_totale,
                    SUM(mp.cons_pop_branchee) as consommation_totale
                FROM master_panel mp
                WHERE mp.annee = :year
            """)
        
        result = await self.db.execute(query, params)
        row = result.first()
        
        # Centres en déficit
        deficit_params = {"year": target_year}
        deficit_query = text("""
            SELECT COUNT(DISTINCT id_centre_desservi) as deficit_count
            FROM master_panel
            WHERE annee = :year
            AND production < cons_pop_branchee
        """)
        
        if region != "all":
            deficit_query = text("""
                SELECT COUNT(DISTINCT id_centre_desservi) as deficit_count
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee = :year
                AND production < cons_pop_branchee
            """)
            deficit_params["region"] = region
        
        deficit_result = await self.db.execute(deficit_query, deficit_params)
        deficit_row = deficit_result.first()
        
        return {
            "centres": f"{row.nb_centres or 0:,}",
            "centresTrend": "+12",
            "pop": f"{(row.population_totale or 0) / 1_000_000:.1f}M",
            "popTrend": "+5.2%",
            "conso2030": f"{((row.consommation_totale or 0) / 1_000_000):.1f}",
            "consoTrend": "+8%",
            "deficit": str(deficit_row.deficit_count or 0),
            "deficitTrend": "-3"
        }
    
    async def _get_bilan_by_zone(self, region: str, year: int) -> Dict[str, List]:
        """Récupère le bilan (solde) par zone depuis master_panel"""
        
        params = {"year": year}
        
        if region != "all":
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as zone,
                    SUM(mp.production) - SUM(mp.cons_pop_branchee) as solde
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                GROUP BY mp.lib_centre_uniformise
                ORDER BY solde DESC
                LIMIT 30
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as zone,
                    SUM(mp.production) - SUM(mp.cons_pop_branchee) as solde
                FROM master_panel mp
                WHERE mp.annee = :year
                GROUP BY mp.lib_centre_uniformise
                ORDER BY solde DESC
                LIMIT 30
            """)
        
        result = await self.db.execute(query, params)
        
        zones = []
        soldes = []
        for row in result:
            zones.append(row.zone)
            soldes.append(float(row.solde or 0))
        
        return {"labels": zones, "values": soldes}
    
    async def _get_bilan_by_province(self, region: str, year: int) -> Dict[str, List]:
        """Récupère le bilan par province depuis master_panel"""
        
        params = {"year": year}
        
        if region != "all":
            query = text("""
                SELECT 
                    mp.lib_province as province,
                    SUM(mp.production) - SUM(mp.cons_pop_branchee) as solde
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                GROUP BY mp.lib_province
                ORDER BY solde DESC
                LIMIT 20
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    mp.lib_province as province,
                    SUM(mp.production) - SUM(mp.cons_pop_branchee) as solde
                FROM master_panel mp
                WHERE mp.annee = :year
                GROUP BY mp.lib_province
                ORDER BY solde DESC
                LIMIT 20
            """)
        
        result = await self.db.execute(query, params)
        
        provinces = []
        soldes = []
        for row in result:
            provinces.append(row.province)
            soldes.append(float(row.solde or 0))
        
        return {"labels": provinces, "values": soldes}
    
    async def _get_bilan_by_region(self, year: int) -> Dict[str, List]:
        """Récupère le bilan par région depuis master_panel"""
        
        query = text("""
            SELECT 
                mp.libelle_region as region,
                SUM(mp.production) - SUM(mp.cons_pop_branchee) as solde
            FROM master_panel mp
            GROUP BY mp.libelle_region
            ORDER BY solde DESC
        """)
        
        result = await self.db.execute(query, {"year": year})
        
        regions = []
        soldes = []
        for row in result:
            regions.append(row.region)
            soldes.append(float(row.solde or 0))
        
        return {"labels": regions, "values": soldes}
    
    async def _get_rendements(self, region: str) -> Dict[str, Any]:
        """Récupère les rendements depuis master_panel"""
        
        params = {}
        
        if region != "all":
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as zone,
                    AVG(mp.taux_branchement) as taux_branchement,
                    AVG(mp.rend_distribution) as rend_distribution,
                    AVG(mp.rend_adduction) as rend_adduction
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                AND mp.annee = 2024
                GROUP BY mp.lib_centre_uniformise
                ORDER BY rend_distribution DESC, rend_adduction DESC, taux_branchement DESC
                LIMIT 15
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as zone,
                    AVG(mp.taux_branchement) as taux_branchement,
                    AVG(mp.rend_distribution) as rend_distribution,
                    AVG(mp.rend_adduction) as rend_adduction
                FROM master_panel mp
                WHERE mp.annee = 2024
                GROUP BY mp.lib_centre_uniformise
                ORDER BY rend_distribution DESC, rend_adduction DESC, taux_branchement DESC
                LIMIT 15
            """)
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        if not rows:
            return {"labels": [], "datasets": []}
        
        labels = [row.zone for row in rows]
        
        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "Rendement distribution",
                    "values": [float(row.rend_distribution or 0) for row in rows],
                    "colorKey": "blue"
                },
                {
                    "label": "Rendement adduction",
                    "values": [float(row.rend_adduction or 0) for row in rows],
                    "colorKey": "teal"
                },
                {
                    "label": "Taux branchement",
                    "values": [float(row.taux_branchement or 0) for row in rows],
                    "colorKey": "amber"
                }
            ]
        }
    
    async def _get_alerts(self, region: str) -> List[Dict[str, Any]]:
        """Récupère les alertes actives depuis master_panel"""
        
        alerts = []
        
        # Alerte centres en déficit
        deficit_params = {"year": 2024}
        deficit_query = text("""
            SELECT COUNT(DISTINCT id_centre_desservi) as deficit_count
            FROM master_panel
            WHERE annee = :year
            AND production < cons_pop_branchee
        """)
        
        if region != "all":
            deficit_query = text("""
                SELECT COUNT(DISTINCT id_centre_desservi) as deficit_count
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee = :year
                AND production < cons_pop_branchee
            """)
            deficit_params["region"] = region
        
        deficit_result = await self.db.execute(deficit_query, deficit_params)
        deficit_row = deficit_result.first()
        deficit_count = deficit_row.deficit_count or 0
        
        if deficit_count > 0:
            alerts.append({
                "icon": "AlertTriangle",
                "color": "var(--red)",
                "title": f"{deficit_count} centres en déficit hydrique",
                "subtitle": "La production est inférieure à la consommation",
                "meta": "Nécessite des investissements urgents"
            })
        
        # Alerte rendement faible
        rend_params = {"year": 2024}
        rend_query = text("""
            SELECT COUNT(DISTINCT id_centre_desservi) as low_rend_count
            FROM master_panel
            WHERE annee = :year
            AND rend_distribution < 70
        """)
        
        if region != "all":
            rend_query = text("""
                SELECT COUNT(DISTINCT id_centre_desservi) as low_rend_count
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee = :year
                AND rend_distribution < 70
            """)
            rend_params["region"] = region
        
        rend_result = await self.db.execute(rend_query, rend_params)
        rend_row = rend_result.first()
        low_rend_count = rend_row.low_rend_count or 0
        
        if low_rend_count > 0:
            alerts.append({
                "icon": "AlertCircle",
                "color": "var(--amber)",
                "title": "Rendement distribution faible",
                "subtitle": f"{low_rend_count} centres ont un rendement < 70%",
                "meta": "Pertes en réseau importantes"
            })
        
        alerts.append({
            "icon": "Info",
            "color": "var(--blue)",
            "title": "Plan d'investissement 2025-2030",
            "subtitle": "Objectif: Améliorer le rendement à 85%",
            "meta": "Budget: 2.5 MMDH"
        })
        
        return alerts
    
    async def _get_vulnerability(self, region: Optional[int]) -> Dict[str, Any]:
        """Récupère les indicateurs de vulnérabilité réseau depuis master_panel"""
        params = {"year": 2024}
        region_clause = ""
        if region is not None:
            region_clause = "AND mp.code_region_12 = :region"
            params["region"] = region

        query = text(f"""
            SELECT
                COUNT(DISTINCT mp.id_centre_desservi) as total_centres,
                SUM(CASE WHEN mp.production < mp.cons_pop_branchee THEN 1 ELSE 0 END) as deficit_centres,
                SUM(CASE WHEN mp.rend_distribution < 70 THEN 1 ELSE 0 END) as low_rend_centres,
                SUM(CASE WHEN mp.rend_distribution >= 70 AND mp.rend_distribution < 85 THEN 1 ELSE 0 END) as tension_centres,
                SUM(CASE WHEN mp.taux_branchement < 85 THEN 1 ELSE 0 END) as low_branching_centres,
                AVG(mp.rend_distribution) as avg_rend_distribution,
                AVG(mp.taux_branchement) as avg_taux_branchement,
                AVG(mp.capacite_exploitable_centre) as avg_capacite_exploitable,
                AVG(mp.capacite_equipee_centre) as avg_capacite_equipee,
                SUM(mp.population_2024) as population_totale
            FROM master_panel mp
            WHERE mp.annee = :year
            {region_clause}
        """)
        result = await self.db.execute(query, params)
        summary = result.first() or None

        top_zones_query = text(f"""
            SELECT 
                mp.lib_centre_uniformise as zone,
                SUM(mp.production) - SUM(mp.cons_pop_branchee) as solde,
                AVG(mp.rend_distribution) as rend_distribution,
                AVG(mp.taux_branchement) as taux_branchement,
                SUM(mp.population_2024) as population
            FROM master_panel mp
            WHERE mp.annee = :year
            {region_clause}
            GROUP BY mp.lib_centre_uniformise
            ORDER BY solde ASC
            LIMIT 8
        """)
        top_rows = await self.db.execute(top_zones_query, params)

        return {
            "summary": {
                "totalCentres": int(summary.total_centres or 0),
                "deficitCentres": int(summary.deficit_centres or 0),
                "lowRendCentres": int(summary.low_rend_centres or 0),
                "tensionCentres": int(summary.tension_centres or 0),
                "lowBranchingCentres": int(summary.low_branching_centres or 0),
                "avgRendDistribution": round(float(summary.avg_rend_distribution or 0), 1),
                "avgTauxBranchement": round(float(summary.avg_taux_branchement or 0), 1),
                "avgCapaciteExploitable": round(float(summary.avg_capacite_exploitable or 0), 1),
                "avgCapaciteEquipee": round(float(summary.avg_capacite_equipee or 0), 1),
                "populationTotale": int(summary.population_totale or 0)
            },
            "topRiskZones": [
                {
                    "zone": row.zone,
                    "solde": round(float(row.solde or 0), 1),
                    "rendDistribution": round(float(row.rend_distribution or 0), 1),
                    "tauxBranchement": round(float(row.taux_branchement or 0), 1),
                    "population": int(row.population or 0)
                }
                for row in top_rows
            ]
        }
    
    async def _get_centres(self, region: Optional[int]) -> Dict[str, Any]:
        """Récupère la liste des centres et installations réelles depuis master_panel."""
        params = {"year": 2024}
        region_clause = ""
        if region is not None:
            region_clause = "AND mp.code_region_12 = :region"
            params["region"] = region

        query = text(f"""
            SELECT
                mp.id_centre_desservi as id,
                mp.lib_centre_uniformise as name,
                mp.lib_commune as commune,
                mp.lib_province as province,
                mp.libelle_region as region_name,
                mp.code_region_12 as region_code,
                mp.type_centre as type_centre,
                mp.sa_centre as sa_centre,
                mp.population_2024 as population,
                mp.menages_2024 as menages,
                mp.production as production,
                mp.cons_pop_branchee as consommation,
                mp.rend_distribution as rend_distribution,
                mp.mappable as mappable
            FROM master_panel mp
            WHERE mp.annee = :year
            {region_clause}
            ORDER BY mp.libelle_region, mp.lib_province, mp.lib_centre_uniformise
        """)

        result = await self.db.execute(query, params)
        rows = result.fetchall()

        centres = []
        for row in rows:
            production = float(row.production or 0)
            consommation = float(row.consommation or 0)
            rend_distribution = float(row.rend_distribution or 0)

            if production < consommation:
                status = 'deficit'
            elif rend_distribution < 70:
                status = 'warn'
            else:
                status = 'ok'

            centres.append({
                "id": str(row.id) if row.id else None,
                "name": str(row.name) if row.name else None,
                "commune": str(row.commune) if row.commune else None,
                "province": str(row.province) if row.province else None,
                "region_name": str(row.region_name) if row.region_name else None,
                "region_code": str(row.region_code) if row.region_code else None,
                "type_centre": str(row.type_centre) if row.type_centre else None,
                "sa_centre": str(row.sa_centre) if row.sa_centre else None,
                "population": int(row.population or 0),
                "menages": int(row.menages or 0),
                "production": production,
                "consommation": consommation,
                "rend_distribution": rend_distribution,
                "status": status,
                "mappable": bool(row.mappable) if row.mappable is not None else False
            })

        installations: List[Dict[str, Any]] = []
        blocking_issues: List[Dict[str, Any]] = []
        try:
            inst_region_clause = ""
            if region is not None:
                inst_region_clause = "AND mp.code_region_12 = :region"

            inst_query = text(f"""
                SELECT DISTINCT
                    ip.installation,
                    ip.type_traitement,
                    ip.debit_equipe,
                    ip.debit_exploitable,
                    l.id_centre_desservi,
                    COALESCE(l.lib_centre_desservi, mp.lib_centre_uniformise) AS centre_name,
                    mp.lib_province,
                    mp.libelle_region
                FROM installations_production ip
                LEFT JOIN link_installations_master_panel l
                    ON l.installation = ip.installation
                LEFT JOIN master_panel mp
                    ON mp.id_centre_desservi = l.id_centre_desservi
                   AND mp.annee = :year
                WHERE 1=1
                {inst_region_clause}
                ORDER BY ip.installation
            """)

            inst_result = await self.db.execute(inst_query, params)
            inst_rows = inst_result.fetchall()

            for row in inst_rows:
                debit_equipe = float(row.debit_equipe or 0)
                debit_exploitable = float(row.debit_exploitable or 0)

                # Guardrails: detect blocking data-quality issues.
                if debit_equipe <= 0 and debit_exploitable <= 0:
                    blocking_issues.append({
                        "code": "ZERO_CAPACITY",
                        "installation": str(row.installation) if row.installation else None,
                        "message": "Capacité nulle détectée (debit_exploitable et debit_equipe <= 0).",
                        "details": {"debit_exploitable": debit_exploitable, "debit_equipe": debit_equipe},
                    })

                if debit_equipe > 0 and debit_exploitable > debit_equipe:
                    blocking_issues.append({
                        "code": "EXPLOITABLE_GT_EQUIPE",
                        "installation": str(row.installation) if row.installation else None,
                        "message": "Incohérence débit: debit_exploitable > debit_equipe.",
                        "details": {"debit_exploitable": debit_exploitable, "debit_equipe": debit_equipe},
                    })

                installation_name = str(row.installation or "").upper()
                if "LOUKKOUS" in installation_name and "STATION DE TRAITEMENT" in installation_name and debit_equipe < 660:
                    blocking_issues.append({
                        "code": "LOUKKOUS_EQUIPE_BASELINE_MISSING",
                        "installation": str(row.installation) if row.installation else None,
                        "message": "LOUKKOUS doit avoir un Debit_equipe >= 660 l/s.",
                        "details": {"debit_equipe": debit_equipe, "expected_min": 660},
                    })

                if debit_equipe > 0:
                    taux_util = max(0.0, min(100.0, (debit_exploitable / debit_equipe) * 100.0))
                else:
                    taux_util = 0.0

                capacity_candidates = [v for v in [debit_exploitable, debit_equipe] if v > 0]
                debit_reference = min(capacity_candidates) if capacity_candidates else 0.0

                if taux_util >= 95:
                    status = "deficit"
                elif taux_util >= 80:
                    status = "warn"
                else:
                    status = "ok"

                installations.append({
                    "id": str(row.installation) if row.installation else None,
                    "name": str(row.installation) if row.installation else None,
                    "type": str(row.type_traitement).strip().lower().replace(" ", "_") if row.type_traitement else "station_traitement",
                    "type_raw": str(row.type_traitement) if row.type_traitement else None,
                    "debit_equipe": debit_equipe,
                    "debit_exploitable": debit_exploitable,
                    "debit": round(debit_reference, 2),
                    "tauxUtil": round(taux_util, 1),
                    "status": status,
                    "centre_id": str(row.id_centre_desservi) if row.id_centre_desservi else None,
                    "centre_name": str(row.centre_name) if row.centre_name else None,
                    "province": str(row.lib_province) if row.lib_province else None,
                    "region_name": str(row.libelle_region) if row.libelle_region else None,
                })
        except Exception:
            installations = []

        return {
            "centres": centres,
            "installations": installations,
            "total": len(centres),
            "total_installations": len(installations),
            "region": region,
            "blocking_issues": blocking_issues,
        }

    async def _get_available_filters(self) -> Dict[str, Any]:
        """Récupère les valeurs disponibles pour les filtres depuis master_panel"""
        
        zones_query = text("""
            SELECT DISTINCT lib_centre_uniformise 
            FROM master_panel 
            WHERE lib_centre_uniformise IS NOT NULL
            ORDER BY lib_centre_uniformise
        """)
        
        zones_result = await self.db.execute(zones_query)
        all_zones = [row[0] for row in zones_result]
        
        return {"all_zones": all_zones}
    
    def _add_predictions(self, prod_data: List, conso_data: List, years: List[int]) -> tuple:
        last_real_idx = len([x for x in prod_data if x is not None]) - 1
        
        if last_real_idx < 2:
            return prod_data, conso_data
        
        recent_prod = [p for p in prod_data if p is not None][-3:]
        recent_conso = [c for c in conso_data if c is not None][-3:]
        
        if len(recent_prod) >= 2:
            prod_trend = (recent_prod[-1] - recent_prod[0]) / len(recent_prod)
            conso_trend = (recent_conso[-1] - recent_conso[0]) / len(recent_conso)
        else:
            prod_trend = 0.05
            conso_trend = 0.03
        
        for i in range(last_real_idx + 1, len(prod_data)):
            if prod_data[i-1]:
                prod_data[i] = prod_data[i-1] * (1 + prod_trend/100)
            if conso_data[i-1]:
                conso_data[i] = conso_data[i-1] * (1 + conso_trend/100)
        
        return prod_data, conso_data
    
    def _add_forecast(self, data: List[float]) -> List[float]:
        last_idx = len([x for x in data if x > 0]) - 1
        
        if last_idx < 2:
            return data
        
        recent = [d for d in data if d > 0][-3:]
        if len(recent) >= 2:
            trend = (recent[-1] - recent[0]) / len(recent)
        else:
            trend = 0.05
        
        for i in range(last_idx + 1, len(data)):
            if data[i-1]:
                data[i] = data[i-1] * (1 + trend/100)
        
        return data