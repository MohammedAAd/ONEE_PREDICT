from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import numpy as np


class DashboardAnalyticsService:
    """Service pour les graphiques analytiques du dashboard"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_taux_branchement_moyen(
        self,
        region: Optional[int] = None,
        start_year: int = 2015,
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """Taux de branchement moyen (%) par année"""
        
        years = list(range(start_year, end_year + 1))
        
        if region is not None:
            query = text("""
                SELECT 
                    annee,
                    AVG(taux_branchement) as taux
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params = {"region": region, "start_year": start_year, "end_year": end_year}
        else:
            query = text("""
                SELECT 
                    annee,
                    AVG(taux_branchement) as taux
                FROM master_panel
                WHERE annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params = {"start_year": start_year, "end_year": end_year}
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        data_by_year = {row.annee: round(row.taux or 0, 1) for row in rows}
        
        taux_data = [data_by_year.get(y, None) for y in years]
        
        # Ajouter une prédiction pour les années manquantes
        
        return {
            "labels": [str(y) for y in years],
            "values": taux_data,
            "title": "Taux de branchement moyen (%)",
            "y_label": "Taux de branchement (%)",
            "target_2030": 88,
            "start_year": start_year,
            "end_year": end_year
        }
    
    async def get_rendement_distribution(
        self,
        region: Optional[int] = None,
        start_year: int = 2015,
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """Rendement de distribution par année (%)"""
        
        years = list(range(start_year, end_year + 1))
        
        if region is not None:
            query = text("""
                SELECT 
                    annee,
                    AVG(rend_distribution) as rendement
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params = {"region": region, "start_year": start_year, "end_year": end_year}
        else:
            query = text("""
                SELECT 
                    annee,
                    AVG(rend_distribution) as rendement
                FROM master_panel
                WHERE annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params = {"start_year": start_year, "end_year": end_year}
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        data_by_year = {row.annee: round(row.rendement or 0, 1) for row in rows}
        
        rendement_data = [data_by_year.get(y, None) for y in years]
        
        # Ajouter une prédiction
        
        return {
            "labels": [str(y) for y in years],
            "values": rendement_data,
            "title": "Rendement de distribution (%)",
            "y_label": "Rendement (%)",
            "target_2030": 85,
            "start_year": start_year,
            "end_year": end_year
        }
    
    async def get_scatter_rendement_vs_taux(
        self,
        region: Optional[int] = None,
        year: int = 2024
    ) -> Dict[str, Any]:
        """Scatter plot: Rendement distribution vs Taux branchement"""
        
        if region is not None:
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as centre,
                    mp.taux_branchement as taux,
                    mp.rend_distribution as rendement
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                AND mp.annee = :year
                AND mp.taux_branchement IS NOT NULL
                AND mp.rend_distribution IS NOT NULL
                ORDER BY mp.lib_centre_uniformise
            """)
            params = {"region": region, "year": year}
        else:
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as centre,
                    mp.taux_branchement as taux,
                    mp.rend_distribution as rendement
                FROM master_panel mp
                WHERE mp.annee = :year
                AND mp.taux_branchement IS NOT NULL
                AND mp.rend_distribution IS NOT NULL
                ORDER BY mp.lib_centre_uniformise
            """)
            params = {"year": year}
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        # Calculer la droite de régression
        taux_values = [float(row.taux) for row in rows]
        rend_values = [float(row.rendement) for row in rows]
        
        # Régression linéaire simple
        if len(taux_values) > 1:
            n = len(taux_values)
            sum_x = sum(taux_values)
            sum_y = sum(rend_values)
            sum_xy = sum(x * y for x, y in zip(taux_values, rend_values))
            sum_x2 = sum(x ** 2 for x in taux_values)
            
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2) if (n * sum_x2 - sum_x ** 2) != 0 else 0
            intercept = (sum_y - slope * sum_x) / n
        else:
            slope = 0
            intercept = 0
        
        return {
            "data": [
                {"x": float(row.taux), "y": float(row.rendement), "label": row.centre}
                for row in rows
            ],
            "regression": {
                "slope": round(slope, 4),
                "intercept": round(intercept, 2),
                "formula": f"Rendement = {round(slope, 2)} × Taux + {round(intercept, 2)}"
            },
            "title": "Rendement vs Taux de branchement",
            "x_label": "Taux de branchement (%)",
            "y_label": "Rendement distribution (%)",
            "year": year
        }
    
    async def get_dotation_bf_vs_pop(
        self,
        region: Optional[int] = None,
        year: int = 2024
    ) -> Dict[str, Any]:
        """Scatter plot: Dotation BF vs Population branchée (L/j/hab)"""
        
        if region is not None:
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as centre,
                    mp.population_2024 as population,
                    mp.dot_bf as dotation_bf,
                    mp.taux_branchement as taux
                FROM master_panel mp
                WHERE mp.code_region_12 = :region
                AND mp.annee = :year
                AND mp.dot_bf IS NOT NULL
                AND mp.population_2024 > 0
                ORDER BY mp.lib_centre_uniformise
            """)
            params = {"region": region, "year": year}
        else:
            query = text("""
                SELECT 
                    mp.lib_centre_uniformise as centre,
                    mp.population_2024 as population,
                    mp.dot_bf as dotation_bf,
                    mp.taux_branchement as taux
                FROM master_panel mp
                WHERE mp.annee = :year
                AND mp.dot_bf IS NOT NULL
                AND mp.population_2024 > 0
                ORDER BY mp.lib_centre_uniformise
            """)
            params = {"year": year}
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        return {
            "data": [
                {
                    "x": float(row.population) / 1000,  # Population en milliers
                    "y": float(row.dotation_bf),
                    "label": row.centre,
                    "taux": round(float(row.taux), 1) if row.taux else 0
                }
                for row in rows
            ],
            "title": "Dotation BF vs Population branchée",
            "x_label": "Population branchée (milliers d'habitants)",
            "y_label": "Dotation BF (L/j/habitant)",
            "year": year
        }
    
    async def get_dotations_annuelles(
        self,
        region: Optional[int] = None,
        start_year: int = 2015,
        end_year: int = 2030
    ) -> Dict[str, Any]:
        """Dotations nette et brute par année (L/j/hab)"""
        
        years = list(range(start_year, end_year + 1))
        
        if region is not None:
            query = text("""
                SELECT 
                    annee,
                    AVG(dot_globale_nette) as dot_nette,
                    AVG(dot_globale_brute) as dot_brute
                FROM master_panel
                WHERE code_region_12 = :region
                AND annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params = {"region": region, "start_year": start_year, "end_year": end_year}
        else:
            query = text("""
                SELECT 
                    annee,
                    AVG(dot_globale_nette) as dot_nette,
                    AVG(dot_globale_brute) as dot_brute
                FROM master_panel
                WHERE annee BETWEEN :start_year AND :end_year
                GROUP BY annee
                ORDER BY annee
            """)
            params = {"start_year": start_year, "end_year": end_year}
        
        result = await self.db.execute(query, params)
        rows = result.fetchall()
        
        data_nette = {row.annee: round(row.dot_nette or 0, 1) for row in rows}
        data_brute = {row.annee: round(row.dot_brute or 0, 1) for row in rows}
        
        dot_nette_data = [data_nette.get(y, None) for y in years]
        dot_brute_data = [data_brute.get(y, None) for y in years]
        
        # Ajouter des prédictions
        
        return {
            "labels": [str(y) for y in years],
            "datasets": [
                {
                    "label": "Dotation nette",
                    "data": dot_nette_data,
                    "colorKey": "blue"
                },
                {
                    "label": "Dotation brute",
                    "data": dot_brute_data,
                    "colorKey": "teal"
                }
            ],
            "title": "Dotations nette et brute (L/j/habitant)",
            "y_label": "Dotation (L/j/habitant)",
            "start_year": start_year,
            "end_year": end_year
        }
