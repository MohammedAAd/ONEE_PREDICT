import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Globe, ChevronDown, ChevronUp, RefreshCw, Calendar, Filter, Building2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import { useChart } from '../hooks/useChart';
import { chartColors, chartOptions } from '../utils/chartConfig';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const Production = () => {
  // États pour chaque chart
  const [monthlyData, setMonthlyData] = useState(null);
  const [installationsData, setInstallationsData] = useState([]);
  const [statsData, setStatsData] = useState({});
  const [availableYears, setAvailableYears] = useState([]);
  const [installationsList, setInstallationsList] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [isInstallationDropdownOpen, setIsInstallationDropdownOpen] = useState(false);
  
  // État pour les filtres
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState({ code: 'all', name: 'Toutes les régions' });
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedInstallation, setSelectedInstallation] = useState(null);
  
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  // 🔄 Récupérer la liste des régions
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        setLoadingRegions(true);
        const response = await fetch(`${API_BASE}/dashboard/v2/regions`);
        if (!response.ok) throw new Error('Erreur chargement régions');
        const data = await response.json();
        setRegions(data);
      } catch (err) {
        console.error('Erreur chargement régions:', err);
      } finally {
        setLoadingRegions(false);
      }
    };
    fetchRegions();
  }, []);

  // 📊 API 1: Production mensuelle
  const fetchMonthlyData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        year: selectedYear.toString()
      });
      if (selectedInstallation) {
        params.append('installation', selectedInstallation.id);
      }
      const response = await fetch(`${API_BASE}/production/monthly?${params}`);
      if (!response.ok) throw new Error('Erreur chargement production mensuelle');
      const data = await response.json();
      setMonthlyData(data);
    } catch (err) {
      console.error("❌ Erreur monthly:", err);
    }
  }, [selectedRegion.code, selectedYear, selectedInstallation]);

  // 📊 API 2: Installations
  const fetchInstallationsData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        year: selectedYear.toString()
      });
      const response = await fetch(`${API_BASE}/production/installations?${params}`);
      if (!response.ok) throw new Error('Erreur chargement installations');
      const data = await response.json();
      setInstallationsData(data);
    } catch (err) {
      console.error("❌ Erreur installations:", err);
    }
  }, [selectedRegion.code, selectedYear]);

  // 📊 API 3: Statistiques
  const fetchStatsData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        year: selectedYear.toString()
      });
      const response = await fetch(`${API_BASE}/production/stats?${params}`);
      if (!response.ok) throw new Error('Erreur chargement stats');
      const data = await response.json();
      setStatsData(data);
    } catch (err) {
      console.error("❌ Erreur stats:", err);
    }
  }, [selectedRegion.code, selectedYear]);

  // 📊 API 4: Années disponibles
  const fetchAvailableYears = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/production/years`);
      if (!response.ok) throw new Error('Erreur chargement années');
      const data = await response.json();
      setAvailableYears(data);
    } catch (err) {
      console.error("❌ Erreur années:", err);
    }
  }, []);

  // 📊 API 5: Liste des installations pour le filtre
  const fetchInstallationsList = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code
      });
      const response = await fetch(`${API_BASE}/production/installations/list?${params}`);
      if (!response.ok) throw new Error('Erreur chargement liste installations');
      const data = await response.json();
      setInstallationsList(data);
    } catch (err) {
      console.error("❌ Erreur liste installations:", err);
    }
  }, [selectedRegion.code]);

  // 🔄 Charger toutes les données
  const fetchAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setLoading(true);
      
      await Promise.all([
        fetchMonthlyData(),
        fetchInstallationsData(),
        fetchStatsData(),
        fetchAvailableYears(),
        fetchInstallationsList()
      ]);
    } catch (err) {
      console.error("❌ Erreur chargement données:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchMonthlyData, fetchInstallationsData, fetchStatsData, fetchAvailableYears, fetchInstallationsList]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handlers
  const handleRegionChange = (region) => {
    setSelectedRegion(region);
    setIsRegionDropdownOpen(false);
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  const handleInstallationChange = (installation) => {
    setSelectedInstallation(installation);
    setIsInstallationDropdownOpen(false);
  };

  const handleClearInstallation = () => {
    setSelectedInstallation(null);
  };

  const handleRefresh = () => {
    fetchAllData();
  };

  // 📊 Chart production mensuelle
  const monthly = monthlyData || { labels: months, historique: [], prediction: [], year: selectedYear, pred_year: selectedYear + 1 };
  const formatMm3 = (value) => `${(Number(value) || 0).toFixed(2)} Mm³`;
  const hasPrediction = useMemo(
    () => (Array.isArray(monthly.prediction) ? monthly.prediction.some(v => (v || 0) > 0) : false),
    [monthly.prediction]
  );
  const monthlyRisk = useMemo(() => {
    const hist = Array.isArray(monthly.historique) ? monthly.historique : [];
    const pred = Array.isArray(monthly.prediction) ? monthly.prediction : [];
    if (!pred.length || pred.every(v => (v || 0) <= 0)) {
      return {
        average: 0,
        riskMonths: [],
        message: monthly.pred_warning || 'Aucune projection disponible pour ce filtre.',
      };
    }
    const avgPred = pred.reduce((sum, v) => sum + (v || 0), 0) / pred.length;
    const riskMonths = pred.map((value, idx) => ({
      month: months[idx] || `M${idx + 1}`,
      value: value || 0,
      deltaPct: hist[idx] ? ((value || 0) - hist[idx]) / Math.max(hist[idx], 1) * 100 : 0,
    })).filter(x => x.value > 0 && (x.value < avgPred * 0.90 || x.deltaPct < -8));
    return {
      average: avgPred,
      riskMonths: riskMonths.slice(0, 3),
      message: riskMonths.length > 0
        ? `Mois à surveiller : ${riskMonths.slice(0, 3).map(x => x.month).join(', ')}.`
        : 'Aucun mois critique détecté sur les 12 prochains mois.',
    };
  }, [monthly.historique, monthly.prediction, monthly.pred_warning]);
  
  useChart('prodMonthChart', {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: `${monthly.year} (historique)`,
          data: monthly.historique || [],
          borderColor: chartColors.teal,
          backgroundColor: chartColors.teal + '15',
          fill: true, tension: 0.4, pointRadius: 3
        },
        {
          label: `${monthly.pred_label || `${monthly.pred_year}`} (projection)`,
          data: hasPrediction ? (monthly.prediction || []) : Array(12).fill(null),
          borderColor: chartColors.amber,
          backgroundColor: chartColors.amber + '10',
          fill: true, tension: 0.4, pointRadius: 3, borderDash: [5, 5]
        }
      ]
    },
    options: { 
      ...chartOptions, 
      plugins: { 
        ...chartOptions.plugins, 
        legend: { display: true, labels: { color: '#8ba8cc', boxWidth: 10, font: { size: 10 } } } 
      } 
    }
  });

  const installations = installationsData;
  const stats = statsData;

  const getStatusClass = (status) => ({
    ok: 'chip ok', warn: 'chip warn', deficit: 'chip deficit', info: 'chip info'
  }[status] || 'chip info');

  if (loading && !installationsData.length) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="card-title">Chargement des données de production...</div>
          <div className="card-sub">Récupération des données ONEE · {selectedRegion.name}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Modèle B — Prédiction de la Production</div>
        <div className="page-sub">
          Suivi mensuel par installation · Données réelles + projection ML · {selectedRegion.name}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
          {isRefreshing ? 'Chargement...' : 'Rafraîchir'}
        </button>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--primary)' }} />
            Filtres
          </div>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Filtre Région */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} style={{ color: 'var(--text2)' }} />
              <label style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: '500' }}>Région :</label>
            </div>
            <div style={{ position: 'relative', minWidth: '280px' }}>
              <button
                onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
                disabled={loadingRegions}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: loadingRegions ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{loadingRegions ? 'Chargement des régions...' : selectedRegion.name}</span>
                {isRegionDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {isRegionDropdownOpen && !loadingRegions && (
                <div className="dropdown-menu">
                  {regions.map((region) => (
                    <div key={region.code} onClick={() => handleRegionChange(region)} className="dropdown-item">
                      {region.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filtre Année */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--text2)' }} />
              <label style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: '500' }}>Année :</label>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg3)',
                color: 'var(--text)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                minWidth: '100px'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Filtre Installation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} style={{ color: 'var(--text2)' }} />
              <label style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: '500' }}>Installation :</label>
            </div>
            <div style={{ position: 'relative', minWidth: '280px' }}>
              <button
                onClick={() => setIsInstallationDropdownOpen(!isInstallationDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{selectedInstallation ? selectedInstallation.name : 'Toutes les installations'}</span>
                {isInstallationDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {isInstallationDropdownOpen && (
                <div className="dropdown-menu">
                  <div onClick={handleClearInstallation} className="dropdown-item">
                    Toutes les installations
                  </div>
                  {installationsList.map((inst) => (
                    <div key={inst.id} onClick={() => handleInstallationChange(inst)} className="dropdown-item">
                      {inst.name} ({inst.centre})
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedInstallation && (
              <button
                onClick={handleClearInstallation}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--red)',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Effacer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="stats-grid">
        <StatCard type="teal" label="Installations actives" value={stats.installations || "0"} unit="dans le périmètre" />
        <StatCard type="blue" label={`Volume produit ${selectedYear}`} value={stats.volumeYear || stats.volume2024 || "0 M"} unit="m³/an" />
        <StatCard type="amber" label="Taux utilisation moy." value={stats.taux_util ? `${stats.taux_util} %` : "0 %"} unit="volume traité / exploitable" />
        <StatCard type="red" label={`Installations en saturation ${selectedYear}`} value={stats.saturation || stats.saturation2028 || "0"} unit="taux d'utilisation > 85 %" />
      </div>

      <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--amber)' }}>
        <div className="card-header" style={{ paddingBottom: '10px' }}>
          <div>
            <div className="card-title" style={{ fontSize: '1rem' }}>Optimisation 12 mois</div>
            <div className="card-sub">Repérage des mois sensibles et aide à la planification</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '0 0 16px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '6px' }}>Projection mensuelle moyenne</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>
              {monthlyRisk ? formatMm3(monthlyRisk.average) : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '6px' }}>Conclusion</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.6 }}>
              {monthlyRisk ? monthlyRisk.message : 'Chargement des projections...'}
            </div>
          </div>
        </div>
      </div>

      {/* Chart Production Mensuelle */}
      <div className="charts-row">
        <div className="card chart-wide">
          <div className="card-header">
            <div>
              <div className="card-title">Production mensuelle — Saisonnalité et prédiction</div>
              <div className="card-sub">
                Volume produit traité par mois (Mm³) · Historique réel + projection modèle ML
                {selectedInstallation && ` · Installation: ${selectedInstallation.name}`}
                {monthly.pred_warning && ` · ${monthly.pred_warning}`}
              </div>
            </div>
            <div className="legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: chartColors.teal }}></div>{monthly.year} Historique</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: chartColors.amber }}></div>{monthly.pred_label || `${monthly.pred_year} Projection`}</div>
            </div>
          </div>
          <canvas id="prodMonthChart" height="200"></canvas>
        </div>
      </div>

      {/* Tableau Installations */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Installations — Taux d'utilisation annuel</div>
          <div className="card-sub">{selectedRegion.name}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Installation</th>
                <th>Centre production</th>
                <th>DR</th>
                <th>Débit exploitable (m³/h)</th>
                <th>Débit équipé (m³/h)</th>
                <th>Débit utilisé (m³/h)</th>
                <th>Taux util. {selectedYear}</th>
                <th>Taux projeté modèle ({selectedYear})</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {installations.map((inst, idx) => (
                <tr key={idx}>
                  <td style={{ maxWidth: '220px', fontSize: '.75rem' }}>{inst.name}</td>
                  <td>{inst.centre}</td>
                  <td>{inst.dr}</td>
                  <td className="mono">{inst.debitExploitable || 0}</td>
                  <td className="mono">{inst.debitEquipe || 0}</td>
                  <td className="mono">{inst.debit || 0}</td>
                  <td className="mono">{inst.taux2024} %</td>
                  <td className="mono">{inst.tauxForecast ?? inst.taux2028 ?? 0} %</td>
                  <td><span className={getStatusClass(inst.status)}>{inst.statusText}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 8px;
          max-height: 200px;
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
        .dropdown-item:hover {
          background: var(--bg2);
        }
      `}</style>
    </div>
  );
};

export default Production;