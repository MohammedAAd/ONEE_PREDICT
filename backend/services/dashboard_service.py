from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime


class DashboardService:
    """Service pour les données du dashboard ONEE"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_dashboard_data(
        self,
        region: str = "all",
        start_year: int = 2020,
        end_year: int = 2030,
        mode: str = "pred"
    ) -> Dict[str, Any]:
        """Récupère toutes les données pour le dashboard"""
        
        timeseries = await self._get_timeseries(region, start_year, end_year, mode)
        timeseries_detail = await self._get_timeseries_detail(region, start_year, end_year, mode)
        stats = await self._get_statistics(region, end_year)
        bilan_zones = await self._get_bilan_by_zone(region, end_year)
        bilan_provinces = await self._get_bilan_by_province(region, end_year)
        bilan_regions = await self._get_bilan_by_region(end_year)
        rendements = await self._get_rendements(region)
        alerts = await self._get_alerts(region)
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
            "filters": filters
        }
    
    async def _get_timeseries(
        self,
        region: str,
        start_year: int,
        end_year: int,
        mode: str
    ) -> Dict[str, Any]:
        """Récupère la série temporelle consommation vs production"""
        
        years = list(range(start_year, end_year + 1))
        
        query = text("""
            SELECT 
                fa.annee,
                SUM(fa.production) as production,
                SUM(fa.distribution) as distribution,
                SUM(fa.cons_pop_branchee) as consommation
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            JOIN communes_2024 com ON c.code_commune = com.code_commune
            JOIN provinces p ON com.code_province = p.id_province
            WHERE fa.annee BETWEEN :start_year AND :end_year
            GROUP BY fa.annee
            ORDER BY fa.annee
        """)
        
        params = {"start_year": start_year, "end_year": end_year}
        
        if region != "all":
            query = text("""
                SELECT 
                    fa.annee,
                    SUM(fa.production) as production,
                    SUM(fa.distribution) as distribution,
                    SUM(fa.cons_pop_branchee) as consommation
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE r.code_region_12 = :region
                AND fa.annee BETWEEN :start_year AND :end_year
                GROUP BY fa.annee
                ORDER BY fa.annee
            """)
            params["region"] = region
        
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
        """Récupère la série détaillée production/distribution/consommation"""
        
        years = list(range(start_year, end_year + 1))
        
        query = text("""
            SELECT 
                fa.annee,
                SUM(fa.production) / 1000000 as production,
                SUM(fa.distribution) / 1000000 as distribution,
                SUM(fa.cons_pop_branchee) / 1000000 as consommation
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            JOIN communes_2024 com ON c.code_commune = com.code_commune
            JOIN provinces p ON com.code_province = p.id_province
            WHERE fa.annee BETWEEN :start_year AND :end_year
            GROUP BY fa.annee
            ORDER BY fa.annee
        """)
        
        params = {"start_year": start_year, "end_year": end_year}
        
        if region != "all":
            query = text("""
                SELECT 
                    fa.annee,
                    SUM(fa.production) / 1000000 as production,
                    SUM(fa.distribution) / 1000000 as distribution,
                    SUM(fa.cons_pop_branchee) / 1000000 as consommation
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE r.code_region_12 = :region
                AND fa.annee BETWEEN :start_year AND :end_year
                GROUP BY fa.annee
                ORDER BY fa.annee
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
        """Récupère les statistiques globales"""
        
        params = {}
        
        if region != "all":
            query = text("""
                SELECT 
                    COUNT(DISTINCT c.id_centre_2024) as nb_centres,
                    SUM(c.population_2024) as population_totale,
                    SUM(fa.cons_pop_branchee) as consommation_totale
                FROM ref_centres_hcp_2024 c
                LEFT JOIN centres_desservis cd ON c.id_centre_desservi = cd.id_centre_desservi
                LEFT JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
                LEFT JOIN communes_2024 com ON c.code_commune = com.code_commune
                LEFT JOIN provinces p ON com.code_province = p.id_province
                LEFT JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE r.code_region_12 = :region
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    COUNT(DISTINCT c.id_centre_2024) as nb_centres,
                    SUM(c.population_2024) as population_totale,
                    SUM(fa.cons_pop_branchee) as consommation_totale
                FROM ref_centres_hcp_2024 c
                LEFT JOIN centres_desservis cd ON c.id_centre_desservi = cd.id_centre_desservi
                LEFT JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
                LEFT JOIN communes_2024 com ON c.code_commune = com.code_commune
                LEFT JOIN provinces p ON com.code_province = p.id_province
            """)
        
        result = await self.db.execute(query, params)
        row = result.first()
        
        # Centres en déficit (avec filtre région)
        deficit_params = {"year": target_year}
        deficit_query = text("""
            SELECT COUNT(DISTINCT cd.id_centre_desservi) as deficit_count
            FROM centres_desservis cd
            JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            WHERE fa.annee = :year
            AND fa.production < fa.cons_pop_branchee
        """)
        
        if region != "all":
            deficit_query = text("""
                SELECT COUNT(DISTINCT cd.id_centre_desservi) as deficit_count
                FROM centres_desservis cd
                JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE fa.annee = :year
                AND fa.production < fa.cons_pop_branchee
                AND r.code_region_12 = :region
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
        """Récupère le bilan (solde) par zone"""
        
        params = {"year": year}
        
        if region != "all":
            query = text("""
                SELECT 
                    cd.lib_centre_desservi as zone,
                    SUM(fa.production) - SUM(fa.cons_pop_branchee) as solde
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE r.code_region_12 = :region
                GROUP BY cd.lib_centre_desservi
                ORDER BY solde DESC
                LIMIT 30
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    cd.lib_centre_desservi as zone,
                    SUM(fa.production) - SUM(fa.cons_pop_branchee) as solde
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                GROUP BY cd.lib_centre_desservi
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
        """Récupère le bilan par province"""
        
        params = {"year": year}
        
        if region != "all":
            query = text("""
                SELECT 
                    p.lib_province as province,
                    SUM(fa.production) - SUM(fa.cons_pop_branchee) as solde
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE r.code_region_12 = :region
                GROUP BY p.lib_province
                ORDER BY solde DESC
                LIMIT 20
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    p.lib_province as province,
                    SUM(fa.production) - SUM(fa.cons_pop_branchee) as solde
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province               
                GROUP BY p.lib_province
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
        """Récupère le bilan par région (pas de filtre région car c'est la dimension)"""
        
        query = text("""
            SELECT 
                r.libellé_region as region,
                SUM(fa.production) - SUM(fa.cons_pop_branchee) as solde
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            JOIN communes_2024 com ON c.code_commune = com.code_commune
            JOIN provinces p ON com.code_province = p.id_province
            JOIN regions r ON p.code_region_12 = r.code_region_12
            GROUP BY r.libellé_region
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
        """Récupère les rendements par zone avec filtre région"""
        
        params = {}
        
        if region != "all":
            query = text("""
                SELECT 
                    cd.lib_centre_desservi as zone,
                    AVG(fa.taux_branchement) as taux_branchement,
                    AVG(fa.rend_distribution) as rend_distribution,
                    AVG(fa.rend_adduction) as rend_adduction
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE fa.annee = 2024
                AND r.code_region_12 = :region
                GROUP BY cd.lib_centre_desservi
                ORDER BY rend_distribution DESC, rend_adduction DESC, taux_branchement DESC
                LIMIT 15
            """)
            params["region"] = region
        else:
            query = text("""
                SELECT 
                    cd.lib_centre_desservi as zone,
                    AVG(fa.taux_branchement) as taux_branchement,
                    AVG(fa.rend_distribution) as rend_distribution,
                    AVG(fa.rend_adduction) as rend_adduction
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                WHERE fa.annee = 2024
                GROUP BY cd.lib_centre_desservi
                ORDER BY rend_distribution DESC, rend_adduction DESC, taux_branchement DESC
                LIMIT 15
            """)
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        if not rows:
            return {"labels": [], "datasets": []}
        
        labels = [row.zone for row in rows]
        rend_distribution_values = [float(row.rend_distribution or 0) for row in rows]
        rend_adduction_values = [float(row.rend_adduction or 0) for row in rows]
        taux_branchement_values = [float(row.taux_branchement or 0) for row in rows]
        
        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "Rendement distribution",
                    "values": rend_distribution_values,
                    "colorKey": "blue"
                },
                {
                    "label": "Rendement adduction",
                    "values": rend_adduction_values,
                    "colorKey": "teal"
                },
                {
                    "label": "Taux branchement",
                    "values": taux_branchement_values,
                    "colorKey": "amber"
                }
            ]
        }
    
    async def _get_alerts(self, region: str) -> List[Dict[str, Any]]:
        """Récupère les alertes actives avec filtre région"""
        
        alerts = []
        
        # Alerte centres en déficit
        deficit_params = {}
        deficit_query = text("""
            SELECT COUNT(DISTINCT cd.id_centre_desservi) as deficit_count
            FROM centres_desservis cd
            JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
            WHERE fa.annee = 2024
            AND fa.production < fa.cons_pop_branchee
        """)
        
        if region != "all":
            deficit_query = text("""
                SELECT COUNT(DISTINCT cd.id_centre_desservi) as deficit_count
                FROM centres_desservis cd
                JOIN fact_activite_aep fa ON cd.id_centre_desservi = fa.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE fa.annee = 2024
                AND fa.production < fa.cons_pop_branchee
                AND r.code_region_12 = :region
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
        rend_params = {}
        rend_query = text("""
            SELECT COUNT(DISTINCT cd.id_centre_desservi) as low_rend_count
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            WHERE fa.annee = 2024
            AND fa.rend_distribution < 70
        """)
        
        if region != "all":
            rend_query = text("""
                SELECT COUNT(DISTINCT cd.id_centre_desservi) as low_rend_count
                FROM fact_activite_aep fa
                JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
                JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
                JOIN communes_2024 com ON c.code_commune = com.code_commune
                JOIN provinces p ON com.code_province = p.id_province
                JOIN regions r ON p.code_region_12 = r.code_region_12
                WHERE fa.annee = 2024
                AND fa.rend_distribution < 70
                AND r.code_region_12 = :region
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
        
        # Alerte info générale (toujours visible)
        alerts.append({
            "icon": "Info",
            "color": "var(--blue)",
            "title": "Plan d'investissement 2025-2030",
            "subtitle": "Objectif: Améliorer le rendement à 85%",
            "meta": "Budget: 2.5 MMDH"
        })
        
        return alerts
    
    async def _get_available_filters(self) -> Dict[str, Any]:
        """Récupère les valeurs disponibles pour les filtres"""
        
        zones_query = text("""
            SELECT DISTINCT lib_centre_desservi 
            FROM centres_desservis 
            ORDER BY lib_centre_desservi
        """)
        
        zones_result = await self.db.execute(zones_query)
        all_zones = [row[0] for row in zones_result]
        
        return {"all_zones": all_zones}
    
    def _add_predictions(self, prod_data: List, conso_data: List, years: List[int]) -> tuple:
        """Ajoute des prévisions simples (tendance linéaire)"""
        
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
        """Ajoute une prévision simple"""
        
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