from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func, and_, or_
from typing import List, Optional, Dict, Any
from backend.repository.base_repository import BaseRepository
from backend.models.master_panel import MasterPanel
from backend.models.centres import CentreDesservi


class MasterPanelRepository(BaseRepository):
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
    
    def get_model(self):
        return MasterPanel
    
    async def get_data_by_centre(self, centre_id: str, start_year: int = None, end_year: int = None) -> List[MasterPanel]:
        """Récupère les données d'un centre sur une période"""
        stmt = select(MasterPanel).where(MasterPanel.id_centre_desservi == centre_id)
        if start_year:
            stmt = stmt.where(MasterPanel.annee >= start_year)
        if end_year:
            stmt = stmt.where(MasterPanel.annee <= end_year)
        stmt = stmt.order_by(MasterPanel.annee)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_timeseries(
        self, 
        region: str = "all", 
        start_year: int = 2020, 
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """Récupère la série temporelle production/distribution/consommation"""
        
        query = text("""
            SELECT 
                annee,
                SUM(production) as production,
                SUM(distribution) as distribution,
                SUM(cons_pop_branchee) as consommation
            FROM master_panel
            WHERE annee BETWEEN :start_year AND :end_year
            GROUP BY annee
            ORDER BY annee
        """)
        
        params = {"start_year": start_year, "end_year": end_year}
        
        if region != "all":
            query = text("""
                SELECT 
                    annee,
                    SUM(production) as production,
                    SUM(distribution) as distribution,
                    SUM(cons_pop_branchee) as consommation
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params["region"] = region
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        years = list(range(start_year, end_year + 1))
        data_by_year = {row.annee: {
            "prod": float(row.production or 0) / 1_000_000,
            "conso": float(row.consommation or 0) / 1_000_000,
            "dist": float(row.distribution or 0) / 1_000_000
        } for row in rows}
        
        prod_data = [data_by_year.get(y, {}).get("prod", None) for y in years]
        conso_data = [data_by_year.get(y, {}).get("conso", None) for y in years]
        dist_data = [data_by_year.get(y, {}).get("dist", None) for y in years]
        
        return {
            "labels": [str(y) for y in years],
            "prod": prod_data,
            "conso": conso_data,
            "distribution": dist_data
        }
    
    async def get_bilan_by_zone(self, region: str, year: int) -> Dict[str, List]:
        """Récupère le bilan (production - consommation) par zone"""
        
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
        
        params = {"year": year}
        
        if region != "all":
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as zone,
                    SUM(mp.production) - SUM(mp.cons_pop_branchee) as solde
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                AND mp.annee = :year
                GROUP BY mp.lib_centre_uniformise
                ORDER BY solde DESC
                LIMIT 30
            """)
            params["region"] = region
        
        result = await self.db.execute(query, params)
        
        zones = []
        soldes = []
        for row in result:
            zones.append(row.zone)
            soldes.append(float(row.solde or 0))
        
        return {"labels": zones, "values": soldes}
    
    async def get_rendements(self, region: str) -> Dict[str, Any]:
        """Récupère les rendements par zone"""
        
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
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        if not rows:
            return {"labels": [], "datasets": []}
        
        return {
            "labels": [row.zone for row in rows],
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
    
    async def get_statistics(self, region: str, year: int) -> Dict[str, Any]:
        """Récupère les statistiques globales"""
        
        query = text("""
            SELECT 
                COUNT(DISTINCT id_centre_desservi) as nb_centres,
                SUM(population_2024) as population_totale,
                SUM(cons_pop_branchee) as consommation_totale
            FROM master_panel
            WHERE annee = :year
        """)
        
        params = {"year": year}
        
        if region != "all":
            query = text("""
                SELECT 
                    COUNT(DISTINCT id_centre_desservi) as nb_centres,
                    SUM(population_2024) as population_totale,
                    SUM(cons_pop_branchee) as consommation_totale
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee = :year
            """)
            params["region"] = region
        
        result = await self.db.execute(query, params)
        row = result.first()
        
        # Centres en déficit
        deficit_query = text("""
            SELECT COUNT(DISTINCT id_centre_desservi) as deficit_count
            FROM master_panel
            WHERE annee = :year
            AND production < cons_pop_branchee
        """)
        
        deficit_params = {"year": year}
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