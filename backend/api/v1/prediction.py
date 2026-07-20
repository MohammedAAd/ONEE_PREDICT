"""
backend/api/v1/prediction.py
=============================
Router des previsions ONEE — sert les artefacts du modele ML (fichiers JSON).
Aucune base de donnees : tout vient de PredictionService (artefacts en memoire).

Monte sous le prefixe /api/v1 -> endpoints accessibles sur /api/v1/prediction/...
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List

from backend.services.prediction_service import PredictionService, CIBLES_VALIDES

router = APIRouter(prefix="/prediction", tags=["Prevision"])


def _svc() -> PredictionService:
    return PredictionService.get()


@router.get("/")
def get_all():
    """Charge tout d'un coup (pratique pour l'initialisation du front)."""
    return _svc().get_all()


@router.get("/model-info")
def model_info():
    """Etat des artefacts charges (controle d'integrite de la livraison)."""
    return _svc().model_info()


@router.post("/reload")
def reload_artefacts():
    """Recharge les artefacts depuis le disque (apres un nouvel export)."""
    s = PredictionService.reload()
    return {"reloaded": True, "compteurs": s.model_info()["compteurs"]}


@router.get("/previsions-annuelles")
def previsions_annuelles(
    centre_id: Optional[str] = Query(None, description="Filtrer sur un centre"),
    cible: Optional[str] = Query(None, description="distribution | production | consommation_totale"),
    region: Optional[str] = Query(None, description="Filtrer sur une region"),
    zones: Optional[List[str]] = Query(None, description="Filtrer sur une ou plusieurs zones"),
    annee_debut: Optional[int] = Query(None),
    annee_fin: Optional[int] = Query(None),
):
    """Previsions annuelles {id_centre_desservi, annee, cible, q10, q50, q90}."""
    if cible and cible not in CIBLES_VALIDES:
        raise HTTPException(400, f"cible invalide. Attendu: {', '.join(CIBLES_VALIDES)}")
    return _svc().get_previsions_annuelles(centre_id, annee_debut, annee_fin, cible, region, zones)


@router.get("/previsions-mensuelles")
def previsions_mensuelles(
    installation: Optional[str] = Query(None),
    annee: Optional[int] = Query(None),
):
    """Previsions mensuelles {installation, annee, mois, volume_cible, q10, q90,
    capacite_m3, saturation}."""
    return _svc().get_previsions_mensuelles(installation, annee)


@router.get("/previsions-dr")
def previsions_par_dr(
    dr_id: Optional[str] = Query(None),
    annee: Optional[int] = Query(None),
):
    """Previsions agregees par Direction Regionale."""
    return _svc().get_previsions_par_dr(dr_id, annee)


@router.get("/historique")
def historique(centre_id: Optional[str] = Query(None),
               cible: str = Query("consommation_totale"),
               region: Optional[str] = Query(None)):
    """Serie reelle annuelle (master_panel) — pour les courbes Prevu vs Reel."""
    if cible not in CIBLES_VALIDES:
        raise HTTPException(400, f"cible invalide. Attendu: {', '.join(CIBLES_VALIDES)}")
    return _svc().get_historique(centre_id, cible, region)


@router.get("/shap-global")
def shap_global(cible: Optional[str] = Query(None)):
    """Importance globale des variables (SHAP) — repond a 'quelles variables comptent'."""
    if cible and cible not in CIBLES_VALIDES:
        raise HTTPException(400, f"cible invalide. Attendu: {', '.join(CIBLES_VALIDES)}")
    return _svc().get_shap_global(cible)


@router.get("/shap-par-centre")
def shap_par_centre(
    centre_id: Optional[str] = Query(None),
    cible: Optional[str] = Query(None),
):
    """Top facteurs SHAP par centre — panneau 'moteurs' du tableau de bord."""
    return _svc().get_shap_par_centre(centre_id, cible)


@router.get("/centres")
def liste_centres():
    """Liste des centres (id, libelle, DR, region) pour les filtres."""
    return _svc().get_liste_centres()


@router.get("/drs")
def liste_dr():
    """Liste des Directions Regionales pour les filtres."""
    return _svc().get_liste_dr()


@router.get("/installations")
def liste_installations():
    """Installations disponibles pour les scénarios de capacité."""
    return _svc().get_liste_installations()
