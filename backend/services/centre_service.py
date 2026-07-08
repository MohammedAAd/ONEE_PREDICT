# backend/services/centre_service.py - Version corrigée pour PostgreSQL

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession 
from sqlalchemy import text

from backend.repository.centre_repository import CentreRepository


class CentreService:
    
    def __init__(self, db: AsyncSession):
        self.db = db  # Ajout de l'attribut db
        self.centre_repo = CentreRepository(db)
    
    async def get_all_centres(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        centres = await self.centre_repo.get_all(limit, offset)
        return [self._serialize_centre(c) for c in centres]
    
    async def get_centre_details(self, centre_id: str) -> Optional[Dict[str, Any]]:
        return await self.centre_repo.get_centre_with_full_hierarchy(centre_id)
    
    async def get_centre_evolution(self, centre_id: str) -> Optional[Dict[str, Any]]:
        return await self.centre_repo.get_evolution(centre_id)
    
    async def get_centres_by_region(self, region_code: str) -> List[Dict[str, Any]]:
        centres = await self.centre_repo.get_centres_by_region(region_code)
        return [self._serialize_centre(c) for c in centres]
    
    async def get_centres_by_commune(self, commune_code: str) -> List[Dict[str, Any]]:
        centres = await self.centre_repo.get_centres_by_commune(commune_code)
        return [self._serialize_centre(c) for c in centres]
    
    async def get_centres_by_type(self, centre_type: str, limit: int = 100) -> List[Dict[str, Any]]:
        centres = await self.centre_repo.get_centres_by_type(centre_type, limit)
        return [self._serialize_centre(c) for c in centres]
    
    async def search_centres(self, search_term: str, limit: int = 50) -> List[Dict[str, Any]]:
        return await self.centre_repo.search_centres(search_term, limit)
    
    async def get_centre_statistics(self) -> Dict[str, Any]:
        total = await self.centre_repo.count()
        types_count = await self.centre_repo.count_by_type()
        population_totale = await self.centre_repo.sum_population()
        
        return {
            "total_centres": total,
            "centres_par_type": types_count,
            "population_totale_desservie": population_totale,
            "annees_disponibles": ["2004", "2014", "2024"]
        }
    
    def _serialize_centre(self, centre) -> Dict[str, Any]:
        return {
            "id": getattr(centre, 'id_centre_2024', None) or getattr(centre, 'id_centre_hcp_2004', None),
            "nom": getattr(centre, 'lib_centre_uniformisé', None) or getattr(centre, 'lib_centre', None) or getattr(centre, 'lib_centre_2014', None),
            "type": getattr(centre, 'type_centre', None),
            "sa_centre": getattr(centre, 'sa_centre', None),
            "population": getattr(centre, 'population_2024', None) or getattr(centre, 'population_2014', None) or getattr(centre, 'population_2004', None),
            "menages": getattr(centre, 'ménages_2024', None) or getattr(centre, 'menages_2014', None),
            "code_commune": getattr(centre, 'code_commune', None)
        }

    async def get_centres_by_dr(
        self,
        dr_id: str,
        year: int = 2024,
        include_installations: bool = False
    ) -> List[Dict[str, Any]]:
        """Récupère tous les centres d'un DR spécifique"""
        
        if include_installations:
            query = text("""
                SELECT 
                    mp.id_centre_desservi,
                    mp.lib_centre_uniformise as centre,
                    mp.lib_commune,
                    mp.lib_province,
                    mp.libelle_region,
                    mp.type_centre,
                    mp.sa_centre,
                    mp.population_2024,
                    mp.menages_2024,
                    mp.milieu,
                    ROUND(CAST(mp.cons_pop_branchee AS numeric) / 1000000, 2) as conso_millions_m3,
                    ROUND(CAST(mp.production AS numeric) / 1000000, 2) as production_millions_m3,
                    ROUND(CAST(mp.taux_branchement AS numeric), 1) as taux_branchement,
                    ROUND(CAST(mp.rend_distribution AS numeric), 1) as rendement,
                    COUNT(DISTINCT l.installation) as nb_installations
                FROM master_panel mp
                LEFT JOIN link_installations_master_panel l ON mp.id_centre_desservi = l.id_centre_desservi
                WHERE mp.dr = :dr_id
                AND mp.annee = :year
                GROUP BY mp.id_centre_desservi, mp.lib_centre_uniformise, mp.lib_commune, 
                         mp.lib_province, mp.libelle_region, mp.type_centre, mp.sa_centre,
                         mp.population_2024, mp.menages_2024, mp.milieu, mp.cons_pop_branchee,
                         mp.production, mp.taux_branchement, mp.rend_distribution
                ORDER BY mp.lib_centre_uniformise
            """)
        else:
            query = text("""
                SELECT 
                    mp.id_centre_desservi,
                    mp.lib_centre_uniformise as centre,
                    mp.lib_commune,
                    mp.lib_province,
                    mp.libelle_region,
                    mp.type_centre,
                    mp.sa_centre,
                    mp.population_2024,
                    mp.menages_2024,
                    mp.milieu,
                    ROUND(CAST(mp.cons_pop_branchee AS numeric) / 1000000, 2) as conso_millions_m3,
                    ROUND(CAST(mp.production AS numeric) / 1000000, 2) as production_millions_m3,
                    ROUND(CAST(mp.taux_branchement AS numeric), 1) as taux_branchement,
                    ROUND(CAST(mp.rend_distribution AS numeric), 1) as rendement
                FROM master_panel mp
                WHERE mp.dr = :dr_id
                AND mp.annee = :year
                ORDER BY mp.lib_centre_uniformise
            """)
        
        result = await self.db.execute(query, {"dr_id": dr_id, "year": year})
        rows = result.fetchall()
        
        centres = []
        for row in rows:
            centre = {
                "id": row.id_centre_desservi,
                "nom": row.centre,
                "commune": row.lib_commune,
                "province": row.lib_province,
                "region": row.libelle_region,
                "type_centre": row.type_centre,
                "sa_centre": row.sa_centre,
                "population": int(row.population_2024) if row.population_2024 else 0,
                "menages": int(row.menages_2024) if row.menages_2024 else 0,
                "milieu": row.milieu,
                "consommation": float(row.conso_millions_m3) if row.conso_millions_m3 else 0,
                "production": float(row.production_millions_m3) if row.production_millions_m3 else 0,
                "taux_branchement": float(row.taux_branchement) if row.taux_branchement else 0,
                "rendement": float(row.rendement) if row.rendement else 0
            }
            if include_installations:
                centre["nb_installations"] = row.nb_installations or 0
            centres.append(centre)
        
        return centres
    
    async def get_all_drs(self, year: int = 2024) -> List[Dict[str, Any]]:
        """Récupère tous les DR avec le nombre de centres"""
        
        query = text("""
            SELECT 
                dr,
                COUNT(DISTINCT id_centre_desservi) as nb_centres,
                SUM(population_2024) as population_totale,
                ROUND(CAST(SUM(cons_pop_branchee) AS numeric) / 1000000, 2) as consommation_totale,
                ROUND(CAST(SUM(production) AS numeric) / 1000000, 2) as production_totale
            FROM master_panel
            WHERE dr IS NOT NULL
            AND dr != ''
            AND annee = :year
            GROUP BY dr
            ORDER BY dr
        """)
        
        result = await self.db.execute(query, {"year": year})
        rows = result.fetchall()
        
        return [
            {
                "id": row.dr,
                "nom": row.dr,
                "nb_centres": row.nb_centres,
                "population_totale": int(row.population_totale) if row.population_totale else 0,
                "consommation_totale": float(row.consommation_totale) if row.consommation_totale else 0,
                "production_totale": float(row.production_totale) if row.production_totale else 0
            }
            for row in rows
        ]