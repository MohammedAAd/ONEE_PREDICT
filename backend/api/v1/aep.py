from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.services.aep_service import AEPService

router = APIRouter(prefix="/aep", tags=["AEP"])

async def get_aep_service(db: AsyncSession = Depends(get_db)):
    # Correction : passer directement db au service
    return AEPService(db)

@router.get("/centre/{centre_desservi_id}")
async def get_production_by_centre(
    centre_desservi_id: str,
    with_details: bool = Query(False, description="Inclure les détails du centre"),
    service: AEPService = Depends(get_aep_service)
):
    if with_details:
        data = await service.get_production_by_centre_with_details(centre_desservi_id)
    else:
        data = await service.get_production_by_centre(centre_desservi_id)
    
    if not data:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    return data

@router.get("/region/{region_code}")
async def get_production_by_region(
    region_code: str,
    service: AEPService = Depends(get_aep_service)
):
    data = await service.get_production_by_region(region_code)
    return {"region_code": region_code, "data": data}

@router.get("/year/{annee}")
async def get_production_by_year(
    annee: int,
    service: AEPService = Depends(get_aep_service)
):
    data = await service.get_production_by_year(annee)
    return {"annee": annee, "total": len(data), "data": data}

@router.get("/top")
async def get_top_centres(
    limit: int = Query(10, ge=1, le=50),
    annee: Optional[int] = Query(None, description="Année spécifique"),
    service: AEPService = Depends(get_aep_service)
):
    data = await service.get_top_centres(limit, annee)
    return {"limit": limit, "annee": annee, "data": data}

@router.get("/statistics/global")
async def get_aep_statistics(
    service: AEPService = Depends(get_aep_service)
):
    return await service.get_aep_statistics()

@router.get("/indicators/performance")
async def get_performance_indicators(
    service: AEPService = Depends(get_aep_service)
):
    return await service.get_performance_indicators()