from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.services.centre_service import CentreService

router = APIRouter(prefix="/centres", tags=["Centres"])

async def get_centre_service(db: AsyncSession = Depends(get_db)):
    # Correction : passer directement db au service
    return CentreService(db)

@router.get("/")
async def get_all_centres(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: CentreService = Depends(get_centre_service)
):
    centres = await service.get_all_centres(limit, offset)
    return {"total": len(centres), "data": centres}


@router.get("/{centre_id}")
async def get_centre_by_id(
    centre_id: str,
    service: CentreService = Depends(get_centre_service)
):
    centre = await service.get_centre_details(centre_id)
    if not centre:
        raise HTTPException(status_code=404, detail="Centre non trouvé")
    return centre

@router.get("/{centre_id}/evolution")
async def get_centre_evolution(
    centre_id: str,
    service: CentreService = Depends(get_centre_service)
):
    evolution = await service.get_centre_evolution(centre_id)
    if not evolution:
        raise HTTPException(status_code=404, detail="Évolution non trouvée")
    return evolution

@router.get("/region/{region_code}")
async def get_centres_by_region(
    region_code: str,
    service: CentreService = Depends(get_centre_service)
):
    centres = await service.get_centres_by_region(region_code)
    return {"region_code": region_code, "total": len(centres), "data": centres}

@router.get("/commune/{commune_code}")
async def get_centres_by_commune(
    commune_code: str,
    service: CentreService = Depends(get_centre_service)
):
    centres = await service.get_centres_by_commune(commune_code)
    return {"commune_code": commune_code, "total": len(centres), "data": centres}

@router.get("/type/{centre_type}")
async def get_centres_by_type(
    centre_type: str,
    limit: int = Query(100, ge=1, le=1000),
    service: CentreService = Depends(get_centre_service)
):
    centres = await service.get_centres_by_type(centre_type, limit)
    return {"type": centre_type, "total": len(centres), "data": centres}

@router.get("/search/{query}")
async def search_centres(
    query: str,
    service: CentreService = Depends(get_centre_service)
):
    centres = await service.search_centres(query)
    return {"query": query, "total": len(centres), "data": centres}

@router.get("/statistics/summary")
async def get_centre_statistics(
    service: CentreService = Depends(get_centre_service)
):
    return await service.get_centre_statistics()

@router.get("/drs")
async def get_all_drs(
    year: int = Query(2024, description="Année de référence"),
    service: CentreService = Depends(get_centre_service)
) -> List[Dict[str, Any]]:
    """Récupère tous les DRs avec leurs statistiques"""
    return await service.get_all_drs(year)


@router.get("/by-dr/{dr_id}")
async def get_centres_by_dr(
    dr_id: str,
    year: int = Query(2024, description="Année de référence"),
    include_installations: bool = Query(False, description="Inclure les installations"),
    service: CentreService = Depends(get_centre_service)
) -> List[Dict[str, Any]]:
    """Récupère tous les centres d'un DR spécifique"""
    return await service.get_centres_by_dr(dr_id, year, include_installations)