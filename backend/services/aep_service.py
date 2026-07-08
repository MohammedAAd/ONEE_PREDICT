from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from backend.repository.aep_repository import AEPRepository


class AEPService:
    
    def __init__(self, db: AsyncSession):
        self.aep_repo = AEPRepository(db)  # ← Passe db, pas self
    
    async def get_production_by_centre(self, centre_desservi_id: str) -> List[Dict[str, Any]]:
        data = await self.aep_repo.get_production_by_centre(centre_desservi_id)
        return [self._serialize_aep(d) for d in data]
    
    async def get_production_by_centre_with_details(self, centre_desservi_id: str) -> Dict[str, Any]:
        data = await self.aep_repo.get_production_by_centre(centre_desservi_id)
        centre_info = await self.aep_repo.get_centre_desservi_info(centre_desservi_id)
        
        return {
            "centre_desservi": centre_info,
            "historique_production": [self._serialize_aep(d) for d in data],
            "tendance": self._calculate_trend(data)
        }
    
    async def get_production_by_region(self, region_code: str) -> List[Dict[str, Any]]:
        return await self.aep_repo.get_production_by_region(region_code)
    
    async def get_production_by_year(self, annee: int) -> List[Dict[str, Any]]:
        data = await self.aep_repo.get_production_by_year(annee)
        return [self._serialize_aep(d) for d in data]
    
    async def get_top_centres(self, limit: int = 10, annee: Optional[int] = None) -> List[Dict[str, Any]]:
        return await self.aep_repo.get_top_centres(limit, annee)
    
    async def get_aep_statistics(self) -> Dict[str, Any]:
        return await self.aep_repo.get_global_statistics()
    
    async def get_performance_indicators(self) -> Dict[str, Any]:
        return await self.aep_repo.get_performance_indicators()
    
    def _serialize_aep(self, aep) -> Dict[str, Any]:
        return {
            "annee": getattr(aep, 'annee', None),
            "production": getattr(aep, 'production', None),
            "distribution": getattr(aep, 'distribution', None),
            "cons_pop_branchee": getattr(aep, 'cons_pop_branchee', None),
            "nbre_abonnes_particuliers": getattr(aep, 'nbre_abonnes_particuliers', None),
            "taux_branchement": getattr(aep, 'taux_branchement', None),
            "rend_distribution": getattr(aep, 'rend_distribution', None),
        }
    
    def _calculate_trend(self, data: List) -> str:
        if len(data) < 2:
            return "données_insuffisantes"
        
        productions = [getattr(d, 'production', 0) for d in data if getattr(d, 'production', 0) > 0]
        if len(productions) < 2:
            return "données_insuffisantes"
        
        if productions[-1] > productions[0]:
            return "croissante"
        elif productions[-1] < productions[0]:
            return "décroissante"
        return "stable"