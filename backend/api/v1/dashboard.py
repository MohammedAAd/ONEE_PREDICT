# backend/api/v1/dashboard.py
from fastapi import APIRouter, Depends, Query
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from backend.app.database import get_db
from backend.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

async def get_dashboard_service(db: AsyncSession = Depends(get_db)):
    return DashboardService(db)

@router.get("/")
async def get_dashboard_data(
    region: str = Query("all", description="Code région ou 'all'"),
    start_year: int = Query(2020, ge=2000, le=2035),
    end_year: int = Query(2030, ge=2000, le=2035),
    mode: str = Query("pred", regex="^(real|pred)$", description="real: historique, pred: prévisions"),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère toutes les données pour le dashboard ONEE"""
    data = await service.get_dashboard_data(region, start_year, end_year, mode)
    return data

# 🔥 NOUVEAU ENDPOINT - Récupère la liste des régions
@router.get("/regions")
async def get_regions(
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, str]]:
    """
    Récupère la liste de toutes les régions depuis la base de données
    """
    query = text("""
        SELECT 
            code_region_12 as code,
            libellé_region as name
        FROM regions
        ORDER BY libellé_region
    """)
    
    result = await db.execute(query)
    regions = [{"code": row.code, "name": row.name} for row in result]
    
    # Ajouter l'option "Toutes les régions" au début
    return [{"code": "all", "name": "Toutes les régions"}] + regions

@router.get("/timeseries")
async def get_timeseries(
    region: str = Query("all"),
    start_year: int = Query(2020),
    end_year: int = Query(2030),
    mode: str = Query("pred"),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère les données de timeseries (Consommation vs Production)"""
    return await service._get_timeseries(region, start_year, end_year, mode)

@router.get("/timeseries/detail")
async def get_timeseries_detail(
    region: str = Query("all"),
    start_year: int = Query(2020),
    end_year: int = Query(2030),
    mode: str = Query("pred"),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère les données détaillées (Production/Distribution/Consommation)"""
    return await service._get_timeseries_detail(region, start_year, end_year, mode)

@router.get("/stats")
async def get_stats(
    region: str = Query("all"),
    year: int = Query(2030),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère les statistiques globales"""
    return await service._get_statistics(region, year)

@router.get("/bilan/zones")
async def get_bilan_zones(
    region: str = Query("all"),
    year: int = Query(2024),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère le bilan par zone"""
    return await service._get_bilan_by_zone(region, year)

@router.get("/bilan/provinces")
async def get_bilan_provinces(
    region: str = Query("all"),
    year: int = Query(2024),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère le bilan par province"""
    return await service._get_bilan_by_province(region, year)

@router.get("/bilan/regions")
async def get_bilan_regions(
    year: int = Query(2024),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère le bilan par région"""
    return await service._get_bilan_by_region(year)

@router.get("/rendements")
async def get_rendements(
    region: str = Query("all"),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère les rendements réseau"""
    return await service._get_rendements(region)

@router.get("/alerts")
async def get_alerts(
    region: str = Query("all"),
    service: DashboardService = Depends(get_dashboard_service)
):
    """Récupère les alertes actives"""
    return await service._get_alerts(region)

@router.get("/zones/by-region")
async def get_zones_by_region(
    region: str = Query("all"),
    year: int = Query(2024),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupère la liste des zones (centres desservis) filtrées par région
    """
    query = text("""
        SELECT DISTINCT cd.lib_centre_desservi as zone
        FROM centres_desservis cd
        JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
        JOIN communes_2024 com ON c.code_commune = com.code_commune
        JOIN provinces p ON com.code_province = p.id_province
    """)
    
    params = {}
    
    if region != "all":
        query = text("""
            SELECT DISTINCT cd.lib_centre_desservi as zone
            FROM centres_desservis cd
            JOIN ref_centres_hcp_2024 c ON cd.id_centre_desservi = c.id_centre_desservi
            JOIN communes_2024 com ON c.code_commune = com.code_commune
            JOIN provinces p ON com.code_province = p.id_province
            JOIN regions r ON p.code_region_12 = r.code_region_12
            WHERE r.code_region_12 = :region
            ORDER BY cd.lib_centre_desservi
        """)
        params["region"] = region
    else:
        query = text("""
            SELECT DISTINCT cd.lib_centre_desservi as zone
            FROM centres_desservis cd
            ORDER BY cd.lib_centre_desservi
        """)
    
    result = await db.execute(query, params)
    zones = [row.zone for row in result]
    
    return {"zones": zones, "total": len(zones), "region": region}