# backend/api/v1/dashboard_new.py - VERSION CORRIGÉE

from fastapi import APIRouter, Depends, Query
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from backend.app.database import get_db
from backend.services.dashboard_new_service import DashboardNewService
from backend.services.consumption_new_service import ConsumptionNewService

router = APIRouter(prefix="/dashboard/v2", tags=["Dashboard V2"])


async def get_dashboard_new_service(db: AsyncSession = Depends(get_db)):
    return DashboardNewService(db)


async def get_consumption_new_service(db: AsyncSession = Depends(get_db)):
    return ConsumptionNewService(db)


# ============================================================
# ROUTES PRINCIPALES
# ============================================================

@router.get("/regions")
async def get_regions(db: AsyncSession = Depends(get_db)) -> List[Dict[str, str]]:
    """Récupère la liste des régions depuis master_panel"""
    query = text("""
        SELECT DISTINCT 
            code_region_12 as code,
            libelle_region as name
        FROM master_panel
        WHERE code_region_12 IS NOT NULL
        AND libelle_region IS NOT NULL
        ORDER BY libelle_region
    """)
    
    result = await db.execute(query)
    regions = []
    for row in result:
        # Convertir le code en string
        code_str = str(row.code) if row.code is not None else "all"
        regions.append({"code": code_str, "name": row.name})
    
    # Ajouter l'option "Toutes les régions" au début
    return [{"code": "all", "name": "Toutes les régions"}] + regions

@router.get("/")
async def get_dashboard_data(
    region: str = Query("all"),
    start_year: int = Query(2020, ge=2000, le=2035),
    end_year: int = Query(2030, ge=2000, le=2035),
    mode: str = Query("pred", regex="^(real|pred)$"),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    region_param = None if region == "all" else int(region)
    return await service.get_dashboard_data(region_param, start_year, end_year, mode)


# ============================================================
# ROUTES MASTER PANEL - AVEC CONVERSION DE REGION
# ============================================================

@router.get("/master/timeseries")
async def get_master_timeseries(
    region: str = Query("all"),
    start_year: int = Query(2020),
    end_year: int = Query(2030),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère les séries temporelles depuis master_panel"""
    region_param = None if region == "all" else int(region)
    return await service._get_timeseries(region_param, start_year, end_year, "real", zones)


@router.get("/master/timeseries-detail")
async def get_master_timeseries_detail(
    region: str = Query("all"),
    start_year: int = Query(2020),
    end_year: int = Query(2030),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère les séries détaillées depuis master_panel"""
    region_param = None if region == "all" else int(region)
    return await service._get_timeseries_detail(region_param, start_year, end_year, "real", zones)


@router.get("/master/stats")
async def get_master_stats(
    region: str = Query("all"),
    year: int = Query(2024),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère les statistiques depuis master_panel"""
    region_param = None if region == "all" else int(region)
    return await service._get_statistics(region_param, year, zones)


@router.get("/master/bilan/zones")
async def get_master_bilan_zones(
    region: str = Query("all"),
    year: int = Query(2024),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère le bilan par zone depuis master_panel"""
    region_param = None if region == "all" else int(region)
    return await service._get_bilan_by_zone(region_param, year, zones)


@router.get("/master/bilan/provinces")
async def get_master_bilan_provinces(
    region: str = Query("all"),
    year: int = Query(2024),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère le bilan par province depuis master_panel"""
    region_param = None if region == "all" else int(region)
    return await service._get_bilan_by_province(region_param, year, zones)


@router.get("/master/bilan/regions")
async def get_master_bilan_regions(
    year: int = Query(2024),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère le bilan par région depuis master_panel"""
    return await service._get_bilan_by_region(year)


@router.get("/master/rendements")
async def get_master_rendements(
    region: str = Query("all"),
    year: int = Query(2024, ge=2000, le=2100),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère les rendements depuis master_panel"""
    region_param = None if region == "all" else int(region)
    return await service._get_rendements(region_param, year, zones)


@router.get("/master/alerts")
async def get_master_alerts(
    region: str = Query("all"),
    year: int = Query(2024, ge=2000, le=2100),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère les alertes depuis master_panel"""
    region_param = None if region == "all" else int(region)
    return await service._get_alerts(region_param, year)


@router.get("/master/vulnerability")
async def get_master_vulnerability(
    region: str = Query("all"),
    year: int = Query(2024, ge=2000, le=2100),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère les indicateurs de vulnérabilité réseau"""
    region_param = None if region == "all" else int(region)
    return await service._get_vulnerability(region_param, year, zones)


@router.get("/master/centres")
async def get_master_centres(
    region: str = Query("all"),
    year: int = Query(2024, ge=2000, le=2100),
    zones: Optional[List[str]] = Query(None),
    service: DashboardNewService = Depends(get_dashboard_new_service)
):
    """Récupère la liste des centres depuis master_panel"""
    region_param = None if region == "all" else int(region)
    payload = await service._get_centres(region_param, year, zones)
    # Les anomalies d'installation sont retournées avec les données : elles ne
    # doivent pas masquer les centres ni provoquer le repli vers une ancienne
    # route aux unités différentes.
    return payload


# ============================================================
# ROUTES FACT LONG
# ============================================================

@router.get("/consommation/types")
async def get_consommation_by_type(
    centre_id: Optional[str] = Query(None),
    region: str = Query("all"),
    start_year: int = Query(2020),
    end_year: int = Query(2030),
    zones: Optional[List[str]] = Query(None),
    service: ConsumptionNewService = Depends(get_consumption_new_service)
):
    """Récupère la consommation par type depuis fact_long"""
    region_param = None if region == "all" else int(region)
    return await service.get_consommation_by_type(centre_id, region_param, start_year, end_year, zones)


@router.get("/consommation/totale")
async def get_consommation_totale_by_type(
    year: int = Query(2024),
    region: str = Query("all"),
    service: ConsumptionNewService = Depends(get_consumption_new_service)
):
    """Récupère la consommation totale par type pour une année"""
    region_param = None if region == "all" else int(region)
    return await service.get_consommation_totale_by_type(year, region_param)


@router.get("/consommation/centre/{centre_id}")
async def get_consommation_by_centre_id(
    centre_id: str,
    start_year: int = Query(2020),
    end_year: int = Query(2030),
    service: ConsumptionNewService = Depends(get_consumption_new_service)
):
    """Récupère la consommation par type pour un centre spécifique"""
    return await service.get_consommation_by_centre(centre_id, start_year, end_year)


# ============================================================
# ROUTES POUR LES CENTRES
# ============================================================

@router.get("/centres")
async def get_centres_by_region(
    region: str = Query("all"),
    year: int = Query(2024),
    db: AsyncSession = Depends(get_db)
):
    """Récupère la liste des centres depuis master_panel"""
    
    if region == "all":
        query = text("""
            SELECT DISTINCT
                mp.id_centre_desservi as id,
                mp.lib_centre_uniformise as name,
                mp.type_centre,
                mp.sa_centre,
                mp.population_2024 as population,
                mp.menages_2024 as menages,
                mp.lib_commune as commune,
                mp.lib_province as province,
                mp.libelle_region as region_name,
                mp.code_region_12 as region_code,
                mp.milieu,
                mp.rend_distribution,
                mp.rend_adduction,
                mp.taux_branchement,
                mp.production,
                mp.distribution,
                mp.cons_pop_branchee as consommation,
                CASE 
                    WHEN (CASE WHEN mp.rend_distribution <= 1 THEN mp.rend_distribution * 100 ELSE mp.rend_distribution END) < 70 THEN 'deficit'
                    WHEN (CASE WHEN mp.rend_distribution <= 1 THEN mp.rend_distribution * 100 ELSE mp.rend_distribution END) < 85 THEN 'warn'
                    ELSE 'ok'
                END as status
            FROM master_panel mp
            WHERE mp.annee = :year
        """)
        params = {"year": year}
    else:
        # Convertir region en entier
        region_int = int(region)
        query = text("""
            SELECT DISTINCT
                mp.id_centre_desservi as id,
                mp.lib_centre_uniformise as name,
                mp.type_centre,
                mp.sa_centre,
                mp.population_2024 as population,
                mp.menages_2024 as menages,
                mp.lib_commune as commune,
                mp.lib_province as province,
                mp.libelle_region as region_name,
                mp.code_region_12 as region_code,
                mp.milieu,
                mp.rend_distribution,
                mp.rend_adduction,
                mp.taux_branchement,
                mp.production,
                mp.distribution,
                mp.cons_pop_branchee as consommation,
                CASE 
                    WHEN (CASE WHEN mp.rend_distribution <= 1 THEN mp.rend_distribution * 100 ELSE mp.rend_distribution END) < 70 THEN 'deficit'
                    WHEN (CASE WHEN mp.rend_distribution <= 1 THEN mp.rend_distribution * 100 ELSE mp.rend_distribution END) < 85 THEN 'warn'
                    ELSE 'ok'
                END as status
            FROM master_panel mp
            WHERE mp.code_region_12 = :region
            AND mp.annee = :year
        """)
        params = {"region": region_int, "year": year}
    
    result = await db.execute(query, params)
    rows = result.fetchall()
    
    centres = []
    for row in rows:
        centres.append({
            "id": str(row.id) if row.id else None,
            "name": str(row.name) if row.name else None,
            "type_centre": str(row.type_centre) if row.type_centre else None,
            "sa_centre": str(row.sa_centre) if row.sa_centre else None,
            "population": float(row.population) if row.population else 0,
            "menages": float(row.menages) if row.menages else 0,
            "commune": str(row.commune) if row.commune else None,
            "province": str(row.province) if row.province else None,
            "region_name": str(row.region_name) if row.region_name else None,
            "region_code": str(row.region_code) if row.region_code else None,
            "milieu": str(row.milieu) if row.milieu else None,
            "rend_distribution": float(row.rend_distribution) if row.rend_distribution else 0,
            "rend_adduction": float(row.rend_adduction) if row.rend_adduction else 0,
            "taux_branchement": float(row.taux_branchement) if row.taux_branchement else 0,
            "production": float(row.production) if row.production else 0,
            "distribution": float(row.distribution) if row.distribution else 0,
            "consommation": float(row.consommation) if row.consommation else 0,
            "status": str(row.status) if row.status else "ok"
        })
    
    return {"centres": centres, "total": len(centres), "region": region}


@router.get("/zones/by-region")
async def get_zones_by_region(
    region: str = Query("all"),
    year: int = Query(2024),
    db: AsyncSession = Depends(get_db)
):
    """Récupère la liste des zones par région depuis master_panel"""
    
    if region == "all":
        query = text("""
            SELECT DISTINCT mp.lib_centre_uniformise as zone
            FROM master_panel mp
            WHERE mp.annee = :year
            AND mp.lib_centre_uniformise IS NOT NULL
            ORDER BY mp.lib_centre_uniformise
        """)
        params = {"year": year}
    else:
        region_int = int(region)
        query = text("""
            SELECT DISTINCT mp.lib_centre_uniformise as zone
            FROM master_panel mp
            WHERE mp.code_region_12 = :region
            AND mp.annee = :year
            AND mp.lib_centre_uniformise IS NOT NULL
            ORDER BY mp.lib_centre_uniformise
        """)
        params = {"region": region_int, "year": year}
    
    result = await db.execute(query, params)
    zones = [str(row.zone) for row in result if row.zone]
    
    return {"zones": zones, "total": len(zones), "region": region}
