import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { 
  Calendar, Filter, ChevronDown, ChevronUp, RefreshCw, Search,
  TrendingUp, TrendingDown, Target, BarChart3,
  Droplets, Gauge, Activity
} from 'lucide-react';
import { useChart } from '../hooks/useChart';
import { chartColors, chartOptions } from '../utils/chartConfig';
import { previsionApi } from '../services/api';

// Mois de l'année
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const Prediction_Y = () => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // États des données depuis l'API réelle
  const [previsionsAnnue, setPrevisionsAnnue] = useState([]);
  const [previsionsMensuelles, setPrevisionsMensuelles] = useState([]);
  const [previsionsDr, setPrevisionsDr] = useState([]);
  const [shapGlobal, setShapGlobal] = useState({ facteurs: [] });
  const [shapParCentre, setShapParCentre] = useState([]);
  const [centres, setCentres] = useState([]);
  const [drs, setDrs] = useState([]);
  const [mensuelSourceYear, setMensuelSourceYear] = useState(2024);
  const [drSourceYear, setDrSourceYear] = useState(2024);
  
  // États des filtres
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [selectedDr, setSelectedDr] = useState(null);
  const [selectedCible, setSelectedCible] = useState('distribution');
  const [selectedAnnee, setSelectedAnnee] = useState(2024);
  const [isCentreDropdownOpen, setIsCentreDropdownOpen] = useState(false);
  const [isDrDropdownOpen, setIsDrDropdownOpen] = useState(false);
  const [isCibleDropdownOpen, setIsCibleDropdownOpen] = useState(false);
  const [isAnneeDropdownOpen, setIsAnneeDropdownOpen] = useState(false);
  
  // États pour la recherche dans les centres
  const [searchCentre, setSearchCentre] = useState('');
  const centreDropdownRef = useRef(null);

  const centresById = useMemo(() => {
    const map = {};
    for (const c of centres) map[c.id] = c;
    return map;
  }, [centres]);

  const ANNEE_OPTIONS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const CIBLE_OPTIONS = [
    { value: 'distribution', label: 'Distribution' },
    { value: 'production', label: 'Production' },
    { value: 'consommation_totale', label: 'Consommation totale' }
  ];

  // Filtrer les centres par recherche
  const filteredCentres = useMemo(() => {
    if (!searchCentre) return centres;
    return centres.filter(c => 
      c.name.toLowerCase().includes(searchCentre.toLowerCase())
    );
  }, [centres, searchCentre]);

  // Fermer le dropdown des centres quand on clique à l'extérieur
  useEffect(() => {
    function handleClickOutside(event) {
      if (centreDropdownRef.current && !centreDropdownRef.current.contains(event.target)) {
        setIsCentreDropdownOpen(false);
        setSearchCentre('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

// ============================================================
  // CHARGEMENT DES DONNÉES RÉELLES — API ONEE-Predict (port 8000)
  // ============================================================
  async function chargerCibleData(cible) {
    try {
      const [a, sg, sc] = await Promise.all([
        previsionApi.previsionsAnnuelles(null, cible),
        previsionApi.shapGlobal(cible),
        previsionApi.shapParCentre(null, cible),
      ]);
      setPrevisionsAnnue(a || []);
      setShapGlobal(sg && sg.facteurs ? sg : { facteurs: [] });
      setShapParCentre(sc || []);
    } catch (e) { console.error('Chargement cible:', e); }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      previsionApi.centres(),
      previsionApi.drs(),
    ]).then(([c, d]) => {
      setCentres((c || []).map(x => ({
        id: x.id,
        name: x.label || x.id,
        dr: x.dr || '',
        region: x.region || '',
      })));
      setDrs((d || []).map(x => ({ id: x, name: x })));
    }).catch(e => console.error('Chargement initial:', e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const loadMensuelles = async () => {
      try {
        const rows = await previsionApi.previsionsMensuelles(null, selectedAnnee);
        if ((rows || []).length > 0) {
          setPrevisionsMensuelles(rows || []);
          setMensuelSourceYear(selectedAnnee);
          return;
        }
        const fallback = await previsionApi.previsionsMensuelles(null, 2024);
        setPrevisionsMensuelles(fallback || []);
        setMensuelSourceYear(2024);
      } catch (e) {
        console.error('Chargement mensuel:', e);
      }
    };
    loadMensuelles();
  }, [selectedAnnee]);

  useEffect(() => {
    const loadDr = async () => {
      try {
        const rows = await previsionApi.previsionsDr(selectedDr?.id || null, selectedAnnee);
        if ((rows || []).length > 0) {
          setPrevisionsDr(rows || []);
          setDrSourceYear(selectedAnnee);
          return;
        }
        const fallback = await previsionApi.previsionsDr(selectedDr?.id || null, 2024);
        setPrevisionsDr(fallback || []);
        setDrSourceYear(2024);
      } catch (e) {
        console.error('Chargement DR:', e);
      }
    };
    loadDr();
  }, [selectedDr, selectedAnnee]);

  useEffect(() => { chargerCibleData(selectedCible); }, [selectedCible]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    chargerCibleData(selectedCible).finally(() => setIsRefreshing(false));
  };

  // Filtrer les données par centre/DR
  const filteredPrevisionsAnnue = previsionsAnnue.filter((p) => {
    if (selectedCentre && p.id_centre_desservi !== selectedCentre.id) return false;
    if (selectedDr) {
      const centre = centresById[p.id_centre_desservi];
      if (!centre || centre.dr !== selectedDr.id) return false;
    }
    return true;
  });

  const filteredPrevisionsDr = selectedDr
    ? previsionsDr.filter(p => p.id_dr === selectedDr.id)
    : previsionsDr;

  // Préparer les données pour les charts
  const annuelData = filteredPrevisionsAnnue;
  const annuelLabels = [...new Set(annuelData.map(d => d.annee))].sort();
  
  const annuelDatasets = [
    {
      label: 'Médiane (Q50)',
      data: annuelLabels.map(y => annuelData.find(d => d.annee === y)?.q50 || 0),
      borderColor: chartColors.blue,
      backgroundColor: 'transparent',
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: chartColors.blue
    },
    {
      label: 'Q10 (borne inf)',
      data: annuelLabels.map(y => annuelData.find(d => d.annee === y)?.q10 || 0),
      borderColor: chartColors.teal,
      borderDash: [5, 5],
      backgroundColor: 'transparent',
      tension: 0.4,
      pointRadius: 2
    },
    {
      label: 'Q90 (borne sup)',
      data: annuelLabels.map(y => annuelData.find(d => d.annee === y)?.q90 || 0),
      borderColor: chartColors.amber,
      borderDash: [5, 5],
      backgroundColor: 'transparent',
      tension: 0.4,
      pointRadius: 2
    }
  ];

  // Données mensuelles (agrégation réelle par mois)
  const monthlyVolumes = useMemo(() => {
    const agg = Array(12).fill(0);
    for (const p of previsionsMensuelles || []) {
      const m = Number(p.mois || 0);
      if (m >= 1 && m <= 12) agg[m - 1] += Number(p.volume_cible || 0);
    }
    return agg;
  }, [previsionsMensuelles]);

  const monthlyCapacites = useMemo(() => {
    const agg = Array(12).fill(0);
    for (const p of previsionsMensuelles || []) {
      const m = Number(p.mois || 0);
      if (m >= 1 && m <= 12) agg[m - 1] += Number(p.capacite_m3 || 0);
    }
    return agg;
  }, [previsionsMensuelles]);

  // Taux de saturation mensuel
  const saturationRates = monthlyVolumes.map((v, i) => monthlyCapacites[i] ? (v / monthlyCapacites[i] * 100) : 0);

  // Données DR (agrégation par mois)
  const drVolumes = useMemo(() => {
    const agg = Array(12).fill(0);
    for (const p of filteredPrevisionsDr || []) {
      const m = Number(p.mois || 0);
      if (m >= 1 && m <= 12) agg[m - 1] += Number(p.volume_cible || 0);
    }
    return agg;
  }, [filteredPrevisionsDr]);

  const drCapacites = useMemo(() => {
    const agg = Array(12).fill(0);
    for (const p of filteredPrevisionsDr || []) {
      const m = Number(p.mois || 0);
      if (m >= 1 && m <= 12) agg[m - 1] += Number(p.capacite_m3 || 0);
    }
    return agg;
  }, [filteredPrevisionsDr]);

  const yearlyRows = useMemo(
    () => filteredPrevisionsAnnue.filter((p) => Number(p.annee) === Number(selectedAnnee)),
    [filteredPrevisionsAnnue, selectedAnnee]
  );

  const modelAnalysis = useMemo(() => {
    const current = yearlyRows;
    const previous = filteredPrevisionsAnnue.filter((p) => Number(p.annee) === Number(selectedAnnee) - 1);

    const sum = (rows, key) => rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
    const q50 = sum(current, 'q50');
    const q10 = sum(current, 'q10');
    const q90 = sum(current, 'q90');
    const prevQ50 = sum(previous, 'q50');

    const yoy = prevQ50 > 0 ? ((q50 - prevQ50) / prevQ50) * 100 : null;
    const uncertaintyPct = q50 > 0 ? ((q90 - q10) / q50) * 100 : null;

    const scope = selectedCentre
      ? `Centre ${selectedCentre.name}`
      : selectedDr
        ? `DR ${selectedDr.name}`
        : 'Tous les centres';

    const trendSentence = yoy == null
      ? `Pas de référence ${selectedAnnee - 1} disponible pour comparer la médiane.`
      : yoy >= 0
        ? `La médiane modèle (${selectedAnnee}) progresse de ${yoy.toFixed(1)}% vs ${selectedAnnee - 1}.`
        : `La médiane modèle (${selectedAnnee}) baisse de ${Math.abs(yoy).toFixed(1)}% vs ${selectedAnnee - 1}.`;

    const intervalSentence = q50 > 0
      ? `Intervalle de prévision: Q10=${Math.round(q10).toLocaleString('fr-FR')} m³, Q50=${Math.round(q50).toLocaleString('fr-FR')} m³, Q90=${Math.round(q90).toLocaleString('fr-FR')} m³.`
      : `Aucune prévision annuelle exploitable pour ${selectedAnnee} sur ce périmètre.`;

    return {
      scope,
      q10,
      q50,
      q90,
      yoy,
      uncertaintyPct,
      trendSentence,
      intervalSentence,
      points: current.length,
    };
  }, [yearlyRows, filteredPrevisionsAnnue, selectedAnnee, selectedCentre, selectedDr]);

  // SHAP Global
  const shapFacteurs = shapGlobal?.facteurs || [];

  // Forcer le rendu des canvas
  useLayoutEffect(() => {
    // Petit délai pour s'assurer que le DOM est prêt
    setTimeout(() => {}, 100);
  }, []);

  // Chart: Prévisions annuelles
  useChart('annuelChart', {
    type: 'line',
    data: { 
      labels: annuelLabels.map(y => y.toString()), 
      datasets: annuelDatasets 
    },
    options: {
      ...chartOptions,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: { 
          callbacks: { 
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw / 1000).toFixed(0)}k m³` 
          } 
        },
        legend: { labels: { color: '#8ba8cc', font: { size: 10 } } }
      },
      scales: { 
        y: { 
          title: { display: true, text: 'Volume (milliers m³)', color: '#8ba8cc', font: { size: 10 } } 
        } 
      }
    }
  });

  // Chart: Volume mensuel vs capacité
  useChart('mensuelChart', {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [
        { label: 'Volume cible', data: monthlyVolumes, backgroundColor: chartColors.blue + 'cc', borderRadius: 4 },
        { label: 'Capacité mensuelle', data: monthlyCapacites, backgroundColor: chartColors.teal + 'cc', borderRadius: 4 }
      ]
    },
    options: { 
      ...chartOptions, 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { legend: { display: true, labels: { color: '#8ba8cc', font: { size: 10 } } } }, 
      scales: { 
        y: { title: { display: true, text: 'Volume (m³)', color: '#8ba8cc', font: { size: 10 } } } 
      } 
    }
  });

  // Chart: Taux de saturation mensuel
  useChart('saturationChart', {
    type: 'line',
    data: { 
      labels: MONTHS, 
      datasets: [{ 
        label: 'Taux de saturation (%)', 
        data: saturationRates, 
        borderColor: chartColors.red, 
        backgroundColor: chartColors.red + '15', 
        fill: true, 
        tension: 0.4, 
        pointRadius: 3 
      }] 
    },
    options: { 
      ...chartOptions, 
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(1)}%` } },
        legend: { labels: { color: '#8ba8cc', font: { size: 10 } } }
      }, 
      scales: { 
        y: { title: { display: true, text: 'Taux de saturation (%)', color: '#8ba8cc', font: { size: 10 } }, min: 0, max: 100 } 
      } 
    }
  });

  // Chart: Capacité par DR
  useChart('drChart', {
    type: 'bar',
    data: { 
      labels: MONTHS, 
      datasets: [
        { label: 'Volume cible', data: drVolumes, backgroundColor: chartColors.blue + 'cc', borderRadius: 4 },
        { label: 'Capacité', data: drCapacites, backgroundColor: chartColors.teal + 'cc', borderRadius: 4 }
      ] 
    },
    options: { 
      ...chartOptions, 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { legend: { display: true, labels: { color: '#8ba8cc', font: { size: 10 } } } }, 
      scales: { 
        y: { title: { display: true, text: 'Volume (m³)', color: '#8ba8cc', font: { size: 10 } } } 
      } 
    }
  });

  // Chart: SHAP Global
  useChart('shapChart', {
    type: 'bar',
    data: {
      labels: shapFacteurs.map(f => f.variable),
      datasets: [{
        data: shapFacteurs.map(f => f.importance_pct),
        backgroundColor: shapFacteurs.map(f => f.effet === 'hausse' ? chartColors.green + 'cc' : chartColors.red + 'cc'),
        borderRadius: 4
      }]
    },
    options: { 
      ...chartOptions, 
      indexAxis: 'y', 
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw}%` } },
        legend: { display: false }
      }, 
      scales: { 
        x: { title: { display: true, text: 'Importance (%)', color: '#8ba8cc', font: { size: 10 } } } 
      } 
    }
  });

  const getEffetIcon = (effet) => effet === 'hausse' ? <TrendingUp size={12} color={chartColors.green} /> : <TrendingDown size={12} color={chartColors.red} />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Prédictions — Modèle ML</div>
        <div className="page-sub">Prévisions de distribution, production et consommation par centre</div>
        <button onClick={handleRefresh} disabled={isRefreshing} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
          {isRefreshing ? 'Chargement...' : 'Rafraîchir'}
        </button>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header"><div className="card-title"><Filter size={16} /> Filtres</div></div>
        <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
          
          {/* Filtre Centre avec barre de recherche */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Centre :</span>
            <div style={{ position: 'relative', minWidth: '250px' }} ref={centreDropdownRef}>
              <button 
                onClick={() => setIsCentreDropdownOpen(!isCentreDropdownOpen)} 
                className="filter-button"
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <span>{selectedCentre ? selectedCentre.name : 'Tous les centres'}</span>
                {isCentreDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {isCentreDropdownOpen && (
                <div className="dropdown-menu">
                  <div className="search-input-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Rechercher un centre..."
                      value={searchCentre}
                      onChange={e => setSearchCentre(e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div 
                    onClick={() => { setSelectedCentre(null); setIsCentreDropdownOpen(false); setSearchCentre(''); }} 
                    className="dropdown-item"
                  >
                    Tous les centres
                  </div>
                  {filteredCentres.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => { setSelectedCentre(c); setIsCentreDropdownOpen(false); setSearchCentre(''); }} 
                      className={`dropdown-item ${selectedCentre?.id === c.id ? 'selected' : ''}`}
                    >
                      {c.name}
                    </div>
                  ))}
                  {filteredCentres.length === 0 && (
                    <div className="dropdown-empty">Aucun centre trouvé</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filtre DR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>DR :</span>
            <div style={{ position: 'relative', minWidth: '150px' }}>
              <button onClick={() => setIsDrDropdownOpen(!isDrDropdownOpen)} className="filter-button">
                {selectedDr ? selectedDr.name : 'Toutes les DR'} <ChevronDown size={14} />
              </button>
              {isDrDropdownOpen && (
                <div className="dropdown-menu">
                  <div onClick={() => { setSelectedDr(null); setIsDrDropdownOpen(false); }} className="dropdown-item">Toutes les DR</div>
                  {drs.map(d => (<div key={d.id} onClick={() => { setSelectedDr(d); setIsDrDropdownOpen(false); }} className="dropdown-item">{d.name}</div>))}
                </div>
              )}
            </div>
          </div>

          {/* Filtre Cible SHAP */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Cible SHAP :</span>
            <div style={{ position: 'relative', minWidth: '150px' }}>
              <button onClick={() => setIsCibleDropdownOpen(!isCibleDropdownOpen)} className="filter-button">
                {CIBLE_OPTIONS.find(c => c.value === selectedCible)?.label || 'Distribution'} <ChevronDown size={14} />
              </button>
              {isCibleDropdownOpen && (
                <div className="dropdown-menu">
                  {CIBLE_OPTIONS.map(opt => (<div key={opt.value} onClick={() => { setSelectedCible(opt.value); setIsCibleDropdownOpen(false); }} className="dropdown-item">{opt.label}</div>))}
                </div>
              )}
            </div>
          </div>

          {/* Filtre Année */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} style={{ color: 'var(--text2)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Année :</span>
            <div style={{ position: 'relative', minWidth: '90px' }}>
              <button onClick={() => setIsAnneeDropdownOpen(!isAnneeDropdownOpen)} className="filter-button">
                {selectedAnnee} <ChevronDown size={14} />
              </button>
              {isAnneeDropdownOpen && (
                <div className="dropdown-menu">
                  {ANNEE_OPTIONS.map(y => (<div key={y} onClick={() => { setSelectedAnnee(y); setIsAnneeDropdownOpen(false); }} className="dropdown-item">{y}</div>))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Graphique 1: Prévisions annuelles avec intervalle */}
      <div className="card">
       
      </div>

      {/* Graphique 2: Volume mensuel vs capacité */}
      <div className="charts-row">
        <div className="card chart-wide">
          <div className="card-header">
            <div className="card-title">
              <Droplets size={14} /> Volume cible mensuel vs capacité (m³)
            </div>
            {selectedDr && <div className="card-sub">DR: {selectedDr.name}</div>}
              {mensuelSourceYear !== selectedAnnee && (
                <div className="card-sub">Données mensuelles indisponibles en {selectedAnnee}, affichage basé sur {mensuelSourceYear}.</div>
              )}
          </div>
          <canvas id="mensuelChart" height="200" style={{ width: '100%', display: 'block' }}></canvas>
        </div>
      </div>

      {/* Graphique 3: Taux de saturation mensuel */}
      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Gauge size={14} /> Taux de saturation mensuel (%)
            </div>
          </div>
          <canvas id="saturationChart" height="200" style={{ width: '100%', display: 'block' }}></canvas>
        </div>
      </div>

      {/* Graphique 4: Capacité par DR */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <BarChart3 size={14} /> Capacité par DR
          </div>
          {selectedDr && <div className="card-sub">DR: {selectedDr.name}</div>}
          {drSourceYear !== selectedAnnee && (
            <div className="card-sub">Données DR indisponibles en {selectedAnnee}, affichage basé sur {drSourceYear}.</div>
          )}
        </div>
        <canvas id="drChart" height="200" style={{ width: '100%', display: 'block' }}></canvas>
      </div>

      {/* Section SHAP Global */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Activity size={14} /> Importance globale des facteurs (% contribution moyenne)
          </div>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: chartColors.green }}></div>Effet hausse</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: chartColors.red }}></div>Effet baisse</div>
          </div>
        </div>
        <canvas id="shapChart" height="250" style={{ width: '100%', display: 'block' }}></canvas>
      </div>

      {/* Détail par facteur */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Détail par facteur — effet hausse / baisse</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px', padding: '16px' }}>
          {shapFacteurs.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '6px', background: 'var(--bg2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getEffetIcon(f.effet)}
                <span style={{ fontSize: '0.8rem' }}>{f.variable}</span>
              </div>
              <span style={{ fontWeight: 600, color: f.effet === 'hausse' ? chartColors.green : chartColors.red }}>{f.importance_pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Analyse par centre (top 5 facteurs) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Analyse prévisionnelle (selon filtres)</div>
          {selectedCentre && <div className="card-sub">Centre: {selectedCentre.name}</div>}
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg2)', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>{modelAnalysis.scope} · {selectedAnnee} · {CIBLE_OPTIONS.find(c => c.value === selectedCible)?.label}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '8px' }}>{modelAnalysis.trendSentence}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '8px' }}>{modelAnalysis.intervalSentence}</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div className="chip info">Points modèle: {modelAnalysis.points}</div>
              <div className="chip ok">Q50: {Math.round(modelAnalysis.q50 || 0).toLocaleString('fr-FR')} m³</div>
              <div className="chip warn">Incertitude: {modelAnalysis.uncertaintyPct != null ? `${modelAnalysis.uncertaintyPct.toFixed(1)}%` : 'N/A'}</div>
            </div>
          </div>

          {selectedCentre ? (
            <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg2)' }}>
              <div style={{ fontWeight: 600, marginBottom: '12px' }}>Facteurs du centre {selectedCentre.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {shapParCentre.filter(s => s.id_centre === selectedCentre.id).map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', background: s.effet === 'hausse' ? `${chartColors.green}22` : `${chartColors.red}22` }}>
                    {getEffetIcon(s.effet)}
                    <span style={{ fontSize: '0.8rem' }}>{s.facteur}</span>
                    <span style={{ fontWeight: 600, color: s.effet === 'hausse' ? chartColors.green : chartColors.red }}>{Math.abs(s.contribution * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>
              <Activity size={24} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <div>Sélectionnez un centre pour afficher le détail SHAP centre, tout en conservant l'analyse prévisionnelle globale filtrée.</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .filter-button { 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          gap: 8px; 
          padding: 6px 12px; 
          border-radius: 6px; 
          border: 1px solid var(--border); 
          background: var(--bg3); 
          color: var(--text); 
          font-size: 0.85rem; 
          cursor: pointer; 
          min-width: 150px; 
        }
        .filter-button:hover { background: var(--bg2); border-color: var(--primary); }
        
        .dropdown-menu { 
          position: absolute; 
          top: 100%; 
          left: 0; 
          right: 0; 
          margin-top: 4px; 
          background: var(--bg3); 
          border: 1px solid var(--border); 
          border-radius: 8px; 
          max-height: 300px; 
          overflow-y: auto; 
          z-index: 1000; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
        }
        
        .dropdown-item { 
          padding: 8px 12px; 
          cursor: pointer; 
          font-size: 0.85rem; 
          color: var(--text); 
          transition: background 0.2s; 
        }
        .dropdown-item:hover { background: var(--bg2); }
        .dropdown-item.selected { background: var(--primary); color: white; }
        
        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          background: var(--bg3);
        }
        .search-icon { color: var(--text2); }
        .search-input {
          flex: 1;
          padding: 6px 0;
          border: none;
          outline: none;
          font-size: 0.85rem;
          background: transparent;
          color: var(--text);
        }
        .search-input::placeholder { color: var(--text2); }
        
        .dropdown-empty {
          padding: 12px;
          text-align: center;
          color: var(--text2);
          font-size: 0.8rem;
        }
        
        .legend { display: flex; gap: 12px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; color: var(--text2); }
        .legend-dot { width: 10px; height: 10px; border-radius: 2px; }
        
        .charts-row { margin-bottom: 20px; }
        .chart-wide { width: 100%; }
      `}</style>
    </div>
  );
};

export default Prediction_Y;