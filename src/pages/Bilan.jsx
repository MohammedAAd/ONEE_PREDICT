// pages/Bilan.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { predictionAPI, centresAPI } from '../services/api';
import { 
  BarChart3, Building2, Calendar, RefreshCw, TrendingUp, TrendingDown, 
  AlertCircle, CheckCircle, AlertTriangle, Database, MapPin, Droplets,
  Activity, PieChart, ChevronDown, Filter, Globe, Layers, FileText,
  Plus, Minus, RefreshCw as RefreshIcon, X
} from 'lucide-react';

const Bilan = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    dr: 'all',
    year: 2024
  });
  
  const [drsList, setDrsList] = useState([]);
  const [centresData, setCentresData] = useState({});
  const [bilansData, setBilansData] = useState([]);
  const [years, setYears] = useState([2024, 2025, 2026]);
  const realDataYears = [2024, 2025, 2026];
  const [stats, setStats] = useState(null);
  const [loadingCentres, setLoadingCentres] = useState(false);
  const [nationalSoldes, setNationalSoldes] = useState(null);
  
  const chartInstanceRef = useRef(null);
  const isLoadingRef = useRef(false);
  const pendingFilterRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Nettoyer le graphique
  const destroyChart = () => {
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      } catch (err) {
        console.warn('Erreur lors de la destruction du graphique:', err);
      }
    }
  };

  // Annuler les requêtes en cours
  const cancelPendingRequests = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Charger la liste des DRs (une seule fois)
  useEffect(() => {
    const loadDRs = async () => {
      try {
        const response = await centresAPI.getAllDRs(filters.year);
        let drsArray = [];
        
        if (Array.isArray(response)) {
          drsArray = response;
        } else if (response && response.data && Array.isArray(response.data)) {
          drsArray = response.data;
        }

        // Normaliser le format de DR pour garantir id/nom/nb_centres.
        const normalizedDrs = drsArray
          .map((dr, index) => {
            if (typeof dr === 'string') {
              return {
                id: dr,
                nom: dr,
                nb_centres: 0,
              };
            }
            return {
              id: dr?.id ?? dr?.dr ?? String(index),
              nom: dr?.nom ?? dr?.name ?? dr?.id ?? `DR ${index + 1}`,
              nb_centres: Number(dr?.nb_centres ?? dr?.nbCentres ?? 0),
            };
          })
          .filter((dr) => dr.id && dr.nom);

        setDrsList(normalizedDrs);
      } catch (err) {
        console.error('Erreur chargement DRs:', err);
        setError('Impossible de charger les directions régionales');
      }
    };
    
    loadDRs();
  }, [filters.year]);

  // Charger les centres pour un DR spécifique (avec cache)
  const loadCentresForDR = useCallback(async (drId) => {
    if (!drId || drId === 'all') return [];
    
    // Vérifier si déjà en cache
    if (centresData[drId]) {
      return centresData[drId];
    }
    
    setLoadingCentres(true);
    try {
      const centres = await centresAPI.getCentresByDR(drId, filters.year, false);
      let centresArray = [];
      
      if (Array.isArray(centres)) {
        centresArray = centres;
      } else if (centres && centres.data && Array.isArray(centres.data)) {
        centresArray = centres.data;
      }
      
      setCentresData(prev => ({ ...prev, [drId]: centresArray }));
      return centresArray;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Requête annulée pour DR:', drId);
        return [];
      }
      console.error(`Erreur chargement centres pour ${drId}:`, err);
      return [];
    } finally {
      setLoadingCentres(false);
    }
  }, [centresData, filters.year]);

  // Créer le graphique (version améliorée avec vérification du DOM)
  const createChart = useCallback((yearsList, soldesByYear) => {
    // Attendre que le canvas soit disponible
    const canvas = document.getElementById('soldeChart');
    if (!canvas) {
      console.warn('Canvas non trouvé, tentative dans 100ms');
      setTimeout(() => createChart(yearsList, soldesByYear), 100);
      return;
    }
    
    // Vérifier que Chart.js est chargé
    if (!window.Chart) {
      console.warn('Chart.js non chargé, tentative dans 100ms');
      setTimeout(() => createChart(yearsList, soldesByYear), 100);
      return;
    }
    
    destroyChart();
    
    const ctx = canvas.getContext('2d');
    const newChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: yearsList.map(y => y.toString()),
        datasets: [
          {
            label: 'Excédent',
            data: yearsList.map(y => soldesByYear[y]?.solde > 0 ? soldesByYear[y].solde / 1e6 : 0),
            backgroundColor: '#10b981bb',
            borderColor: '#10b981',
            borderWidth: 1,
            stack: 'a'
          },
          {
            label: 'Déficit',
            data: yearsList.map(y => soldesByYear[y]?.solde < 0 ? Math.abs(soldesByYear[y].solde) / 1e6 : 0),
            backgroundColor: '#ef4444bb',
            borderColor: '#ef4444',
            borderWidth: 1,
            stack: 'a'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { 
            display: true, 
            position: 'top', 
            labels: { color: '#8ba8cc', boxWidth: 12, font: { size: 11 } } 
          },
          tooltip: { 
            callbacks: { 
              label: (ctx) => {
                const value = ctx.raw;
                if (value === 0) return `${ctx.dataset.label}: 0 M m³`;
                return `${ctx.dataset.label}: ${value.toFixed(2)} M m³`;
              }
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255,255,255,0.05)' }, 
            title: { display: true, text: 'Volume (Millions m³)', color: '#8ba8cc' }, 
            ticks: { callback: v => v + 'M m³', color: '#8ba8cc' }
          },
          x: { 
            grid: { display: false }, 
            title: { display: true, text: 'Année', color: '#8ba8cc' }, 
            ticks: { color: '#8ba8cc' }
          }
        }
      }
    });
    
    chartInstanceRef.current = newChart;
    console.log('Graphique créé avec succès');
  }, []);

  // Calculer le solde national à partir des prévisions (une seule fois)
  const loadNationalSoldes = useCallback(async () => {
    try {
      const startYear = 2024;
      const endYear = 2026;
      const soldesByYear = {};
      
      for (let y = startYear; y <= endYear; y++) {
        const previsions = await predictionAPI.getPrevisionsAnnuelle(null, null, y, y);
        let previsionsArray = [];
        
        if (Array.isArray(previsions)) {
          previsionsArray = previsions;
        } else if (previsions && previsions.data && Array.isArray(previsions.data)) {
          previsionsArray = previsions.data;
        }
        
        let totalProduction = 0;
        let totalConsommation = 0;
        
        previsionsArray.forEach(p => {
          if (p.cible === 'production') {
            totalProduction += (p.q50 || 0);
          } else if (p.cible === 'consommation_totale') {
            totalConsommation += (p.q50 || 0);
          }
        });
        
        soldesByYear[y] = {
          production: totalProduction,
          consommation: totalConsommation,
          solde: totalProduction - totalConsommation
        };
      }
      
      const yearsList = Object.keys(soldesByYear).sort().map(Number);
      setYears(yearsList);
      setNationalSoldes(soldesByYear);
      
      return soldesByYear;
    } catch (err) {
      console.error('Erreur calcul soldes:', err);
      return {};
    }
  }, []);

  // Effet séparé pour créer le graphique quand les données sont prêtes
  useEffect(() => {
    if (nationalSoldes && years.length > 0) {
      // Petit délai pour s'assurer que le DOM est prêt
      const timer = setTimeout(() => {
        createChart(years, nationalSoldes);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [nationalSoldes, years, createChart]);

  // Charger les bilans (version optimisée)
  const loadBilanData = useCallback(async (dr, year, drs, centres, signal) => {
    // Annuler la requête précédente si elle existe
    cancelPendingRequests();
    
    // Créer un nouvel AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentSignal = signal || abortController.signal;
    
    try {
      let bilanItems = [];
      
      if (dr === 'all') {
        // Bilan par DR - utiliser Promise.all pour paralléliser
        const drPromises = drs.map(async (drItem) => {
          // Vérifier si annulé
          if (currentSignal.aborted) throw new Error('Aborted');
          
          const drCentres = centres[drItem.id] || [];
          
          let totalProduction = 0;
          let totalConsommation = 0;
          
          drCentres.forEach(centre => {
            totalProduction += (centre.production || 0);
            totalConsommation += (centre.consommation || 0);
          });
          
          const solde = totalProduction - totalConsommation;
          const tauxCouverture = totalConsommation > 0 ? (totalProduction / totalConsommation * 100) : 0;
          
          return {
            centre: drItem.nom,
            production: totalProduction,
            consommation: totalConsommation,
            solde: solde,
            tauxCouverture: tauxCouverture,
            nbCentres: drCentres.length,
            status: solde < 0 ? 'deficit' : (tauxCouverture < 95 ? 'warn' : 'ok')
          };
        });
        
        bilanItems = await Promise.all(drPromises);
      } else {
        // Bilan par centre pour un DR spécifique
        const drCentres = centres[dr] || [];
        
        if (drCentres.length > 0) {
          bilanItems = drCentres.map(centre => {
            const production = centre.production || 0;
            const consommation = centre.consommation || 0;
            const solde = production - consommation;
            const tauxCouverture = consommation > 0 ? (production / consommation * 100) : 0;
            
            return {
              centre: centre.nom || centre.id || 'Centre inconnu',
              production: production,
              consommation: consommation,
              solde: solde,
              tauxCouverture: tauxCouverture,
              tauxBranchement: centre.taux_branchement || 0,
              population: centre.population || 0,
              commune: centre.commune || '',
              province: centre.province || '',
              status: solde < 0 ? 'deficit' : (tauxCouverture < 95 ? 'warn' : 'ok')
            };
          });
        }
      }
      
      // Vérifier si la requête n'a pas été annulée avant de mettre à jour l'état
      if (!currentSignal.aborted) {
        // Trier par solde décroissant
        bilanItems.sort((a, b) => b.solde - a.solde);
        
        // Ajouter les textes de statut
        bilanItems = bilanItems.map(b => ({
          ...b,
          statusText: b.status === 'deficit' ? 'Déficit' : (b.status === 'warn' ? 'Tension' : 'OK')
        }));
        
        setBilansData(bilanItems);
        
        // Calculer les stats globales
        const totalProd = bilanItems.reduce((sum, b) => sum + b.production, 0);
        const totalCons = bilanItems.reduce((sum, b) => sum + b.consommation, 0);
        setStats({
          production_total: totalProd,
          consommation_total: totalCons,
          nb_items: bilanItems.length
        });
      }
      
    } catch (err) {
      if (err.message !== 'Aborted' && err.name !== 'AbortError') {
        console.error('Erreur chargement bilan:', err);
        if (!currentSignal.aborted) {
          setError('Erreur lors du chargement des données bilan');
        }
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  // Chargement initial (une seule fois)
  useEffect(() => {
    const init = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setLoading(true);
      
      try {
        // Charger les soldes nationaux
        await loadNationalSoldes();
        
        // Charger les centres pour tous les DRs
        const allCentres = { ...centresData };
        for (const dr of drsList) {
          if (!allCentres[dr.id]) {
            const centres = await loadCentresForDR(dr.id);
            allCentres[dr.id] = centres;
          }
        }
        
        // Charger les bilans
        await loadBilanData(filters.dr, filters.year, drsList, allCentres);
        
      } catch (err) {
        console.error('Erreur initialisation:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    };
    
    if (drsList.length > 0) {
      init();
    }
    
    // Cleanup à la fin
    return () => {
      cancelPendingRequests();
    };
  }, [drsList]); // Seulement quand la liste des DRs change

  // Effet séparé pour les changements de filtre (optimisé)
  useEffect(() => {
    // Éviter l'exécution pendant le chargement initial
    if (loading || drsList.length === 0) return;
    
    // Debounce pour éviter les appels multiples
    const timeoutId = setTimeout(async () => {
      // Annuler les requêtes précédentes
      cancelPendingRequests();
      
      // Sauvegarder les filtres actuels
      const currentFilters = { dr: filters.dr, year: filters.year };
      pendingFilterRef.current = currentFilters;
      
      try {
        // Mettre à jour le cache des centres si nécessaire
        const centres = { ...centresData };
        
        // Si le DR sélectionné n'a pas de centres, les charger
        if (currentFilters.dr !== 'all' && !centres[currentFilters.dr]) {
          const newCentres = await loadCentresForDR(currentFilters.dr);
          centres[currentFilters.dr] = newCentres;
        }
        
        // Vérifier si les filtres n'ont pas changé pendant le chargement
        if (pendingFilterRef.current === currentFilters) {
          await loadBilanData(currentFilters.dr, currentFilters.year, drsList, centres);
        }
      } catch (err) {
        console.error('Erreur lors du changement de filtre:', err);
      }
    }, 300); // Délai de 300ms
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [filters.dr, filters.year, loading, drsList, centresData, loadCentresForDR, loadBilanData]);

  // Nettoyer le graphique au démontage
  useEffect(() => {
    return () => {
      destroyChart();
      cancelPendingRequests();
    };
  }, []);

  const getStatusClass = (status) => {
    const classes = { ok: 'chip ok', warn: 'chip warn', deficit: 'chip deficit' };
    return classes[status] || 'chip info';
  };

  const getSoldeColor = (solde) => {
    if (solde < 0) return '#ef4444';
    if (solde > 0) return '#10b981';
    return '#f59e0b';
  };

  const getTauxColor = (taux) => {
    if (taux < 90) return '#ef4444';
    if (taux < 100) return '#f59e0b';
    return '#10b981';
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M';
    if (num >= 1e3) return (num / 1e3).toFixed(0) + ' k';
    return num.toLocaleString();
  };

  const formatPercentage = (num) => {
    if (!num && num !== 0) return '0%';
    return num.toFixed(1) + '%';
  };

  const getDrCentreCount = (dr) => {
    if (!dr?.id) return 0;
    const fromCache = centresData?.[dr.id]?.length;
    if (Number.isFinite(fromCache) && fromCache > 0) return fromCache;
    return Number(dr?.nb_centres || 0);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="card-title">
            <RefreshCw size={20} style={{ display: 'inline', marginRight: '8px', animation: 'spin 1s linear infinite' }} />
            Chargement des données ONEE...
          </div>
          <div className="card-sub">Connexion à l'API</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card" style={{ color: '#ef4444', textAlign: 'center', padding: '60px' }}>
          <div className="card-title">
            <AlertCircle size={24} style={{ display: 'inline', marginRight: '8px' }} />
            Erreur de chargement
          </div>
          <div className="card-sub">{error}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} style={{ display: 'inline', marginRight: '8px' }} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <BarChart3 size={20} style={{ display: 'inline', marginRight: '8px' }} />
          Bilan Ressource / Besoin
        </div>
        <div className="page-sub">
          <Database size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Données réelles ONEE · Production vs Consommation par Direction Régionale
        </div>
      </div>

      <div className="block-title real">
        <div className="block-title-text">
          <Database size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Bloc Référence (2024-2026)
        </div>
        <div className="block-sub">Pilotage opérationnel sur l'année de référence sélectionnée (DR et centres).</div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>
            <Building2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Direction Régionale:
          </label>
          <select 
            value={filters.dr} 
            onChange={(e) => handleFilterChange('dr', e.target.value)} 
            className="filter-select"
          >
            <option value="all">
              Toutes les DRs
            </option>
            {drsList.map((dr, index) => (
            <option key={dr.id || index} value={dr.id || index}>
              {dr.nom} ({getDrCentreCount(dr)} centres)
            </option>
          ))}
          </select>
        </div>

        <div className="filter-group">
          <label>
            <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Année de référence:
          </label>
          <select 
            value={filters.year} 
            onChange={(e) => handleFilterChange('year', parseInt(e.target.value))} 
            className="filter-select"
          >
          {realDataYears.map(y => (
        <option key={y} value={y}>{y}</option>
         ))}
          </select>
        </div>

        {stats && (
          <div className="stats-summary">
            <div className="counter" style={{ marginBottom: 0, display: 'flex', gap: '24px' }}>
              <div className="stat-item">
                <span className="stat-label">
                  <TrendingUp size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Production:
                </span>
                <span className="stat-value">{formatNumber(stats.production_total)} m³</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">
                  <TrendingDown size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Consommation:
                </span>
                <span className="stat-value">{formatNumber(stats.consommation_total)} m³</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">
                  <Activity size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Solde:
                </span>
                <span className="stat-value" style={{ color: getSoldeColor((stats.production_total || 0) - (stats.consommation_total || 0)) }}>
                  {formatNumber((stats.production_total || 0) - (stats.consommation_total || 0))} m³
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="block-title forecast">
        <div className="block-title-text">
          <Activity size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Bloc Prévision (2025-2026)
        </div>
        <div className="block-sub">Vision prospective nationale (agrégation des prévisions ML).</div>
      </div>

      <div className="charts-row">
        <div className="card chart-wide">
          <div className="card-header">
            <div>
              <div className="card-title">
                <PieChart size={18} style={{ display: 'inline', marginRight: '8px' }} />
                Évolution du solde ressource/besoin
              </div>
              <div className="card-sub">
                <Activity size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Prévisions ML 2025-2026 (avec base 2024) · Agrégation nationale
              </div>
            </div>
            <div className="legend">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#10b981' }}></div>
                <CheckCircle size={12} /> Excédent
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#ef4444' }}></div>
                <AlertTriangle size={12} /> Déficit
              </div>
            </div>
          </div>
          <div className="prediction-chart-box" style={{ minHeight: '400px', position: 'relative' }}>
            <canvas 
              id="soldeChart" 
              className="prediction-chart-canvas"
              style={{ width: '100%', height: '400px' }}
            ></canvas>
          </div>
        </div>
      </div>

      <div className="block-title real" style={{ marginTop: '4px' }}>
        <div className="block-title-text">
          <FileText size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Détail Réel par DR / Centre
        </div>
        <div className="block-sub">Comparaison production vs consommation pour l'année réelle sélectionnée.</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileText size={18} style={{ display: 'inline', marginRight: '8px' }} />
            Bilan par {filters.dr === 'all' ? 'Direction Régionale' : 'centre'} — {filters.year}
            {filters.dr !== 'all' && bilansData.length > 0 && (
              <span className="counter" style={{ marginLeft: '12px', marginBottom: 0, fontSize: '14px' }}>
                {bilansData.length} centre(s)
              </span>
            )}
          </div>
          <button className="btn-icon" onClick={async () => {
            await loadBilanData(filters.dr, filters.year, drsList, centresData);
          }} title="Actualiser">
            <RefreshIcon size={16} />
          </button>
        </div>
        
        {loadingCentres && filters.dr !== 'all' ? (
          <div className="loading-centres">
            <div className="spinner-small"></div>
            <p><RefreshCw size={14} style={{ display: 'inline', marginRight: '8px' }} /> Chargement des centres...</p>
          </div>
        ) : bilansData.length === 0 ? (
          <div className="no-data">
            <div className="no-data-icon">
              <Database size={48} />
            </div>
            <p>Aucune donnée disponible pour cette sélection</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{filters.dr === 'all' ? 'Direction Régionale' : 'Centre'}</th>
                  {filters.dr !== 'all' && <th>Commune/Province</th>}
                  <th>Production (m³)</th>
                  <th>Consommation (m³)</th>
                  <th>Solde (m³)</th>
                  <th>Taux couverture</th>
                  {filters.dr !== 'all' && <th>Taux branchement</th>}
                  <th>Situation</th>
                </tr>
              </thead>
              <tbody>
                {bilansData.map((b, idx) => (
                  <tr key={idx}>
                    <td className="centre-name">
                      <MapPin size={14} style={{ display: 'inline', marginRight: '8px', color: 'var(--text2)' }} />
                      {b.centre}
                      {b.nbCentres && <span className="badge">{b.nbCentres} centres</span>}
                    </td>
                    {filters.dr !== 'all' && (
                      <td className="mono">
                        {b.commune || b.province || '-'}
                      </td>
                    )}
                    <td className="mono">{formatNumber(b.production)}</td>
                    <td className="mono">{formatNumber(b.consommation)}</td>
                    <td className="mono" style={{ color: getSoldeColor(b.solde), fontWeight: 'bold' }}>
                      {b.solde >= 0 ? <Plus size={12} style={{ display: 'inline' }} /> : <Minus size={12} style={{ display: 'inline' }} />}
                      {formatNumber(Math.abs(b.solde))}
                    </td>
                    <td className="mono" style={{ color: getTauxColor(b.tauxCouverture), fontWeight: 'bold' }}>
                      {formatPercentage(b.tauxCouverture)}
                    </td>
                    {filters.dr !== 'all' && (
                      <td className="mono">{formatPercentage(b.tauxBranchement)}</td>
                    )}
                    <td>
                      <span className={getStatusClass(b.status)}>
                        {b.status === 'deficit' && <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />}
                        {b.status === 'warn' && <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />}
                        {b.status === 'ok' && <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />}
                        {b.status === 'deficit' ? 'Déficit' : (b.status === 'warn' ? 'Tension' : 'OK')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .block-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          margin: 0 0 12px;
          border: 1px solid var(--border);
          background: var(--bg2);
          flex-wrap: wrap;
        }

        .block-title.real {
          border-left: 4px solid #0ea5e9;
        }

        .block-title.forecast {
          border-left: 4px solid #f59e0b;
        }

        .block-title-text {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
        }

        .block-sub {
          font-size: 0.78rem;
          color: var(--text2);
          line-height: 1.35;
        }

        .filters-bar {
          display: flex;
          gap: 20px;
          padding: 20px;
          background: var(--bg2);
          border-radius: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: flex-end;
          border: 1px solid var(--border);
        }
        
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
        }
        
        .filter-select {
          padding: 10px 14px;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-size: 14px;
          min-width: 280px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .filter-select:hover {
          border-color: var(--primary);
        }
        
        .stats-summary {
          display: flex;
          gap: 24px;
          margin-left: auto;
        }
        
        .stat-item {
          display: flex;
          gap: 8px;
          font-size: 13px;
          align-items: center;
        }
        
        .stat-label {
          color: var(--text2);
          display: flex;
          align-items: center;
        }
        
        .stat-value {
          font-weight: 600;
          color: var(--text);
        }
        
        .card {
          background: var(--bg2);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .card-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          color: var(--text);
        }
        
        .card-sub {
          font-size: 13px;
          color: var(--text2);
          margin-top: 4px;
          display: flex;
          align-items: center;
        }
        
        .legend {
          display: flex;
          gap: 16px;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text2);
        }
        
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }
        
        .btn-icon {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 6px;
          color: var(--text2);
          transition: all 0.2s;
          display: flex;
          align-items: center;
        }
        
        .btn-icon:hover {
          background: var(--bg3);
        }
        
        .table-responsive {
          overflow-x: auto;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .data-table th {
          text-align: left;
          padding: 12px;
          background: var(--bg3);
          color: var(--text2);
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          border-bottom: 1px solid var(--border);
        }
        
        .data-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }
        
        .data-table tr:hover {
          background: rgba(59, 130, 246, 0.05);
        }
        
        .centre-name {
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .badge {
          font-size: 10px;
          padding: 2px 8px;
          background: var(--bg3);
          border-radius: 20px;
          color: var(--text2);
        }
        
        .mono {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 13px;
        }
        
        .chip {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        
        .chip.ok {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }
        
        .chip.warn {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }
        
        .chip.deficit {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
        
        .no-data {
          text-align: center;
          padding: 60px;
          color: var(--text2);
        }
        
        .no-data-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .loading-centres {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          gap: 12px;
          color: var(--text2);
        }
        
        .spinner-small {
          width: 30px;
          height: 30px;
          border: 2px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .counter {
          background: var(--primary);
          color: white;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 12px;
        }

        .prediction-chart-box {
          min-height: 400px;
          position: relative;
        }

        .prediction-chart-canvas {
          width: 100% !important;
          height: 400px !important;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Bilan;