from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text, func
from typing import List, Optional, Dict, Any
from backend.repository.base_repository import BaseRepository
from backend.models.centres import RefCentreHCP2024, CentreHCP2004, CentreHCP2014, CentreDesservi
from backend.models.geographic import Commune2024, Province, Region


class CentreRepository(BaseRepository):
    
    def __init__(self, db: AsyncSession):
        super().__init__(db)  # Appel explicite au constructeur parent
    
    def get_model(self):
        return RefCentreHCP2024
    
    async def get_centres_by_commune(self, commune_code: str) -> List[RefCentreHCP2024]:
        stmt = select(RefCentreHCP2024).where(RefCentreHCP2024.code_commune == commune_code)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_centres_by_region(self, region_code: str) -> List[RefCentreHCP2024]:
        stmt = select(RefCentreHCP2024).join(
            Commune2024, RefCentreHCP2024.code_commune == Commune2024.code_commune
        ).join(
            Province, Commune2024.code_province == Province.id_province
        ).where(Province.code_region_12 == region_code)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_centres_by_type(self, centre_type: str, limit: int = 100) -> List[RefCentreHCP2024]:
        stmt = select(RefCentreHCP2024).where(RefCentreHCP2024.type_centre == centre_type).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def count_by_type(self) -> Dict[str, int]:
        stmt = select(RefCentreHCP2024.type_centre, func.count()).group_by(RefCentreHCP2024.type_centre)
        result = await self.db.execute(stmt)
        return {row[0]: row[1] for row in result}

    async def sum_population(self) -> float:
        stmt = select(func.sum(RefCentreHCP2024.population_2024))
        result = await self.db.execute(stmt)
        return result.scalar() or 0
    
    async def get_centre_with_full_hierarchy(self, centre_id: str) -> Optional[Dict]:
        query = text("""
            SELECT 
                c.id_centre_2024,
                c.lib_centre_uniformisé,
                c.type_centre,
                c.sa_centre,
                c.population_2024,
                c.ménages_2024,
                com.code_commune,
                com.lib_commune,
                p.id_province,
                p.lib_province,
                r.code_region_12,
                r.libellé_region,
                cd.id_centre_desservi,
                cd.lib_centre_desservi,
                cd.milieu
            FROM ref_centres_hcp_2024 c
            LEFT JOIN communes_2024 com ON c.code_commune = com.code_commune
            LEFT JOIN provinces p ON com.code_province = p.id_province
            LEFT JOIN regions r ON p.code_region_12 = r.code_region_12
            LEFT JOIN centres_desservis cd ON c.id_centre_desservi = cd.id_centre_desservi
            WHERE c.id_centre_2024 = :centre_id
        """)
        
        result = await self.db.execute(query, {"centre_id": centre_id})
        row = result.first()
        
        if row:
            return {
                "centre": {
                    "id": row.id_centre_2024,
                    "nom": row.lib_centre_uniformisé,
                    "type": row.type_centre,
                    "sa_centre": row.sa_centre,
                    "population": row.population_2024,
                    "menages": row.ménages_2024
                },
                "commune": {
                    "code": row.code_commune,
                    "nom": row.lib_commune
                } if row.code_commune else None,
                "province": {
                    "id": row.id_province,
                    "nom": row.lib_province
                } if row.id_province else None,
                "region": {
                    "code": row.code_region_12,
                    "nom": row.libellé_region
                } if row.code_region_12 else None,
                "centre_desservi": {
                    "id": row.id_centre_desservi,
                    "nom": row.lib_centre_desservi,
                    "milieu": row.milieu
                } if row.id_centre_desservi else None
            }
        return None
    
    async def search_centres(self, search_term: str, limit: int = 50) -> List[Dict]:
        stmt = select(
            RefCentreHCP2024.id_centre_2024,
            RefCentreHCP2024.lib_centre_uniformisé,
            RefCentreHCP2024.type_centre
        ).where(
            or_(
                RefCentreHCP2024.lib_centre_uniformisé.ilike(f"%{search_term}%"),
                RefCentreHCP2024.id_centre_2024.ilike(f"%{search_term}%")
            )
        ).limit(limit)
        
        result = await self.db.execute(stmt)
        return [{"id": r.id_centre_2024, "nom": r.lib_centre_uniformisé, "type": r.type_centre} 
                for r in result]
    
    async def get_evolution(self, centre_id_2024: str) -> Optional[Dict]:
        query = text("""
            SELECT 
                c2004.id_centre_hcp_2004,
                c2004.lib_centre as lib_2004,
                c2004.population_2004,
                c2014.code_centre_2014,
                c2014.lib_centre_2014 as lib_2014,
                c2014.population_2014,
                c2024.id_centre_2024,
                c2024.lib_centre_uniformisé as lib_2024,
                c2024.population_2024
            FROM ref_centres_hcp_2024 c2024
            LEFT JOIN link_centres_2024_2014 l24 ON c2024.id_centre_2024 = l24.id_centre_2024
            LEFT JOIN centres_hcp_2014 c2014 ON l24.code_centre_2014 = c2014.code_centre_2014
            LEFT JOIN link_centres_2014_2004 l14 ON c2014.code_centre_2014 = l14.code_centre_2014
            LEFT JOIN centres_hcp_2004 c2004 ON l14.id_centre_hcp_2004 = c2004.id_centre_hcp_2004
            WHERE c2024.id_centre_2024 = :centre_id
        """)
        
        result = await self.db.execute(query, {"centre_id": centre_id_2024})
        row = result.first()
        
        if row:
            return {
                "centre_2004": {
                    "id": row.id_centre_hcp_2004,
                    "nom": row.lib_2004,
                    "population": row.population_2004
                } if row.id_centre_hcp_2004 else None,
                "centre_2014": {
                    "id": row.code_centre_2014,
                    "nom": row.lib_2014,
                    "population": row.population_2014
                } if row.code_centre_2014 else None,
                "centre_2024": {
                    "id": row.id_centre_2024,
                    "nom": row.lib_2024,
                    "population": row.population_2024
                } if row.id_centre_2024 else None
            }
        return None