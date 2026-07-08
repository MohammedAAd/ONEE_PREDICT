"""
backend/services/scenario_engine.py
====================================
Moteur de scenarios prospectifs ONEE.

3 niveaux d'analyse (cf. fichier client "Parametres de Scenarios") :

  1. Centre desservi   — DEMANDE      (horizon n+30)
       . taux d'accroissement de la population   [-5% ; 15%]
       . rendement de distribution               [30% ; 95%]
       . rendement d'adduction                   [60% ; 100%]
       . taux de branchement                     [5% ; 100%]
       -> ajuste la courbe de tendance des besoins futurs.

  2. Installation      — RESSOURCE    (horizon m+12)
       . capacite de production   [0 ; min(debit_exploitable, debit_equipe)]
       -> recalcule la saturation et le volume disponible.

  3. Groupe de centres — BILAN        (horizon n+30)
       . capacite de production (>= 0) + changements d'affectation
       -> recompose le bilan besoins / capacite par zone.

Les leviers sont appliques de facon DETERMINISTE sur les previsions de base
(le modele ML fournit l'ancrage court terme ; le moteur porte le long horizon).

Relations metier utilisees (cf. "Formules de calcul.docx") :
  distribution = consommation / rendement_distribution
  production   = distribution  / rendement_adduction
  consommation est proportionnelle a  population x taux_branchement
"""
import statistics
from typing import Dict, List, Any, Optional

# ---- valeurs de reference par defaut (si master_panel.csv absent) ----
DEFAUT_REND_DIST = 0.75
DEFAUT_REND_ADD = 0.85
DEFAUT_BRANCH = 0.88
DEFAUT_CROISSANCE = 0.018          # 1.8 %/an

CIBLES = ("distribution", "production", "consommation_totale")


# ------------------------------------------------------------------ utilitaires
def _frac(v: Optional[float], defaut: float) -> float:
    """Normalise un taux en fraction : accepte 0.75 ou 75 (%)."""
    if v is None or v <= 0:
        return defaut
    return v / 100.0 if v > 1.5 else v


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


# --------------------------------------------------- baselines (master_panel.csv)
def baselines_centre(historique: List[Dict], centre_id: str) -> Dict:
    """Valeurs de reference d'un centre : derniers rendements connus + croissance."""
    lignes = sorted([r for r in historique
                     if r["id_centre_desservi"] == str(centre_id).strip() and r.get("annee")],
                    key=lambda r: r["annee"])

    def dernier(champ: str):
        for r in reversed(lignes):
            if r.get(champ) not in (None, 0):
                return r[champ]
        return None

    rd = _frac(dernier("rend_distribution"), DEFAUT_REND_DIST)
    ra = _frac(dernier("rend_adduction"), DEFAUT_REND_ADD)
    tb = _frac(dernier("taux_branchement"), DEFAUT_BRANCH)

    pop = [(r["annee"], r["population_interp"]) for r in lignes if r.get("population_interp")]
    croissance = DEFAUT_CROISSANCE
    if len(pop) >= 2 and pop[0][1] and pop[0][1] > 0 and pop[-1][0] > pop[0][0]:
        croissance = (pop[-1][1] / pop[0][1]) ** (1.0 / (pop[-1][0] - pop[0][0])) - 1.0
    return {"rend_distribution": rd, "rend_adduction": ra, "taux_branchement": tb,
            "croissance": _clamp(croissance, -0.05, 0.10)}


def baselines_global(historique: List[Dict]) -> Dict:
    """Valeurs de reference nationales (moyennes) si aucun centre n'est cible."""
    par_centre: Dict[str, List[Dict]] = {}
    for r in historique:
        if r["id_centre_desservi"] and r.get("annee"):
            par_centre.setdefault(r["id_centre_desservi"], []).append(r)

    rds, ras, tbs = [], [], []
    for rows in par_centre.values():
        rows = sorted(rows, key=lambda r: r["annee"])

        def dernier(champ, _rows=rows):
            for r in reversed(_rows):
                if r.get(champ) not in (None, 0):
                    return r[champ]
            return None

        if dernier("rend_distribution"):
            rds.append(_frac(dernier("rend_distribution"), DEFAUT_REND_DIST))
        if dernier("rend_adduction"):
            ras.append(_frac(dernier("rend_adduction"), DEFAUT_REND_ADD))
        if dernier("taux_branchement"):
            tbs.append(_frac(dernier("taux_branchement"), DEFAUT_BRANCH))

    pop_an: Dict[int, float] = {}
    for r in historique:
        if r.get("population_interp") and r.get("annee"):
            pop_an[r["annee"]] = pop_an.get(r["annee"], 0.0) + r["population_interp"]
    croissance = DEFAUT_CROISSANCE
    if len(pop_an) >= 2:
        ys = sorted(pop_an)
        if pop_an[ys[0]] > 0 and ys[-1] > ys[0]:
            croissance = (pop_an[ys[-1]] / pop_an[ys[0]]) ** (1.0 / (ys[-1] - ys[0])) - 1.0
    return {"rend_distribution": statistics.mean(rds) if rds else DEFAUT_REND_DIST,
            "rend_adduction": statistics.mean(ras) if ras else DEFAUT_REND_ADD,
            "taux_branchement": statistics.mean(tbs) if tbs else DEFAUT_BRANCH,
            "croissance": _clamp(croissance, -0.05, 0.10)}


# =================================================================== NIVEAU 1
def projeter_demande(service, p: Dict) -> Optional[Dict]:
    """Niveau Centre : projette la demande (baseline vs scenario) jusqu'a l'horizon."""
    cible = p.get("cible", "consommation_totale")
    centre_id = p.get("centre_id")
    horizon = int(p.get("annee_horizon") or 2054)

    rows = service.get_previsions_annuelles(centre_id=centre_id, cible=cible)
    if not rows:
        return None

    # agregation par annee (somme si plusieurs centres)
    par_annee: Dict[int, Dict[str, float]] = {}
    for r in rows:
        a = int(r.get("annee", 0) or 0)
        if a == 0:
            continue
        d = par_annee.setdefault(a, {"q10": 0.0, "q50": 0.0, "q90": 0.0})
        for q in ("q10", "q50", "q90"):
            d[q] += float(r.get(q) or 0)
    if not par_annee:
        return None
    annees_ml = sorted(par_annee)
    y0, y_last = annees_ml[0], annees_ml[-1]

    bl = (baselines_centre(service.historique, str(centre_id)) if centre_id
          else baselines_global(service.historique))
    g_base = bl["croissance"]

    # parametres scenario : None -> on garde la valeur de reference (=> aucun effet)
    g_scn = (p["taux_accroissement"] / 100.0
             if p.get("taux_accroissement") is not None else g_base)
    rd_scn = (p["rendement_distribution"] / 100.0
              if p.get("rendement_distribution") is not None else bl["rend_distribution"])
    ra_scn = (p["rendement_adduction"] / 100.0
              if p.get("rendement_adduction") is not None else bl["rend_adduction"])
    tb_scn = (p["taux_branchement"] / 100.0
              if p.get("taux_branchement") is not None else bl["taux_branchement"])

    # facteurs multiplicatifs
    f_branch = tb_scn / bl["taux_branchement"] if bl["taux_branchement"] else 1.0
    f_rend = 1.0
    if cible in ("distribution", "production") and rd_scn > 0:
        f_rend *= bl["rend_distribution"] / rd_scn
    if cible == "production" and ra_scn > 0:
        f_rend *= bl["rend_adduction"] / ra_scn

    annees = list(range(y0, horizon + 1))
    base = {"q10": [], "q50": [], "q90": []}
    scen = {"q10": [], "q50": [], "q90": []}
    for y in annees:
        if y in par_annee:                       # annee couverte par le modele ML
            b = par_annee[y]
        else:                                    # prolongation a la croissance de base
            k = (1.0 + g_base) ** (y - y_last)
            b = {q: par_annee[y_last][q] * k for q in ("q10", "q50", "q90")}
        tilt = ((1.0 + g_scn) / (1.0 + g_base)) ** (y - y0)
        for q in ("q10", "q50", "q90"):
            base[q].append(round(b[q], 1))
            scen[q].append(round(b[q] * tilt * f_branch * f_rend, 1))

    return {
        "cible": cible,
        "centre_id": centre_id,
        "perimetre": centre_id if centre_id else "Tous les centres",
        "annees": annees,
        "baseline": base,
        "scenario": scen,
        "hypotheses": {
            "croissance_base_pct": round(g_base * 100, 2),
            "croissance_scenario_pct": round(g_scn * 100, 2),
            "rend_distribution_base": round(bl["rend_distribution"], 3),
            "rend_distribution_scenario": round(rd_scn, 3),
            "rend_adduction_base": round(bl["rend_adduction"], 3),
            "rend_adduction_scenario": round(ra_scn, 3),
            "taux_branchement_base": round(bl["taux_branchement"], 3),
            "taux_branchement_scenario": round(tb_scn, 3),
        },
    }


# =================================================================== NIVEAU 2
def appliquer_capacite(service, p: Dict) -> Optional[Dict]:
    """Niveau Installation : recalcule capacite, saturation et marge (horizon m+12)."""
    delta = p.get("delta_capacite_pct")
    cap_abs = p.get("capacite_absolue")
    if delta is None and cap_abs is None:
        return None

    rows = service.get_previsions_mensuelles(installation=p.get("installation"),
                                             annee=p.get("annee_mensuel"))
    if not rows:
        return None

    mois, besoin, cap_b, cap_s = [], [], [], []
    sat_b = sat_s = 0
    for r in sorted(rows, key=lambda x: (int(x.get("annee", 0) or 0),
                                         int(x.get("mois", 0) or 0))):
        # besoin = demande projetee ; q50_uncapped si l'export le fournit,
        # sinon volume_cible (deja plafonne -> peut sous-estimer le besoin reel).
        bes = float(r.get("q50_uncapped") or r.get("volume_cible") or 0)
        cb = float(r.get("capacite_m3") or 0)
        cs = cap_abs if cap_abs is not None else cb * (1.0 + (delta or 0) / 100.0)
        mois.append(f"{int(r.get('annee', 0) or 0)}-{int(r.get('mois', 0) or 0):02d}")
        besoin.append(round(bes, 0))
        cap_b.append(round(cb, 0))
        cap_s.append(round(cs, 0))
        sat_b += int(bes >= cb > 0)
        sat_s += int(bes >= cs > 0)
    return {
        "perimetre": p.get("installation") or "Toutes les installations",
        "mois": mois,
        "besoin": besoin,
        "capacite_baseline": cap_b,
        "capacite_scenario": cap_s,
        "n_points": len(mois),
        "n_saturees_baseline": sat_b,
        "n_saturees_scenario": sat_s,
    }


# =================================================================== NIVEAU 3
def _ligne_bilan(dr: str, besoin: float, capacite: float,
                 n_inst: int, n_sat: int) -> Dict:
    """Construit une ligne de bilan avec statut (deficit / tension / ok)."""
    deficit = besoin - capacite
    if deficit > 0:
        statut = "deficit"
    elif deficit > -0.10 * capacite:
        statut = "tension"
    else:
        statut = "ok"
    return {"dr": dr, "besoin": round(besoin, 0), "capacite": round(capacite, 0),
            "deficit": round(max(0.0, deficit), 0), "marge": round(max(0.0, -deficit), 0),
            "n_installations": n_inst, "n_saturees": n_sat, "statut": statut}


def _min_positive(*values: Optional[float]) -> float:
    """Retourne la plus petite valeur strictement positive parmi les arguments."""
    positives = [float(v) for v in values if v is not None and float(v) > 0]
    return min(positives) if positives else 0.0


def calculer_bilan(service, p: Dict) -> Dict:
    """Niveau Groupe : bilan besoins / capacite par DR, avec changements d'affectation.

    Si les previsions mensuelles portent l'identifiant DR -> rollup par installation
    (les reaffectations sont alors prises en compte). Sinon -> repli sur la table
    previsions_par_dr deja agregee (reaffectation indisponible dans ce cas)."""
    from .prediction_service import _dr_id

    reaffectations = {
        str(x["installation"]).strip(): {
            "nouvelle_dr": str(x["nouvelle_dr"]).strip(),
            "annee_debut": int(x.get("annee_debut") or 0)
        }
        for x in p.get("reaffectations", [])
    }
    delta = p.get("delta_capacite_pct") or 0.0
    annee = p.get("annee_mensuel")

    rows = service.get_previsions_mensuelles(annee=annee)
    has_dr = any(_dr_id(r) for r in rows)

    par_dr: List[Dict] = []
    if has_dr:
        # rollup par installation -> permet d'appliquer les reaffectations
        source = "previsions_mensuelles (rollup par installation)"
        agg: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            inst = str(r.get("installation", "")).strip()
            dr_orig = _dr_id(r) or "ND"
            reaff = reaffectations.get(inst)
            if reaff and annee and reaff["annee_debut"] and annee >= reaff["annee_debut"]:
                dr = reaff["nouvelle_dr"]
            else:
                dr = dr_orig
            d = agg.setdefault(dr, {"besoin": 0.0, "capacite": 0.0,
                                    "installations": set(), "n_sat": 0})
            bes = float(r.get("q50_uncapped") or r.get("volume_cible") or 0)
            cap = float(r.get("capacite_m3") or 0) * (1.0 + delta / 100.0)
            d["besoin"] += bes
            d["capacite"] += cap
            d["installations"].add(inst)
            d["n_sat"] += int(bes >= cap > 0)
        for dr, d in sorted(agg.items()):
            par_dr.append(_ligne_bilan(dr, d["besoin"], d["capacite"],
                                       len(d["installations"]), d["n_sat"]))
    else:
        # repli : la table previsions_par_dr est deja agregee
        source = "previsions_par_dr (table pre-agregee)"
        agg2: Dict[str, Dict[str, float]] = {}
        for r in service.get_previsions_par_dr(annee=annee):
            dr = _dr_id(r) or "ND"
            d = agg2.setdefault(dr, {"besoin": 0.0, "capacite": 0.0,
                                     "n_inst": 0, "n_sat": 0})
            d["besoin"] += float(r.get("volume_cible") or 0)
            d["capacite"] += float(r.get("capacite_m3") or 0) * (1.0 + delta / 100.0)
            d["n_inst"] = max(d["n_inst"], int(r.get("n_installations") or 0))
            d["n_sat"] += int(r.get("n_saturees") or 0)
        for dr, d in sorted(agg2.items()):
            par_dr.append(_ligne_bilan(dr, d["besoin"], d["capacite"],
                                       int(d["n_inst"]), int(d["n_sat"])))
    cap_add = p.get("capacite_additionnelle_m3")

    if cap_add:
        lib = p.get("capacite_additionnelle_libelle") or "Ressource additionnelle"
        par_dr.append(_ligne_bilan(lib, 0.0, float(cap_add), 0, 0))

    return {
        "par_dr": par_dr,
        "source": source,
        "reaffectation_disponible": has_dr,
        "n_reaffectations": len(reaffectations) if has_dr else 0,
        "delta_capacite_pct": delta,
        "capacite_additionnelle_m3": cap_add or 0.0,
        "capacite_additionnelle_libelle": p.get("capacite_additionnelle_libelle") or ""
    }


# ===================================================================== RUNNER
def executer_scenario(service, p: Dict) -> Dict:
    """Point d'entree unique du moteur — renvoie les 3 niveaux d'un coup."""
    return {
        "parametres": p,
        "annuel": projeter_demande(service, p),     # niveau Centre  (demande)
        "mensuel": appliquer_capacite(service, p),  # niveau Installation (capacite)
        "bilan": calculer_bilan(service, p),        # niveau Groupe (bilan)
    }
