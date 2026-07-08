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
        end_year: int = 2030
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
        
        if region != "all" and not centre_id:
            query = text("""
                SELECT 
                    fl.annee,
                    fl.type_consommation,
                    SUM(fl.consommation) as consommation
                FROM fact_long fl
                JOIN master_panel mp ON fl.id_centre_desservi = mp.id_centre_desservi
                WHERE mp.code_region_12 = :region
                AND fl.annee BETWEEN :start_year AND :end_year
                GROUP BY fl.annee, fl.type_consommation
                ORDER BY fl.annee, fl.type_consommation
            """)
            params["region"] = region
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        # Types de consommation possibles
        types = ["Administrative", "Industrielle", "Autres", "Bornes Fontaines"]
        
        # Initialiser les données par type
        data_by_type = {t: {y: 0 for y in years} for t in types}
        
        for row in rows:
            if row.type_consommation in data_by_type:
                data_by_type[row.type_consommation][row.annee] = float(row.consommation or 0) / 1_000_000
        
        # Formater pour les charts
        datasets = []
        color_map = {
            "Administrative": "blue",
            "Industrielle": "teal",
            "Autres": "amber",
            "Bornes Fontaines": "purple"
        }
        
        for t in types:
            datasets.append({
                "label": t,
                "data": [data_by_type[t][y] for y in years],
                "colorKey": color_map.get(t, "blue")
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
        
        if region != "all":
            query = text("""
                SELECT 
                    fl.type_consommation,
                    SUM(fl.consommation) as consommation
                FROM fact_long fl
                JOIN master_panel mp ON fl.id_centre_desservi = mp.id_centre_desservi
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