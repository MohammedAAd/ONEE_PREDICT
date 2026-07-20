"""
backend/api/v1/scenario.py
===========================
Router du MOTEUR DE SCENARIOS ONEE.

POST /api/v1/scenario/  -> applique les leviers et renvoie baseline vs scenario
                           sur les 3 niveaux (demande annuelle, capacite mensuelle, bilan).
GET  /api/v1/scenario/exemple  -> exemple de corps de requete.

Bornes (cahier des charges "Parametres de Scenarios") validees par Pydantic.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List

from backend.services.prediction_service import PredictionService
from backend.services import scenario_engine

router = APIRouter(prefix="/scenario", tags=["Scenarios"])


# --------------------------------------------------------------- modeles d'entree
class Reaffectation(BaseModel):
    """Changement d'affectation : rattacher une installation a une autre DR."""
    installation: str
    nouvelle_dr: str
    annee_debut: int = 2025


class ScenarioRequest(BaseModel):
    # --- Niveau 1 : Centre desservi (demande, horizon n+30) ---
    cible: str = Field("consommation_totale",
                       description="distribution | production | consommation_totale")
    centre_id: Optional[str] = Field(None, description="None = tous les centres")
    centre_ids: List[str] = Field(default_factory=list, description="Groupe explicite de centres")
    taux_accroissement: Optional[float] = Field(
        None, ge=-5, le=15, description="Taux d'accroissement population (%/an)")
    rendement_distribution: Optional[float] = Field(
        None, ge=30, le=95, description="Rendement de distribution cible (%)")
    rendement_adduction: Optional[float] = Field(
        None, ge=60, le=100, description="Rendement d'adduction cible (%)")
    taux_branchement: Optional[float] = Field(
        None, ge=5, le=100, description="Taux de branchement cible (%)")
    dotation_pct: Optional[float] = Field(
        None, ge=-50, le=100, description="Variation de dotation par rapport a la reference (%)")
    tourisme_pct: Optional[float] = Field(
        None, ge=0, le=100, description="Surcharge touristique appliquee a la demande (%)")
    industrie_m3_an: Optional[float] = Field(
        None, ge=0, description="Demande industrielle additionnelle (m3/an)")
    annee_debut_industrie: Optional[int] = Field(
        None, ge=2024, le=2060, description="Annee de debut de la demande industrielle")
    annee_horizon: int = Field(2054, ge=2024, le=2060, description="Horizon (n+30)")

    # --- Niveau 2 : Installation (capacite, horizon m+12) ---
    installation: Optional[str] = Field(None, description="None = toutes les installations")
    annee_mensuel: Optional[int] = Field(None, description="Annee des previsions mensuelles")
    delta_capacite_pct: Optional[float] = Field(
        None, ge=-100, le=300, description="Variation de capacite de production (%)")
    stress_ressource_pct: Optional[float] = Field(
        None, ge=0, le=100, description="Reduction de ressource exploitable (secheresse, %)")
    annee_debut_stress: Optional[int] = Field(
        None, ge=2024, le=2060, description="Annee de debut du stress sur la ressource")
    duree_stress_ans: Optional[int] = Field(
        None, ge=1, le=30, description="Duree du stress sur la ressource (annees)")
    maintenance_pct: Optional[float] = Field(
        None, ge=0, le=100, description="Indisponibilite temporaire de capacite (%)")
    capacite_absolue: Optional[float] = Field(
        None, ge=0, description="Capacite imposee (m3/mois), prioritaire sur le delta")
    capacite_additionnelle_m3: Optional[float] = Field(
        None, ge=0, description="Capacite additionnelle disponible (m3/mois)")
    capacite_additionnelle_libelle: Optional[str] = Field(
        None, description="Libelle de la ressource additionnelle")
    capacite_additionnelle_ulterieure_m3: Optional[float] = Field(
        None, ge=0, description="Capacité mensuelle qui sera disponible ultérieurement")
    annee_debut_capacite_ulterieure: Optional[int] = Field(
        None, ge=2024, le=2060, description="Année de mise en service de la capacité ultérieure")
    cout_unitaire_capex_mad_m3_an: float = Field(
        0, ge=0, description="Hypothese parametrique de CAPEX (MAD par m3/an ajoute)")

    # --- Niveau 3 : Groupe de centres (bilan + affectation) ---
    reaffectations: List[Reaffectation] = Field(default_factory=list)


_CIBLES = ("distribution", "production", "consommation_totale")


def _dump(model) -> dict:
    """Compatibilite Pydantic v1 (.dict) / v2 (.model_dump)."""
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


@router.post("/")
def simuler(req: ScenarioRequest):
    """Execute un scenario et renvoie baseline vs scenario sur les 3 niveaux."""
    params = _dump(req)
    if params.get("cible") not in _CIBLES:
        params["cible"] = "consommation_totale"
    params["reaffectations"] = [_dump(r) for r in req.reaffectations]
    return scenario_engine.executer_scenario(PredictionService.get(), params)


@router.get("/parametres-centre/{centre_id}")
def parametres_centre(centre_id: str):
    """Moyennes historiques à utiliser comme valeurs initiales d'un centre.

    Les valeurs restent seulement des suggestions : le client peut ensuite les
    ajuster librement avant de lancer la simulation.
    """
    service = PredictionService.get()
    valeurs = scenario_engine.moyennes_parametres_centre(service.historique, centre_id)
    return {"centre_id": centre_id, **valeurs}


@router.get("/exemple")
def exemple():
    """Exemple de corps de requete pour POST /api/v1/scenario/."""
    return {
        "description": "Copier ce JSON dans le corps d'un POST /api/v1/scenario/",
        "exemple": {
            "cible": "consommation_totale",
            "centre_id": None,
            "taux_accroissement": 3.5,
            "rendement_distribution": 85,
            "rendement_adduction": 90,
            "taux_branchement": 95,
            "annee_horizon": 2054,
            "delta_capacite_pct": 10,
            "capacite_additionnelle_m3": 0,
            "capacite_additionnelle_libelle": "",
            "annee_mensuel": None,
            "reaffectations": [
                {"installation": "EXEMPLE_INST", "nouvelle_dr": "DR9", "annee_debut": 2026}
            ],
        },
    }
