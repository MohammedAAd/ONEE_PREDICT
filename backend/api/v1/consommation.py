from fastapi import APIRouter, Depends, Query
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from backend.app.database import get_db
from backend.services.consommation_service import ConsommationService

router = APIRouter(prefix="/consommation", tags=["Consommation"])


async def get_consommation_service(db: AsyncSession = Depends(get_db)):
    return ConsommationService(db)


@router.get("/")
async def get_all_consommation_data(
    region: Optional[str] = Query("all", description="Code région ou 'all'"),
    year: int = Query(2024, description="Année de référence"),
    service: ConsommationService = Depends(get_consommation_service)
):
    """
    Récupère toutes les données pour la page consommation
    """
    region_param = None if region == "all" else int(region)
    return await service.get_all_data(region_param, year)


@router.get("/population")
async def get_population_projection(
    region: Optional[str] = Query("all"),
    start_year: int = Query(2020),
    end_year: int = Query(2030),
    service: ConsommationService = Depends(get_consommation_service)
):
    """
    Récupère les projections de population (totale et branchée)
    """
    region_param = None if region == "all" else int(region)
    return await service.get_population_projection(region_param, start_year, end_year)


@router.get("/usage")
async def get_consumption_by_usage(
    region: Optional[str] = Query("all"),
    year1: int = Query(2024),
    year2: int = Query(2030),
    service: ConsommationService = Depends(get_consommation_service)
):
    """
    Récupère la consommation par usage pour deux années de comparaison
    """
    region_param = None if region == "all" else int(region)
    return await service.get_consumption_by_usage(region_param, year1, year2)


@router.get("/centres")
async def get_centres_consumption_prediction(
    region: Optional[str] = Query("all"),
    limit: int = Query(10, ge=1, le=50),
    year: int = Query(2024, description="Année de référence pour la consommation"),
    service: ConsommationService = Depends(get_consommation_service)
):
    """
    Récupère les prédictions de consommation par centre
    """
    region_param = None if region == "all" else int(region)
    return await service.get_centres_prediction(region_param, limit, year)


@router.get("/features")
async def get_features_importance(
    service: ConsommationService = Depends(get_consommation_service)
):
    """
    Récupère l'importance des features du modèle
    """
    return await service.get_features_importance()


@router.get("/stats")
async def get_consommation_stats(
    region: Optional[str] = Query("all"),
    year: int = Query(2024, description="Année de référence"),
    service: ConsommationService = Depends(get_consommation_service)
):
    """
    Récupère les statistiques globales de consommation
    """
    region_param = None if region == "all" else int(region)
    return await service.get_stats(region_param, year)