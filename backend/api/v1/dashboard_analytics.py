from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.services.dashboard_analytics_service import DashboardAnalyticsService

router = APIRouter(prefix="/dashboard/analytics", tags=["Dashboard Analytics"])


async def get_analytics_service(db: AsyncSession = Depends(get_db)):
    return DashboardAnalyticsService(db)


@router.get("/taux-branchement")
async def get_taux_branchement(
    region: Optional[str] = Query("all"),
    start_year: int = Query(2015),
    end_year: int = Query(2030),
    service: DashboardAnalyticsService = Depends(get_analytics_service)
):
    """Taux de branchement moyen (%) par année"""
    region_param = None if region == "all" else int(region)
    return await service.get_taux_branchement_moyen(region_param, start_year, end_year)


@router.get("/rendement-distribution")
async def get_rendement_distribution(
    region: Optional[str] = Query("all"),
    start_year: int = Query(2015),
    end_year: int = Query(2030),
    service: DashboardAnalyticsService = Depends(get_analytics_service)
):
    """Rendement de distribution par année (%)"""
    region_param = None if region == "all" else int(region)
    return await service.get_rendement_distribution(region_param, start_year, end_year)


@router.get("/scatter-rendement-taux")
async def get_scatter_rendement_taux(
    region: Optional[str] = Query("all"),
    year: int = Query(2024),
    service: DashboardAnalyticsService = Depends(get_analytics_service)
):
    """Scatter plot: Rendement distribution vs Taux branchement"""
    region_param = None if region == "all" else int(region)
    return await service.get_scatter_rendement_vs_taux(region_param, year)


@router.get("/scatter-dotation-bf-pop")
async def get_scatter_dotation_bf_pop(
    region: Optional[str] = Query("all"),
    year: int = Query(2024),
    service: DashboardAnalyticsService = Depends(get_analytics_service)
):
    """Scatter plot: Dotation BF vs Population branchée"""
    region_param = None if region == "all" else int(region)
    return await service.get_dotation_bf_vs_pop(region_param, year)


@router.get("/dotations-annuelles")
async def get_dotations_annuelles(
    region: Optional[str] = Query("all"),
    start_year: int = Query(2015),
    end_year: int = Query(2030),
    service: DashboardAnalyticsService = Depends(get_analytics_service)
):
    """Dotations nette et brute par année (L/j/hab)"""
    region_param = None if region == "all" else int(region)
    return await service.get_dotations_annuelles(region_param, start_year, end_year)