from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.services.production_service import ProductionService

router = APIRouter(prefix="/production", tags=["Production"])


async def get_production_service(db: AsyncSession = Depends(get_db)):
    return ProductionService(db)


async def _enforce_data_quality(service: ProductionService, region_param: Optional[int], year: int):
    issues = await service.get_blocking_quality_issues(region_param, year)
    if issues:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "BLOCKING_DATA_QUALITY",
                "message": "Des anomalies bloquantes ont ete detectees dans les donnees de capacite.",
                "issues": issues,
            },
        )


@router.get("/")
async def get_all_production_data(
    region: Optional[str] = Query("all", description="Code région ou 'all'"),
    year: int = Query(2024, description="Année de référence"),
    installation: Optional[str] = Query(None, description="ID de l'installation"),
    service: ProductionService = Depends(get_production_service)
):
    """Récupère toutes les données pour la page production"""
    # Convertir region en int si ce n'est pas "all"
    region_param = None if region == "all" else int(region)
    await _enforce_data_quality(service, region_param, year)
    return await service.get_all_data(region_param, year, installation)


@router.get("/monthly")
async def get_monthly_production(
    region: Optional[str] = Query("all"),
    year: int = Query(2024),
    installation: Optional[str] = Query(None),
    service: ProductionService = Depends(get_production_service)
):
    """Récupère la production mensuelle (historique + prédiction)"""
    region_param = None if region == "all" else int(region)
    await _enforce_data_quality(service, region_param, year)
    return await service.get_monthly_production(region_param, year, installation)


@router.get("/installations")
async def get_installations(
    region: Optional[str] = Query("all"),
    year: int = Query(2024),
    service: ProductionService = Depends(get_production_service)
):
    """Récupère la liste des installations avec leurs taux d'utilisation"""
    # Convertir region en int si ce n'est pas "all"
    region_param = None if region == "all" else int(region)
    await _enforce_data_quality(service, region_param, year)
    return await service.get_installations(region_param, year)


@router.get("/stats")
async def get_production_stats(
    region: Optional[str] = Query("all"),
    year: int = Query(2024),
    service: ProductionService = Depends(get_production_service)
):
    """Récupère les statistiques globales de production"""
    region_param = None if region == "all" else int(region)
    await _enforce_data_quality(service, region_param, year)
    return await service.get_stats(region_param, year)


@router.get("/years")
async def get_available_years(
    service: ProductionService = Depends(get_production_service)
):
    """Récupère les années disponibles"""
    return await service.get_available_years()


@router.get("/installations/list")
async def get_installations_list(
    region: Optional[str] = Query("all"),
    service: ProductionService = Depends(get_production_service)
):
    """Récupère la liste des installations pour le filtre"""
    region_param = None if region == "all" else int(region) if region != "all" else None
    return await service.get_installations_list(region_param)