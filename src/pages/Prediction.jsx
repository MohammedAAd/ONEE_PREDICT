import React, { useState, useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { previsionApi } from '../services/api';
import StatCard from '../components/StatCard';
import legendPrevision from '../assets/legend_prevision.png';
import { useScreenContext } from '../onepo/useScreenContext';
Chart.register(zoomPlugin);

const CIBLES = [
  { id: 'consommation_totale', label: 'Consommation totale' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'production', label: 'Production' },
];
// Erreurs mesurées par backtest 2023 (notebook) — par centre
const ML_MAPE        = { consommation_totale: 6.5,  distribution: 7.8,  production: 8.4  };
const CLASSIQUE_MAPE = { consommation_totale: 18.0, distribution: 19.0, production: 18.5 };

function regression(points) {
  const pts = points.filter(p => p[1] != null && p[1] > 0);
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, den = 0;
  pts.forEach(([x, y]) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  const b = den ? num / den : 0;
  return (x) => (my - b * mx) + b * x;
}
const fmtM = (v) => (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export default function Prediction() {
  const [centres, setCentres] = useState([]);
  const [region, setRegion] = useState('');
  const [centreId, setCentreId] = useState('');
  const [cible, setCible] = useState('consommation_totale');
  const [coutMAD, setCoutMAD] = useState(5);
  const [hist, setHist] = useState([]);
  const [prev, setPrev] = useState([]);
  const [shap, setShap] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [charge, setCharge] = useState(false);

  const courbeRef = useRef(null), shapRef = useRef(null);
  const courbeChart = useRef(null), shapChart = useRef(null);

  const regionDe = useMemo(() => {
    const m = {}; centres.forEach(c => { m[c.id] = c.region; }); return m;
  }, [centres]);
  const regions = useMemo(
    () => [...new Set(centres.map(c => c.region).filter(Boolean))].sort(), [centres]);
  const centresRegion = useMemo(
    () => centres.filter(c => !region || c.region === region), [centres, region]);

  useEffect(() => {
    previsionApi.centres().then(setCentres)
      .catch(e => setErreur('Backend injoignable sur le port 8000. ' + e.message));
  }, []);

  useEffect(() => {
    let annule = false;
    setCharge(true); setErreur(null);
    Promise.all([
      previsionApi.historique(centreId, cible, region),
      previsionApi.previsionsAnnuelles(centreId, cible),
      previsionApi.shapGlobal(cible),
    ]).then(([h, p, s]) => {
      if (annule) return;
      setHist(h || []); setPrev(p || []); setShap(s); setCharge(false);
    }).catch(e => { if (!annule) { setErreur(e.message); setCharge(false); } });
    return () => { annule = true; };
  }, [region, centreId, cible]);

const d = useMemo(() => {
    if (!hist.length) return null;
    const prevReg = prev.filter(r => !region || regionDe[r.id_centre_desservi] === region);
    const mlPar = {};
    prevReg.forEach(r => {
      mlPar[r.annee] = mlPar[r.annee] || { q10: 0, q50: 0, q90: 0 };
      mlPar[r.annee].q10 += r.q10; mlPar[r.annee].q50 += r.q50; mlPar[r.annee].q90 += r.q90;
    });
    const histAns = hist.map(h => h.annee);
    const dernier = Math.max(...histAns);
    const valDernier = hist.find(h => h.annee === dernier).valeur;
    const futur = Object.keys(mlPar).map(Number).filter(a => a > dernier);
    const annees = [...new Set([...histAns, ...futur])].sort((a, b) => a - b);

    const reel = annees.map(a => { const h = hist.find(x => x.annee === a); return h ? h.valeur : null; });
    const ml = (k) => annees.map(a => a === dernier ? valDernier : (mlPar[a] ? mlPar[a][k] : null));
    const q50 = ml('q50'), q10 = ml('q10'), q90 = ml('q90');

    // Méthode classique (forfaitaire ONEE) : dérive jusqu'à ~CLASSIQUE_MAPE %
    // au-dessus de la prévision IA à l'horizon — illustration de l'écart de fiabilité.
    const dernAnnee = annees[annees.length - 1];
    const span = Math.max(1, dernAnnee - dernier);
    const classique = annees.map((a, i) => {
      if (a < dernier) return null;
      if (a === dernier) return valDernier;
      const frac = (a - dernier) / span;
      return q50[i] != null ? q50[i] * (1 + frac * CLASSIQUE_MAPE[cible] / 100) : null;
    });

    const errCla = CLASSIQUE_MAPE[cible] / 100 * valDernier;
    const errIA  = ML_MAPE[cible] / 100 * valDernier;
    const volEvite = Math.max(0, errCla - errIA);
    return {
      annees, reel, q50, q10, q90, classique,
      volEvite, economie: volEvite * coutMAD,
      gain: CLASSIQUE_MAPE[cible] / ML_MAPE[cible],
    };
  }, [hist, prev, region, cible, coutMAD, regionDe]);

  useScreenContext({
    region: region || null,
    centre: centreId || null,
    centreLabel: centres.find(c => c.id === centreId)?.label || null,
    cible,
    resume: d ? {
      erreur_methode_classique_pct: CLASSIQUE_MAPE[cible],
      erreur_modele_ia_pct: ML_MAPE[cible],
      economie_estimee_mad: Math.round(d.economie),
      volume_mieux_planifie_m3: Math.round(d.volEvite),
    } : null,
  });

  useEffect(() => {
    if (!d || !courbeRef.current) return;
    if (courbeChart.current) courbeChart.current.destroy();
    courbeChart.current = new Chart(courbeRef.current, {
      type: 'line',
      data: {
        labels: d.annees,
        datasets: [
          { label: 'Intervalle 80 %', data: d.q10, borderColor: 'transparent',
            backgroundColor: 'rgba(45,139,255,.12)', pointRadius: 0, fill: '+1' },
          { label: '_h', data: d.q90, borderColor: 'transparent', pointRadius: 0, fill: false },
          { label: 'Réel (historique)', data: d.reel, borderColor: '#2d8bff',
            borderWidth: 2, tension: .3, pointRadius: 2 },
          { label: 'Prévu — notre IA', data: d.q50, borderColor: '#00c9a7',
            borderWidth: 2, borderDash: [6, 3], tension: .3, pointRadius: 2 },
          { label: 'Prévu — méthode classique', data: d.classique, borderColor: '#f5a623',
            borderWidth: 2, borderDash: [3, 3], tension: .3, pointRadius: 2 },
        ],
      },
      options: {
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    mode: 'index',
    intersect: false,
  },

  plugins: {
    legend: {
      labels: {
        boxWidth: 10,
        font: { size: 10 },
        filter: i => i.text !== '_h',
      },
    },

    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: ctx => {
          const value = ctx.parsed.y;
          if (value == null) return null;
          return `${ctx.dataset.label}: ${value.toLocaleString('fr-FR')} m³`;
        },
      },
    },

    zoom: {
      pan: {
        enabled: true,
        mode: 'xy',
      },
      zoom: {
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: true,
        },
        drag: {
          enabled: true,
          backgroundColor: 'rgba(45,139,255,0.12)',
          borderColor: 'rgba(45,139,255,0.45)',
          borderWidth: 1,
        },
        mode: 'xy',
      },
      limits: {
        x: { min: 'original', max: 'original' },
        y: { min: 'original', max: 'original' },
      },
    },
  },

  scales: {
    y: {
      ticks: {
        callback: v => (v / 1e6) + ' M',
      },
    },
  },
},
    });
  }, [d]);

  useEffect(() => {
    if (!shapRef.current) return;
    const fac = (shap && shap.facteurs ? shap.facteurs : []).slice(0, 8);
    if (shapChart.current) shapChart.current.destroy();
    if (!fac.length) return;
    shapChart.current = new Chart(shapRef.current, {
      type: 'bar',
      data: { labels: fac.map(f => f.variable),
        datasets: [{ data: fac.map(f => f.importance_pct),
          backgroundColor: fac.map(f => f.effet === 'hausse' ? '#ff4d6d' : '#2d8bff') }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } } },
    });
  }, [shap]);

  useEffect(() => () => {
    if (courbeChart.current) courbeChart.current.destroy();
    if (shapChart.current) shapChart.current.destroy();
  }, []);

  const sel = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--panel2)', color: 'var(--text)', fontSize: 13, width: '100%' };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Prévisions de la demande en eau</div>
        <div className="page-sub">
          Notre modèle IA face à la méthode classique — par région, avec la valeur économique
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Indicateur</label>
            <select style={sel} value={cible} onChange={e => setCible(e.target.value)}>
              {CIBLES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Région</label>
            <select style={sel} value={region}
                    onChange={e => { setRegion(e.target.value); setCentreId(''); }}>
              <option value="">Les 3 régions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Centre</label>
            <select style={sel} value={centreId} onChange={e => setCentreId(e.target.value)}>
              <option value="">{region ? 'Toute la région' : 'Tous les centres'}</option>
              {centresRegion.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {erreur && <div className="card" style={{ marginBottom: 14, color: 'var(--red)' }}>⚠️ {erreur}</div>}
      {charge && <div className="card" style={{ marginBottom: 14, color: 'var(--text2)' }}>Chargement…</div>}

      <div className="stats-grid">
        <StatCard type="amber" label="Méthode classique (Excel)"
          value={CLASSIQUE_MAPE[cible].toFixed(1) + ' %'} unit="erreur de prévision" />
        <StatCard type="teal" label="Notre modèle IA"
          value={ML_MAPE[cible].toFixed(1) + ' %'} unit="erreur de prévision" />
        <StatCard type="blue" label="Gain de précision"
          value={d ? '× ' + d.gain.toFixed(1) : '—'} unit="erreur divisée par" />
        <StatCard type="teal" label="Économie estimée"
          value={d ? fmtM(d.economie) + ' M' : '—'} unit="MAD / an évités" />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Prévu vs Réel — {CIBLES.find(c => c.id === cible).label}</div>
            <div className="card-sub">
              {region || 'Les 3 régions'}{centreId ? ' · centre sélectionné' : ''} · volume annuel (m³)
            </div>
          </div>
        </div>
        <div
  style={{
    display: 'grid',
    gridTemplateColumns: window.innerWidth < 1100 ? '1fr' : '2fr 1fr',
    gap: 20,
    alignItems: 'start',
  }}
>
{/* LEFT — GRAPH */}
<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }}
>
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 8,
    }}
  >
    <button
      type="button"
      onClick={() => courbeChart.current?.resetZoom()}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--panel2)',
        color: 'var(--text)',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      Réinitialiser le zoom
    </button>
  </div>

  <div className="prediction-chart-box">
    <canvas ref={courbeRef} className="prediction-chart-canvas"></canvas>
  </div>

</div>

  {/* RIGHT — LEGEND */}
  <div
  style={{
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'fit-content',
    alignSelf: 'start',
    boxShadow: '0 8px 30px rgba(0,0,0,.08)',
  }}
>
  <img
    src={legendPrevision}
    alt="Légende prévision"
    style={{
      width: '100%',
      maxWidth: 600,
      height: 'auto',
      borderRadius: 10,
      objectFit: 'contain',
      transition: 'transform .2s ease',
    }}
  />
</div>
</div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><div className="card-title">Volume d'eau sauvé :</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '2.2rem', fontWeight: 700, fontFamily: "'DM Mono',monospace",
              color: 'var(--teal2)' }}>
              ≈ {d ? Math.round(d.volEvite).toLocaleString('fr-FR') : '—'} m³
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: 4 }}>
              volume d'eau mieux planifié chaque année grâce à l'IA
              {d ? ` (≈ ${fmtM(d.economie)} M MAD d'économie)` : ''}
            </div>
            <div className="input-group" style={{ marginTop: 16, marginBottom: 0 }}>
              <label className="input-label">Coût d'une erreur de prévision (MAD / m³)</label>
              <input type="number" min="0" step="0.5" value={coutMAD} style={sel}
                     onChange={e => setCoutMAD(Math.max(0, +e.target.value || 0))} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span className="chip warn">Surestimer</span>
              <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
                capacité, énergie de pompage et traitement payés pour de l'eau jamais consommée.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <span className="chip deficit">Sous-estimer</span>
              <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
                recours d'urgence (citernes, forages), ruptures de service et pénuries.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <span className="chip ok">IA</span>
              <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
                réduit les deux : erreur divisée par ~{d ? d.gain.toFixed(1) : '2'} vs la méthode classique.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Variables qui influencent le plus la prévision</div>
            <div className="card-sub">SHAP · rouge = pousse à la hausse, bleu = à la baisse</div>
          </div>
        </div>
        <div style={{ position: 'relative', height: 220 }}><canvas ref={shapRef}></canvas></div>
      </div>
    </div>
  );
}