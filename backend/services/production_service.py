from typing import Dict, Any, List, Optional
from pathlib import Path
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class DataQualityBlockingError(Exception):
    """Raised when blocking data-quality issues are detected."""

    def __init__(self, issues: List[Dict[str, Any]]):
        self.issues = issues
        super().__init__("Blocking data-quality issues detected")


class ProductionService:
    """Service pour la page Production - Modèle B."""

    _mensuelles_cache: Optional[List[Dict[str, Any]]] = None
    _mensuelles_years_cache: Optional[set] = None

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _to_float_or_zero(value: Any) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _append_issue(issues: List[Dict[str, Any]], code: str, severity: str,
                      message: str, installation: Optional[str] = None,
                      details: Optional[Dict[str, Any]] = None) -> None:
        issues.append({
            "code": code,
            "severity": severity,
            "message": message,
            "installation": installation,
            "details": details or {},
        })

    async def get_blocking_quality_issues(self, region: Optional[int], year: int) -> List[Dict[str, Any]]:
        """Validate critical capacity data and return blocking issues."""
        issues: List[Dict[str, Any]] = []

        if region is not None:
            query = text(
                """
                WITH region_installations AS (
                    SELECT DISTINCT l.installation
                    FROM link_installations_master_panel l
                    JOIN master_panel mp ON l.id_centre_desservi = mp.id_centre_desservi
                    WHERE mp.code_region_12 = :region
                      AND mp.annee = 2024
                )
                SELECT ip.installation, ip.debit_exploitable, ip.debit_equipe
                FROM installations_production ip
                JOIN region_installations ri ON ri.installation = ip.installation
                """
            )
            params = {"region": region}
        else:
            query = text(
                """
                SELECT installation, debit_exploitable, debit_equipe
                FROM installations_production
                """
            )
            params = {}

        result = await self.db.execute(query, params)
        rows = result.fetchall()

        for row in rows:
            name = str(row.installation or "").strip()
            upper_name = name.upper()
            debit_exploitable = self._to_float_or_zero(row.debit_exploitable)
            debit_equipe = self._to_float_or_zero(row.debit_equipe)

            if debit_exploitable <= 0 and debit_equipe <= 0:
                self._append_issue(
                    issues,
                    code="ZERO_CAPACITY",
                    severity="blocking",
                    message="Capacité nulle détectée: debit_exploitable et debit_equipe sont tous les deux <= 0.",
                    installation=name,
                    details={"debit_exploitable": debit_exploitable, "debit_equipe": debit_equipe},
                )

            if debit_equipe > 0 and debit_exploitable > debit_equipe:
                self._append_issue(
                    issues,
                    code="EXPLOITABLE_GT_EQUIPE",
                    severity="blocking",
                    message="Incohérence détectée: debit_exploitable > debit_equipe.",
                    installation=name,
                    details={"debit_exploitable": debit_exploitable, "debit_equipe": debit_equipe},
                )

            if "LOUKKOUS" in upper_name and "STATION DE TRAITEMENT" in upper_name and debit_equipe < 660:
                self._append_issue(
                    issues,
                    code="LOUKKOUS_EQUIPE_BASELINE_MISSING",
                    severity="blocking",
                    message="LOUKKOUS doit avoir un Debit_equipe >= 660 l/s selon la règle métier.",
                    installation=name,
                    details={"debit_equipe": debit_equipe, "expected_min": 660},
                )

        # Validate model artifacts too: avoid silent saturation from zero modeled capacity.
        model_rows = self._load_model_mensuelles()
        if model_rows:
            allowed_installations = {str(r.installation).strip() for r in rows if r.installation}
            for item in model_rows:
                installation = str(item.get("installation") or "").strip()
                if not installation:
                    continue
                if region is not None and installation not in allowed_installations:
                    continue

                annee = int(item.get("annee") or 0)
                capacite = self._to_float_or_zero(item.get("capacite_m3"))
                if annee == int(year) and capacite <= 0:
                    self._append_issue(
                        issues,
                        code="MODEL_ZERO_CAPACITY",
                        severity="blocking",
                        message="Capacité modèle nulle détectée (previsions_mensuelles.capacite_m3 <= 0).",
                        installation=installation,
                        details={"annee": annee, "capacite_m3": capacite},
                    )

        return issues

    @classmethod
    def _load_model_mensuelles(cls) -> List[Dict[str, Any]]:
        if cls._mensuelles_cache is not None:
            return cls._mensuelles_cache

        repo_root = Path(__file__).resolve().parents[2]
        candidates = [
            repo_root / "backend" / "ml" / "previsions_mensuelles.json",
            repo_root / "previsions_mensuelles.json",
        ]

        for path in candidates:
            if not path.exists():
                continue
            try:
                with path.open(encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    cls._mensuelles_cache = data
                    cls._mensuelles_years_cache = {
                        int(r.get("annee"))
                        for r in data
                        if r.get("annee") is not None
                    }
                    return data
            except Exception:
                continue

        cls._mensuelles_cache = []
        cls._mensuelles_years_cache = set()
        return cls._mensuelles_cache

    @staticmethod
    def _norm_installation(value: Any) -> str:
        return str(value or "").strip().casefold()

    async def _get_region_installations(self, region: int, year: int) -> List[str]:
        query = text(
            """
            SELECT DISTINCT l.installation
            FROM link_installations_master_panel l
            JOIN master_panel mp ON l.id_centre_desservi = mp.id_centre_desservi
            WHERE mp.code_region_12 = :region
                            AND mp.annee = 2024
            """
        )
        result = await self.db.execute(query, {"region": region})
        return [str(r.installation).strip() for r in result if r.installation]

    @staticmethod
    def _build_model_prediction(rows: List[Dict[str, Any]], year: int) -> List[float]:
        serie = [0.0] * 12
        for r in rows:
            try:
                if int(r.get("annee") or 0) != int(year):
                    continue
                mois = int(r.get("mois") or 0)
                if 1 <= mois <= 12:
                    serie[mois - 1] += float(r.get("volume_cible") or 0.0) / 1_000_000
            except (TypeError, ValueError):
                continue
        return [round(v, 3) for v in serie]

    @staticmethod
    def _build_model_monthly_series(rows: List[Dict[str, Any]], year: int, field: str) -> List[float]:
        """Agrège les sorties mensuelles du modèle, sans conversion d'unité."""
        serie = [0.0] * 12
        for r in rows:
            try:
                if int(r.get("annee") or 0) != int(year):
                    continue
                mois = int(r.get("mois") or 0)
                if 1 <= mois <= 12:
                    serie[mois - 1] += float(r.get(field) or 0.0)
            except (TypeError, ValueError):
                continue
        return [round(v, 1) for v in serie]

    @staticmethod
    def _compute_model_installation_stats(rows: List[Dict[str, Any]], year: int) -> Dict[str, Dict[str, Any]]:
        agg: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            name = str(r.get("installation") or "").strip()
            if not name:
                continue
            try:
                if int(r.get("annee") or 0) != int(year):
                    continue
                vol = float(r.get("volume_cible") or 0.0)
                cap = float(r.get("capacite_m3") or 0.0)
                sat = bool(r.get("saturation", False))
            except (TypeError, ValueError):
                continue

            if name not in agg:
                agg[name] = {"vol_sum": 0.0, "cap_sum": 0.0, "sat_any": False}
            agg[name]["vol_sum"] += vol
            agg[name]["cap_sum"] += cap
            agg[name]["sat_any"] = agg[name]["sat_any"] or sat

        out: Dict[str, Dict[str, Any]] = {}
        for name, a in agg.items():
            taux = (a["vol_sum"] / a["cap_sum"] * 100) if a["cap_sum"] > 0 else 0.0
            out[name] = {"taux": round(taux, 1), "sat_any": bool(a["sat_any"])}
        return out

    async def get_all_data(
        self,
        region: Optional[int] = None,
        year: int = 2024,
        installation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        monthly = await self.get_monthly_production(region, year, installation_id)
        installations = await self.get_installations(region, year)
        stats = await self.get_stats(region, year)
        available_years = await self.get_available_years()

        return {
            "monthly": monthly,
            "installations": installations,
            "stats": stats,
            "available_years": available_years,
        }

    async def get_monthly_production(
        self,
        region: Optional[int] = None,
        year: int = 2024,
        installation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
        year_str = str(year)

        if installation_id:
            query_hist = text(
                """
                SELECT
                    pm.mois,
                    SUM(pm.volume_produit_traite) AS volume,
                    SUM(
                        CASE WHEN pm."taux_d'utilisation" > 0 THEN
                            pm.volume_produit_traite /
                            CASE WHEN pm."taux_d'utilisation" > 1.5
                                THEN pm."taux_d'utilisation" / 100.0
                                ELSE pm."taux_d'utilisation"
                            END
                        ELSE 0 END
                    ) AS capacite_estimee
                FROM production_mensuelle pm
                WHERE pm.année = :year_str
                  AND pm.installation = :installation_id
                GROUP BY pm.mois
                ORDER BY CAST(pm.mois AS INTEGER)
                """
            )
            params_hist = {"year_str": year_str, "installation_id": installation_id}
        elif region is not None:
            query_hist = text(
                """
                WITH region_installations AS (
                    SELECT DISTINCT l.installation
                    FROM link_installations_master_panel l
                    JOIN master_panel mp ON l.id_centre_desservi = mp.id_centre_desservi
                    WHERE mp.code_region_12 = :region
                        AND mp.annee = 2024
                )
                SELECT
                    pm.mois,
                    SUM(pm.volume_produit_traite) AS volume,
                    SUM(
                        CASE WHEN pm."taux_d'utilisation" > 0 THEN
                            pm.volume_produit_traite /
                            CASE WHEN pm."taux_d'utilisation" > 1.5
                                THEN pm."taux_d'utilisation" / 100.0
                                ELSE pm."taux_d'utilisation"
                            END
                        ELSE 0 END
                    ) AS capacite_estimee
                FROM production_mensuelle pm
                JOIN region_installations ri ON ri.installation = pm.installation
                WHERE pm.année = :year_str
                GROUP BY pm.mois
                ORDER BY CAST(pm.mois AS INTEGER)
                """
            )
            params_hist = {"year_str": year_str, "region": region}
        else:
            query_hist = text(
                """
                SELECT
                    pm.mois,
                    SUM(pm.volume_produit_traite) AS volume,
                    SUM(
                        CASE WHEN pm."taux_d'utilisation" > 0 THEN
                            pm.volume_produit_traite /
                            CASE WHEN pm."taux_d'utilisation" > 1.5
                                THEN pm."taux_d'utilisation" / 100.0
                                ELSE pm."taux_d'utilisation"
                            END
                        ELSE 0 END
                    ) AS capacite_estimee
                FROM production_mensuelle pm
                WHERE pm.année = :year_str
                GROUP BY pm.mois
                ORDER BY CAST(pm.mois AS INTEGER)
                """
            )
            params_hist = {"year_str": year_str}

        result_hist = await self.db.execute(query_hist, params_hist)
        rows_hist = result_hist.fetchall()

        historique = [0.0] * 12
        capacite_historique = [0.0] * 12
        for row in rows_hist:
            idx = int(row.mois) - 1 if row.mois else 0
            if 0 <= idx < 12:
                historique[idx] = float(row.volume or 0.0) / 1_000_000
                capacite_historique[idx] = float(row.capacite_estimee or 0.0)

        model_rows = self._load_model_mensuelles()
        model_filtered = model_rows
        if installation_id:
            iid = str(installation_id).strip()
            model_filtered = [
                r for r in model_rows
                if str(r.get("installation") or "").strip() == iid
            ]
        elif region is not None:
            region_installations = set(await self._get_region_installations(region, year))
            model_filtered = [
                r for r in model_rows
                if str(r.get("installation") or "").strip() in region_installations
            ]

        model_years = sorted(self._mensuelles_years_cache or set())
        model_installations = {
            str(row.get("installation") or "").strip()
            for row in model_filtered
            if str(row.get("installation") or "").strip()
        }
        pred_warning = None
        if year not in model_years:
            prediction = [0.0] * 12
            pred_warning = (
                f"Aucune projection mensuelle du modèle n'est livrée pour {year}. "
                f"Années ML disponibles : {', '.join(map(str, model_years)) or 'aucune'}."
            )
        elif not model_installations:
            prediction = [0.0] * 12
            pred_warning = (
                "Aucune installation de cette région n'est reliée aux sorties du modèle mensuel."
            )
        else:
            prediction = self._build_model_prediction(model_filtered, year)

        volume_cible_modele = self._build_model_monthly_series(model_filtered, year, "volume_cible")
        capacite_modele = self._build_model_monthly_series(model_filtered, year, "capacite_m3")
        has_model_capacity = any(value > 0 for value in capacite_modele)
        if has_model_capacity:
            volume_cible_m3 = volume_cible_modele
            capacite_m3 = capacite_modele
            capacite_source = "modele_ml"
        else:
            # Pour une année historique, le volume traité est la valeur observée.
            # La capacité est reconstituée uniquement depuis le taux d'utilisation
            # enregistré : capacité = volume traité / taux d'utilisation.
            volume_cible_m3 = [round(value * 1_000_000, 1) for value in historique]
            capacite_m3 = [round(value, 1) for value in capacite_historique]
            capacite_source = "historique" if any(capacite_m3) else "indisponible"
        saturation_pct = [
            round((volume / capacite) * 100, 1) if capacite > 0 else None
            for volume, capacite in zip(volume_cible_m3, capacite_m3)
        ]

        return {
            "labels": months,
            "historique": [round(v, 3) for v in historique],
            "prediction": prediction,
            "year": year,
            "pred_year": year,
            "pred_label": f"Projection modèle (données ML {year})",
            "pred_warning": pred_warning,
            "model_years": model_years,
            "model_installations": len(model_installations),
            "volume_cible_m3": volume_cible_m3,
            "capacite_m3": capacite_m3,
            "saturation_pct": saturation_pct,
            "capacite_source": capacite_source,
        }

    async def get_installations(
        self,
        region: Optional[int] = None,
        year: int = 2024,
    ) -> List[Dict[str, Any]]:
        year_str = str(year)

        model_rows = self._load_model_mensuelles()
        model_by_installation = self._compute_model_installation_stats(model_rows, year)

        if region is not None:
            query = text(
                """
                WITH region_installations AS (
                    SELECT DISTINCT l.installation
                    FROM link_installations_master_panel l
                    JOIN master_panel mp ON l.id_centre_desservi = mp.id_centre_desservi
                    WHERE mp.code_region_12 = :region
                                            AND mp.annee = 2024
                )
                SELECT
                    ip.installation AS name,
                    ip.lib_centre_prod_gde AS centre,
                    ip.id_dr AS dr,
                    ip.debit_exploitable AS debit_exploitable,
                    ip.debit_equipe AS debit_equipe,
                    COALESCE(AVG(pm."taux_d'utilisation"), 0) AS taux_2024
                FROM installations_production ip
                JOIN region_installations ri ON ip.installation = ri.installation
                LEFT JOIN production_mensuelle pm
                    ON ip.installation = pm.installation
                   AND pm.année = :year_str
                GROUP BY ip.installation, ip.lib_centre_prod_gde, ip.id_dr, ip.debit_exploitable, ip.debit_equipe
                ORDER BY ip.installation
                """
            )
            params = {"region": region, "year_str": year_str}
        else:
            query = text(
                """
                SELECT
                    ip.installation AS name,
                    ip.lib_centre_prod_gde AS centre,
                    ip.id_dr AS dr,
                    ip.debit_exploitable AS debit_exploitable,
                    ip.debit_equipe AS debit_equipe,
                    COALESCE(AVG(pm."taux_d'utilisation"), 0) AS taux_2024
                FROM installations_production ip
                LEFT JOIN production_mensuelle pm
                    ON ip.installation = pm.installation
                   AND pm.année = :year_str
                GROUP BY ip.installation, ip.lib_centre_prod_gde, ip.id_dr, ip.debit_exploitable, ip.debit_equipe
                ORDER BY ip.installation
                """
            )
            params = {"year_str": year_str}

        result = await self.db.execute(query, params)
        rows = result.fetchall()

        def compute_debit(debit_exploitable, debit_equipe):
            values = [v for v in (debit_exploitable, debit_equipe) if v is not None and float(v) > 0]
            return round(min(values), 0) if values else 0

        installations: List[Dict[str, Any]] = []
        for row in rows:
            taux_2024 = round(row.taux_2024 or 0, 1)
            forecast = model_by_installation.get(str(row.name or "").strip(), {})
            taux_forecast = float(forecast.get("taux", 0.0))
            debit = compute_debit(row.debit_exploitable, row.debit_equipe)

            indicator_taux = taux_forecast if taux_forecast > 0 else taux_2024
            if indicator_taux > 85:
                status = "deficit"
                status_text = "Saturation"
            elif indicator_taux > 70:
                status = "warn"
                status_text = "Tension"
            else:
                status = "ok"
                status_text = "Normal"

            installations.append(
                {
                    "name": row.name,
                    "centre": row.centre,
                    "dr": row.dr,
                    "debit": debit,
                    "debitExploitable": float(row.debit_exploitable or 0),
                    "debitEquipe": float(row.debit_equipe or 0),
                    "taux2024": taux_2024,
                    "tauxForecast": round(taux_forecast, 1),
                    "taux2028": round(taux_forecast, 1),
                    "status": status,
                    "statusText": status_text,
                }
            )

        return installations

    async def get_stats(
        self,
        region: Optional[int] = None,
        year: int = 2024,
    ) -> Dict[str, Any]:
        year_str = str(year)

        if region is not None:
            query = text(
                """
                WITH region_installations AS (
                    SELECT DISTINCT l.installation
                    FROM link_installations_master_panel l
                    JOIN master_panel mp ON l.id_centre_desservi = mp.id_centre_desservi
                    WHERE mp.code_region_12 = :region
                      AND mp.annee = 2024
                ),
                inst_rates AS (
                    SELECT
                        ri.installation,
                        AVG(pm."taux_d'utilisation") AS taux_util_moy,
                        MAX(pm."taux_d'utilisation") AS taux_util_max,
                        SUM(pm.volume_produit_traite) AS volume_total
                    FROM region_installations ri
                    LEFT JOIN production_mensuelle pm
                        ON pm.installation = ri.installation
                       AND pm.année = :year_str
                    GROUP BY ri.installation
                )
                SELECT
                    COUNT(*) AS nb_installations,
                    SUM(ir.volume_total) / 1000000 AS volume_total,
                    AVG(ir.taux_util_moy) AS taux_util_moyen,
                    COUNT(CASE WHEN ir.taux_util_max > 85 THEN 1 END) AS nb_saturation
                FROM inst_rates ir
                """
            )
            params = {"region": region, "year_str": year_str}
        else:
            query = text(
                """
                WITH inst_rates AS (
                    SELECT
                        ip.installation,
                        AVG(pm."taux_d'utilisation") AS taux_util_moy,
                        MAX(pm."taux_d'utilisation") AS taux_util_max,
                        SUM(pm.volume_produit_traite) AS volume_total
                    FROM installations_production ip
                    LEFT JOIN production_mensuelle pm
                        ON pm.installation = ip.installation
                       AND pm.année = :year_str
                    GROUP BY ip.installation
                )
                SELECT
                    COUNT(*) AS nb_installations,
                    SUM(ir.volume_total) / 1000000 AS volume_total,
                    AVG(ir.taux_util_moy) AS taux_util_moyen,
                    COUNT(CASE WHEN ir.taux_util_max > 85 THEN 1 END) AS nb_saturation
                FROM inst_rates ir
                """
            )
            params = {"year_str": year_str}

        result = await self.db.execute(query, params)
        row = result.first()

        historique_volume = self._to_float_or_zero(row.volume_total if row else None)
        if historique_volume > 0:
            return {
                "installations": row.nb_installations or 0,
                "model_installations": 0,
                "volumeYear": round(historique_volume, 1),
                "volume2024": round(historique_volume, 1),
                "taux_util": round(row.taux_util_moyen or 0, 1),
                "saturation": int(row.nb_saturation or 0),
                "saturation2028": int(row.nb_saturation or 0),
                "source": "historique",
            }

        model_rows = self._load_model_mensuelles()
        if region is not None:
            region_installations = set(await self._get_region_installations(region, year))
            model_rows = [
                item for item in model_rows
                if str(item.get("installation") or "").strip() in region_installations
            ]
        model_rows = [
            item for item in model_rows
            if int(item.get("annee") or 0) == int(year)
        ]
        model_stats = self._compute_model_installation_stats(model_rows, year)

        if model_stats:
            volume_modele = sum(self._to_float_or_zero(item.get("volume_cible")) for item in model_rows)
            taux = [item["taux"] for item in model_stats.values()]
            saturations = sum(
                1 for item in model_stats.values()
                if item["taux"] > 85 or item["sat_any"]
            )
            return {
                "installations": row.nb_installations if row and row.nb_installations else len(model_stats),
                "model_installations": len(model_stats),
                "volumeYear": round(volume_modele / 1_000_000, 1),
                "volume2024": round(volume_modele / 1_000_000, 1),
                "taux_util": round(sum(taux) / len(taux), 1),
                "saturation": saturations,
                "saturation2028": saturations,
                "source": "modele_ml",
            }

        return {
            "installations": row.nb_installations if row else 0,
            "model_installations": 0,
            "volumeYear": None,
            "volume2024": None,
            "taux_util": None,
            "saturation": None,
            "saturation2028": None,
            "source": "indisponible",
        }

    async def get_available_years(self) -> List[int]:
        query = text(
            """
            SELECT DISTINCT année
            FROM production_mensuelle
            ORDER BY année
            """
        )
        result = await self.db.execute(query)
        years = {int(row.année) for row in result if row.année}

        model_years = self._mensuelles_years_cache or set()
        years.update(int(y) for y in model_years)

        return sorted(years) if years else list(range(2012, 2031))

    async def get_installations_list(self, region: Optional[int] = None) -> List[Dict[str, str]]:
        if region is not None:
            query = text(
                """
                SELECT DISTINCT ON (ip.installation)
                    ip.installation AS id,
                    ip.installation AS name,
                    ip.lib_centre_prod_gde AS centre,
                    l.id_centre_desservi::text AS centre_id,
                    mp.lib_province AS province,
                    mp.libelle_region AS region_name
                FROM installations_production ip
                LEFT JOIN link_installations_master_panel l ON ip.installation = l.installation
                LEFT JOIN master_panel mp ON l.id_centre_desservi = mp.id_centre_desservi
                    AND mp.annee = 2024
                WHERE mp.code_region_12 = :region
                ORDER BY ip.installation, mp.population_2024 DESC NULLS LAST
                """
            )
            params = {"region": region}
        else:
            query = text(
                """
                SELECT DISTINCT ON (ip.installation)
                    ip.installation AS id,
                    ip.installation AS name,
                    ip.lib_centre_prod_gde AS centre,
                    l.id_centre_desservi::text AS centre_id,
                    mp.lib_province AS province,
                    mp.libelle_region AS region_name
                FROM installations_production ip
                LEFT JOIN link_installations_master_panel l ON ip.installation = l.installation
                LEFT JOIN master_panel mp ON l.id_centre_desservi = mp.id_centre_desservi
                    AND mp.annee = 2024
                ORDER BY ip.installation, mp.population_2024 DESC NULLS LAST
                """
            )
            params = {}

        result = await self.db.execute(query, params)
        rows = result.fetchall()
        return [
            {
                "id": row.id,
                "name": row.name,
                "centre": row.centre,
                "centre_id": row.centre_id,
                "province": row.province,
                "region_name": row.region_name,
            }
            for row in rows
        ]
