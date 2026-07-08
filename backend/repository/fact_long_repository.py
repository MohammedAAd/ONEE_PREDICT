from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from typing import List, Optional, Dict, Any
from backend.repository.base_repository import BaseRepository
from backend.models.fact_long import FactLong


class FactLongRepository(BaseRepository):
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)
    
    def get_model(self):
        return FactLong
    
    async def get_consommation_by_type(
        self, 
        centre_id: str = None, 
        region: str = "all",
        start_year: int = 2020, 
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """Récupère la consommation par type (Administrative, Industrielle, Autres, Bornes Fontaines)"""
        
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
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        # Organiser les données par type
        types = ["Administrative", "Industrielle", "Autres", "Bornes Fontaines"]
        years = list(range(start_year, end_year + 1))
        
        data_by_type = {t: [] for t in types}
        for row in rows:
            if row.type_consommation in data_by_type:
                data_by_type[row.type_consommation].append({
                    "annee": row.annee,
                    "consommation": float(row.consommation or 0) / 1_000_000
                })
        
        # Formater pour les charts
        result_data = {}
        for t in types:
            values = []
            for year in years:
                val = next((d["consommation"] for d in data_by_type[t] if d["annee"] == year), 0)
                values.append(val)
            result_data[t] = values
        
        return {
            "labels": [str(y) for y in years],
            "datasets": [
                {
                    "label": "Administrative",
                    "data": result_data.get("Administrative", []),
                    "colorKey": "blue"
                },
                {
                    "label": "Industrielle",
                    "data": result_data.get("Industrielle", []),
                    "colorKey": "teal"
                },
                {
                    "label": "Autres",
                    "data": result_data.get("Autres", []),
                    "colorKey": "amber"
                },
                {
                    "label": "Bornes Fontaines",
                    "data": result_data.get("Bornes Fontaines", []),
                    "colorKey": "purple"
                }
            ]
        }
    
    async def get_consommation_totale_by_type(self, year: int, region: str = "all") -> Dict[str, float]:
        """Récupère la consommation totale par type pour une année"""
        
        query = text("""
            SELECT 
                fl.type_consommation,
                SUM(fl.consommation) as consommation
            FROM fact_long fl
            WHERE fl.annee = :year
            GROUP BY fl.type_consommation
        """)
        
        params = {"year": year}
        
        result = await self.db.execute(query, params)
        
        return {row.type_consommation: float(row.consommation or 0) / 1_000_000 for row in result}