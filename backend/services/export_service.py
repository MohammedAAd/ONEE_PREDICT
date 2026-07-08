from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import json
import csv
import io
from datetime import datetime


class ExportService:
    """Service pour l'export des données"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def export_table_to_json(self, table_name: str, limit: Optional[int] = None) -> str:
        """Export une table en JSON"""
        query = text(f"SELECT * FROM {table_name}")
        if limit:
            query = text(f"SELECT * FROM {table_name} LIMIT {limit}")
        
        result = await self.db.execute(query)
        rows = result.fetchall()
        columns = result.keys()
        
        data = [dict(zip(columns, row)) for row in rows]
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)
    
    async def export_table_to_csv(self, table_name: str, limit: Optional[int] = None) -> str:
        """Export une table en CSV"""
        query = text(f"SELECT * FROM {table_name}")
        if limit:
            query = text(f"SELECT * FROM {table_name} LIMIT {limit}")
        
        result = await self.db.execute(query)
        rows = result.fetchall()
        columns = result.keys()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Écrire l'en-tête
        writer.writerow(columns)
        
        # Écrire les données
        for row in rows:
            writer.writerow(row)
        
        return output.getvalue()
    
    async def export_production_by_region(self, format: str = "json") -> Any:
        """Export la production par région"""
        query = text("""
            SELECT 
                r.libellé_region as region,
                SUM(fa.production) as production_totale,
                SUM(fa.distribution) as distribution_totale,
                AVG(fa.taux_branchement) as taux_branchement_moyen
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            JOIN communes_2024 com ON c.code_commune = com.code_commune
            JOIN provinces p ON com.code_province = p.id_province
            JOIN regions r ON p.code_region_12 = r.code_region_12
            GROUP BY r.libellé_region
            ORDER BY production_totale DESC
        """)
        
        result = await self.db.execute(query)
        rows = result.fetchall()
        columns = result.keys()
        
        data = [dict(zip(columns, row)) for row in rows]
        
        if format == "csv":
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=columns)
            writer.writeheader()
            writer.writerows(data)
            return output.getvalue()
        
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)
    
    async def export_yearly_comparison(self, year1: int, year2: int, format: str = "json") -> Any:
        """Export comparaison entre deux années"""
        query = text("""
            SELECT 
                cd.lib_centre_desservi as centre,
                COALESCE(fa1.production, 0) as production_{year1},
                COALESCE(fa2.production, 0) as production_{year2},
                COALESCE(fa2.production, 0) - COALESCE(fa1.production, 0) as variation
            FROM centres_desservis cd
            LEFT JOIN fact_activite_aep fa1 ON cd.id_centre_desservi = fa1.id_centre_desservi AND fa1.annee = :year1
            LEFT JOIN fact_activite_aep fa2 ON cd.id_centre_desservi = fa2.id_centre_desservi AND fa2.annee = :year2
            WHERE COALESCE(fa1.production, 0) > 0 OR COALESCE(fa2.production, 0) > 0
            ORDER BY variation DESC
        """)
        
        result = await self.db.execute(query, {"year1": year1, "year2": year2})
        rows = result.fetchall()
        columns = result.keys()
        
        data = [dict(zip(columns, row)) for row in rows]
        
        if format == "csv":
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=columns)
            writer.writeheader()
            writer.writerows(data)
            return output.getvalue()
        
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)
    
    async def export_full_report(self) -> Dict[str, Any]:
        """Export un rapport complet"""
        # Statistiques globales
        stats_query = text("""
            SELECT 
                (SELECT COUNT(*) FROM regions) as nb_regions,
                (SELECT COUNT(*) FROM provinces) as nb_provinces,
                (SELECT COUNT(*) FROM communes_2024) as nb_communes,
                (SELECT COUNT(*) FROM ref_centres_hcp_2024) as nb_centres,
                (SELECT SUM(population_2024) FROM ref_centres_hcp_2024) as population_totale,
                (SELECT SUM(production) FROM fact_activite_aep) as production_totale
        """)
        
        result = await self.db.execute(stats_query)
        stats = result.first()
        
        # Production par région
        region_query = text("""
            SELECT 
                r.libellé_region as region,
                SUM(fa.production) as production
            FROM fact_activite_aep fa
            JOIN centres_desservis cd ON fa.id_centre_desservi = cd.id_centre_desservi
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            JOIN communes_2024 com ON c.code_commune = com.code_commune
            JOIN provinces p ON com.code_province = p.id_province
            JOIN regions r ON p.code_region_12 = r.code_region_12
            GROUP BY r.libellé_region
        """)
        
        region_result = await self.db.execute(region_query)
        regions = [{"region": row.region, "production": row.production} for row in region_result]
        
        return {
            "date_export": datetime.now().isoformat(),
            "statistiques_globales": {
                "regions": stats.nb_regions,
                "provinces": stats.nb_provinces,
                "communes": stats.nb_communes,
                "centres": stats.nb_centres,
                "population_totale": stats.population_totale,
                "production_totale": stats.production_totale
            },
            "production_par_region": regions,
            "annees_disponibles": await self._get_available_years()
        }
    
    async def _get_available_years(self) -> List[int]:
        """Récupère les années disponibles"""
        query = text("SELECT DISTINCT annee FROM fact_activite_aep ORDER BY annee")
        result = await self.db.execute(query)
        return [row.annee for row in result]