"""
backend/services/prediction_service.py
========================================
Service de prevision ONEE — sert les artefacts du modele ML (fichiers JSON)
produits par le notebook (dossier livraison_react). AUCUNE base de donnees requise.

Architecture retenue : "serve forecasts + scenario levers".
  - Les previsions sont precalculees (sortie reelle du modele) -> on les sert.
  - modele_onee.pkl n'est PAS charge en memoire de l'API (mode leger, pas de
    lightgbm/catboost au runtime). Il reste dans artefacts/ pour archive.

Artefacts attendus dans backend/ml/artefacts/ :
  previsions_annuelles.json, previsions_mensuelles.json, previsions_par_dr.json,
  shap_global.json, shap_par_centre.json, dim_centres.json
+ master_panel.csv (racine du depot OU artefacts/) pour l'historique reel.
"""
import json
import csv
import unicodedata
from pathlib import Path
from typing import Optional, List, Dict, Any

# backend/services/ -> backend/ml/artefacts/
ARTEFACTS_DIR = Path(__file__).resolve().parent.parent / "ml"
# racine du depot (master_panel.csv y est livre par defaut)
REPO_ROOT = Path(__file__).resolve().parents[2]

CIBLES_VALIDES = ("distribution", "production", "consommation_totale")


# ------------------------------------------------------------------ utilitaires
def _load_json(name: str, default):
    """Charge un artefact JSON depuis artefacts/ ou la racine du depot."""
    for base in (ARTEFACTS_DIR, REPO_ROOT):
        p = base / name
        if p.exists():
            try:
                with open(p, encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:  # noqa: BLE001
                print(f"[PredictionService] Erreur lecture {p}: {e}")
                return default
    print(f"[PredictionService] Artefact introuvable: {name} "
          f"(attendu dans {ARTEFACTS_DIR})")
    return default


def _to_float(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except (ValueError, TypeError):
        return None


def _centre_id(row: Dict) -> str:
    """Identifiant de centre, tolerant aux variantes de nommage des colonnes."""
    for k in ("id_centre_desservi", "id_centre", "centre_id", "centre", "id"):
        if k in row and row[k] not in (None, ""):
            return str(row[k]).strip()
    return ""


def _dr_id(row: Dict) -> str:
    """Identifiant de Direction Regionale, tolerant aux variantes."""
    for k in ("id_dr", "dr", "id_dr_admin", "direction_regionale"):
        if k in row and row[k] not in (None, ""):
            return str(row[k]).strip()
    return ""


def _norm_text(value: Optional[str]) -> str:
        """Normalise un libelle texte pour comparaisons robustes (accents/casse/espaces)."""
        raw = str(value or "").strip().lower()
        if not raw:
            return ""
        no_accents = "".join(
                c for c in unicodedata.normalize("NFD", raw)
                if unicodedata.category(c) != "Mn"
        )
        return " ".join(no_accents.replace("-", " ").split())


# --------------------------------------------------------------------- service
class PredictionService:
    """Charge les artefacts une seule fois (singleton) et les sert filtres."""

    _instance: Optional["PredictionService"] = None

    def __init__(self):
        self.annuelles: List[Dict] = _load_json("previsions_annuelles.json", [])
        self.mensuelles: List[Dict] = _load_json("previsions_mensuelles.json", [])
        self.par_dr: List[Dict] = _load_json("previsions_par_dr.json", [])
        self.shap_global: Dict = _load_json("shap_global.json", {})
        self.shap_centre: List[Dict] = _load_json("shap_par_centre.json", [])
        self.dim_centres: List[Dict] = _load_json("dim_centres.json", [])
        self.historique: List[Dict] = self._charger_historique()
        print(f"[PredictionService] OK — {len(self.annuelles)} prev. annuelles · "
              f"{len(self.mensuelles)} mensuelles · {len(self.par_dr)} par DR · "
              f"{len(self.historique)} lignes historiques")

    @classmethod
    def get(cls) -> "PredictionService":
        """Acces singleton : charge les artefacts au premier appel seulement."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reload(cls) -> "PredictionService":
        """Force le rechargement des artefacts (apres un nouvel export)."""
        cls._instance = None
        return cls.get()

    # ----------------------------------------- historique reel (master_panel)
    def _charger_historique(self) -> List[Dict]:
        """Charge master_panel.csv -> series reelles pour les courbes Prevu vs Reel."""
        for p in (ARTEFACTS_DIR / "master_panel.csv", REPO_ROOT / "master_panel.csv"):
            if p.exists():
                rows: List[Dict] = []
                with open(p, encoding="utf-8") as f:
                    for r in csv.DictReader(f):
                        annee = _to_float(r.get("annee"))
                        rows.append({
                            "id_centre_desservi": str(r.get("id_centre_desservi", "")).strip(),
                            "annee": int(annee) if annee is not None else None,
                            "distribution": _to_float(r.get("distribution")),
                            "production": _to_float(r.get("production")),
                            "consommation_totale": _to_float(r.get("consommation_totale")),
                            "dr": str(r.get("dr", "")).strip(),
                            "rend_distribution": _to_float(r.get("rend_distribution")),
                            "rend_adduction": _to_float(r.get("rend_adduction")),
                            "taux_branchement": _to_float(r.get("taux_branchement")),
                            "population_interp": _to_float(r.get("population_interp")),
                            "libelle_region": str(r.get("libelle_region", "")).strip(),
                        })
                print(f"[PredictionService] Historique charge: {p.name} ({len(rows)} lignes)")
                return rows
        print("[PredictionService] master_panel.csv introuvable — "
              "historique & baselines de scenario limites aux valeurs par defaut")
        return []

    # ------------------------------------------------------- previsions annuelles
    def get_previsions_annuelles(self, centre_id: Optional[str] = None,
                                 annee_debut: Optional[int] = None,
                                 annee_fin: Optional[int] = None,
                                 cible: Optional[str] = None,
                                 region: Optional[str] = None) -> List[Dict]:
        out = self.annuelles
        if centre_id:
            cid = str(centre_id).strip()
            out = [r for r in out if _centre_id(r) == cid]
        if region:
            # Filtre par region sur base dim_centres (artefact reel du modele).
            target = _norm_text(region)
            allowed_centres = {
                _centre_id(r)
                for r in self.dim_centres
                if _centre_id(r) and _norm_text(r.get("region") or r.get("libelle_region")) == target
            }
            out = [r for r in out if _centre_id(r) in allowed_centres]
        if cible:
            out = [r for r in out if str(r.get("cible", "")) == cible]
        if annee_debut is not None:
            out = [r for r in out if int(r.get("annee", 0) or 0) >= annee_debut]
        if annee_fin is not None:
            out = [r for r in out if int(r.get("annee", 0) or 0) <= annee_fin]
        return out

    # ------------------------------------------------------ previsions mensuelles
    def get_previsions_mensuelles(self, installation: Optional[str] = None,
                                  annee: Optional[int] = None) -> List[Dict]:
        out = self.mensuelles
        if installation:
            ins = str(installation).strip()
            out = [r for r in out if str(r.get("installation", "")).strip() == ins]
        if annee is not None:
            out = [r for r in out if int(r.get("annee", 0) or 0) == int(annee)]
        return out

    # ------------------------------------------------------------ previsions DR
    def get_previsions_par_dr(self, dr_id: Optional[str] = None,
                              annee: Optional[int] = None) -> List[Dict]:
        out = self.par_dr
        if dr_id:
            d = str(dr_id).strip()
            out = [r for r in out if _dr_id(r) == d]
        if annee is not None:
            out = [r for r in out if int(r.get("annee", 0) or 0) == int(annee)]
        return out

    # -------------------------------------------------------------- SHAP global
    def get_shap_global(self, cible: Optional[str] = None) -> Any:
        sg = self.shap_global
        if cible and isinstance(sg, dict):
            cibles = sg.get("cibles", sg)
            if isinstance(cibles, dict):
                return cibles.get(cible, {})
        return sg

    # ----------------------------------------------------------- SHAP par centre
    def get_shap_par_centre(self, centre_id: Optional[str] = None,
                            cible: Optional[str] = None) -> List[Dict]:
        out = self.shap_centre
        if centre_id:
            cid = str(centre_id).strip()
            out = [r for r in out if _centre_id(r) == cid]
        if cible:
            out = [r for r in out if str(r.get("cible", "")) == cible]
        return out

    # --------------------------------------------------- historique reel (serie)
    def get_historique(self, centre_id: Optional[str] = None,
                       cible: str = "consommation_totale",
                       region: Optional[str] = None) -> List[Dict]:
        """Serie reelle annuelle pour les courbes Prevu vs Reel.

        - Un centre : serie brute, annees de tete a 0 retirees.
        - Une region (ou tout) : agrege la cohorte de prevision (restreinte a la
          region si demandee) sur les seules annees largement couvertes."""
        if cible not in CIBLES_VALIDES:
            cible = "consommation_totale"

        if centre_id:
            cid = str(centre_id).strip()
            rows = sorted([r for r in self.historique
                           if r["id_centre_desservi"] == cid and r.get("annee") is not None],
                          key=lambda r: r["annee"])
            serie = [{"annee": r["annee"], "valeur": round(r[cible], 1)}
                     for r in rows if r.get(cible) is not None]
            while serie and serie[0]["valeur"] <= 0:
                serie.pop(0)
            return serie

        ANNEE_MIN, COUVERTURE_MIN = 2012, 0.80
        cohorte = {_centre_id(r) for r in self.annuelles}
        cohorte.discard("")
        if region:
            target = _norm_text(region)
            reg = {
                _centre_id(r): _norm_text(r.get("region") or r.get("libelle_region"))
                for r in self.dim_centres
            }
            cohorte = {c for c in cohorte if reg.get(c) == target}
        n = max(len(cohorte), 1)
        somme: Dict[int, float] = {}
        couv: Dict[int, int] = {}
        for r in self.historique:
            an, v = r.get("annee"), r.get(cible)
            if (r["id_centre_desservi"] not in cohorte or an is None
                    or v is None or an < ANNEE_MIN):
                continue
            somme[an] = somme.get(an, 0.0) + v
            couv[an] = couv.get(an, 0) + 1
        return [{"annee": a, "valeur": round(somme[a], 1)}
                for a in sorted(somme) if couv[a] / n >= COUVERTURE_MIN]

    # ----------------------------------------------------------- listes (filtres)
    def get_liste_centres(self) -> List[Dict]:
        out: List[Dict] = []
        for r in self.dim_centres:
            cid = _centre_id(r)
            if not cid:
                continue
            out.append({
                "id": cid,
                "label": (r.get("lib_centre_uniformise") or r.get("lib_centre")
                          or r.get("label") or r.get("nom") or cid),
                "dr": _dr_id(r),
                "region": (r.get("libelle_region") or r.get("region") or ""),
            })
        if not out:  # repli depuis l'historique si dim_centres absent
            seen = set()
            for r in self.historique:
                cid = r["id_centre_desservi"]
                if cid and cid not in seen:
                    seen.add(cid)
                    out.append({"id": cid, "label": cid, "dr": r.get("dr", ""),
                                "region": r.get("libelle_region", "")})
        return sorted(out, key=lambda x: x["id"])

    def get_liste_dr(self) -> List[str]:
        drs = set()
        for src in (self.par_dr, self.mensuelles):
            for r in src:
                d = _dr_id(r)
                if d:
                    drs.add(d)
        if not drs:
            for r in self.historique:
                if r.get("dr"):
                    drs.add(r["dr"])
        return sorted(drs)

    # --------------------------------------------------------------- meta / info
    def model_info(self) -> Dict:
        """Etat des artefacts — alimente l'endpoint /prediction/model-info."""
        info: Dict[str, Any] = {"mode": "serve-forecasts+scenario-levers",
                                "artefacts_dir": str(ARTEFACTS_DIR), "artefacts": {}}
        for name in ("previsions_annuelles.json", "previsions_mensuelles.json",
                     "previsions_par_dr.json", "shap_global.json",
                     "shap_par_centre.json", "dim_centres.json", "modele_onee.pkl"):
            p = ARTEFACTS_DIR / name
            info["artefacts"][name] = {
                "present": p.exists(),
                "taille_ko": round(p.stat().st_size / 1024, 1) if p.exists() else 0,
            }
        info["compteurs"] = {
            "previsions_annuelles": len(self.annuelles),
            "previsions_mensuelles": len(self.mensuelles),
            "previsions_par_dr": len(self.par_dr),
            "lignes_historique": len(self.historique),
        }
        return info

    def get_all(self) -> Dict:
        """Renvoie tout d'un coup (pratique pour un chargement initial du front)."""
        return {
            "previsions_annuelles": self.annuelles,
            "previsions_mensuelles": self.mensuelles,
            "previsions_par_dr": self.par_dr,
            "shap_global": self.shap_global,
            "centres": self.get_liste_centres(),
            "drs": self.get_liste_dr(),
        }
