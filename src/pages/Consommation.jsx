import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Globe, ChevronDown, ChevronUp, RefreshCw, Calendar, List, TrendingUp, TrendingDown } from 'lucide-react';
import { chartColors, chartOptions } from '../utils/chartConfig';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Années disponibles pour les filtres
const AVAILABLE_YEARS = Array.from(
  { length: 2030 - 1994 + 1 },
  (_, i) => 1994 + i
);

// Limites disponibles pour le filtre centres
const AVAILABLE_LIMITS = [5, 10, 15, 20, 30, 50];

// Hook Chart personnalisé
const useChart = (canvasId, config, dependencies = []) => {
  const [chart, setChart] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let chartInstance = null;
    let retryTimeout = null;

    const initChart = () => {
      const canvas = document.getElementById(canvasId);
      if (!canvas && retryCount < 5) {
        retryTimeout = setTimeout(() => setRetryCount(prev => prev + 1), 500);
        return;
      }

      if (!canvas) {
        console.error(`Canvas #${canvasId} non trouvé après 5 tentatives`);
        return;
      }

      if (window.Chart) {
        try {
          if (chart) chart.destroy();
          chartInstance = new window.Chart(canvas.getContext('2d'), config);
          setChart(chartInstance);
        } catch (error) {
          console.error(`Erreur création graphique ${canvasId}:`, error);
        }
      }
    };

    initChart();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (chartInstance) chartInstance.destroy();
    };
  }, [canvasId, JSON.stringify(config), retryCount, ...dependencies]);
};

const Consommation = () => {
  const [activeTab, setActiveTab] = useState('prevision');
  
  const [usageData, setUsageData] = useState({ labels: ['2024', '2030'], datasets: [] });
  const [centresData, setCentresData] = useState([]);
  const [previsionsData, setPrevisionsData] = useState([]);
  const [previsionEvolution, setPrevisionEvolution] = useState({ labels: [], values: [], tendance: 0, tauxCroissance: 0 });
  const [forecastYears, setForecastYears] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isLimitDropdownOpen, setIsLimitDropdownOpen] = useState(false);
  
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState({ code: 'all', name: 'Toutes les régions' });
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedLimit, setSelectedLimit] = useState(10);
  const [year1, setYear1] = useState(2024);
  const [year2, setYear2] = useState(2030);
  const [isYear1DropdownOpen, setIsYear1DropdownOpen] = useState(false);
  const [isYear2DropdownOpen, setIsYear2DropdownOpen] = useState(false);

  const chartLoadedRef = useRef(false);

  const formatMm3 = (value) => {
    const v = Number(value || 0);
    if (Math.abs(v) >= 1) return `${v.toFixed(1)} M m³`;
    if (Math.abs(v) >= 0.1) return `${v.toFixed(2)} M m³`;
    return `${v.toFixed(3)} M m³`;
  };

  // Charger Chart.js dynamiquement
  useEffect(() => {
    if (!window.Chart && !chartLoadedRef.current) {
      chartLoadedRef.current = true;
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.onload = () => console.log('Chart.js chargé');
      script.onerror = () => console.error('Erreur chargement Chart.js');
      document.head.appendChild(script);
    }
  }, []);

  // Récupérer la liste des régions
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        setLoadingRegions(true);
        const response = await fetch(`${API_BASE}/dashboard/v2/regions`);
        if (!response.ok) throw new Error('Erreur chargement régions');
        const data = await response.json();
        setRegions(data);
        const currentRegion = data.find(r => r.code === selectedRegion.code);
        if (currentRegion) {
          setSelectedRegion(currentRegion);
        }
      } catch (err) {
        console.error('Erreur chargement régions:', err);
        setRegions([{ code: 'all', name: 'Toutes les régions' }]);
      } finally {
        setLoadingRegions(false);
      }
    };
    fetchRegions();
  }, []);

  // Récupérer les prévisions
  const fetchPrevisionsConsommation = useCallback(async () => {
    try {
      console.log('Chargement des prévisions consommation...');
      
      try {
        const params = new URLSearchParams({ cible: 'consommation_totale' });
        if (selectedRegion.code !== 'all') {
          params.append('region', selectedRegion.name);
        }
        
        const response = await fetch(`${API_BASE}/prediction/previsions-annuelles?${params}`);
        
        if (response.ok) {
          const data = await response.json();
          let previsionsArray = [];
          
          if (Array.isArray(data)) {
            previsionsArray = data;
          } else if (data && data.data && Array.isArray(data.data)) {
            previsionsArray = data.data;
          } else if (data && data.previsions_annuelles) {
            previsionsArray = data.previsions_annuelles;
          }
          
          if (previsionsArray.length > 0) {
            const evolutionByYear = {};
            previsionsArray.forEach(p => {
              if (p.cible === 'consommation_totale') {
                const annee = p.annee;
                const valeur = (p.q50 || p.valeur || 0) / 1e6;
                if (!evolutionByYear[annee]) {
                  evolutionByYear[annee] = 0;
                }
                evolutionByYear[annee] += valeur;
              }
            });
            
            const years = Object.keys(evolutionByYear).map(Number).sort((a, b) => a - b);
            if (years.length > 0) {
              const values = years.map(y => evolutionByYear[y]);
              const firstValue = values[0] || 0;
              const lastValue = values[values.length - 1] || 0;
              const tendance = lastValue - firstValue;
              const tauxCroissance = firstValue > 0 ? ((lastValue - firstValue) / firstValue * 100) : 0;
              
              setPrevisionEvolution({
                labels: years,
                values: values,
                tendance: tendance,
                tauxCroissance: tauxCroissance
              });
              setForecastYears(years);
              
              setPrevisionsData(previsionsArray);
            }
          } else {
            setPrevisionEvolution({
              labels: [],
              values: [],
              tendance: 0,
              tauxCroissance: 0
            });
            setForecastYears([]);
            setPrevisionsData([]);
          }
        }
      } catch (err) {
        console.warn('Erreur API prévisions:', err);
      }
      
    } catch (err) {
      console.error("Erreur prévisions:", err);
    }
  }, [selectedRegion.code, selectedRegion.name]);

  useEffect(() => {
    if (forecastYears.length > 0 && !forecastYears.includes(selectedYear)) {
      setSelectedYear(forecastYears[forecastYears.length - 1]);
    }
  }, [forecastYears, selectedYear]);

  const displayedPrevision = useMemo(() => {
    const rows = previsionEvolution.labels
      .map((year, index) => ({ year: Number(year), value: previsionEvolution.values[index] }))
      .filter((row) => row.year <= selectedYear);
    const values = rows.map((row) => row.value);
    const first = values[0] || 0;
    const current = values[values.length - 1] || 0;
    return {
      labels: rows.map((row) => row.year),
      values,
      firstYear: rows[0]?.year ?? null,
      currentYear: rows[rows.length - 1]?.year ?? null,
      tendance: current - first,
      tauxCroissance: first > 0 ? ((current - first) / first) * 100 : 0,
    };
  }, [previsionEvolution, selectedYear]);

  // Récupérer la consommation par usage
  const fetchUsageData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        year1: year1.toString(),
        year2: year2.toString()
      });
      const response = await fetch(`${API_BASE}/consommation/usage?${params}`);
      if (!response.ok) throw new Error('Erreur chargement usage');
      const data = await response.json();
      setUsageData(data);
    } catch (err) {
      console.error("Erreur usage:", err);
      setUsageData({
        labels: [year1.toString(), year2.toString()],
        datasets: []
      });
    }
  }, [selectedRegion.code, year1, year2]);

  // Récupérer les centres
  const fetchCentresData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        limit: selectedLimit.toString(),
        year: selectedYear.toString()
      });
      const response = await fetch(`${API_BASE}/consommation/centres?${params}`);
      if (!response.ok) throw new Error('Erreur chargement centres');
      const data = await response.json();
      setCentresData(data);
    } catch (err) {
      console.error("Erreur centres:", err);
      setCentresData([]);
    }
  }, [selectedRegion.code, selectedYear, selectedLimit]);

  // Charger toutes les données
  const fetchAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setLoading(true);
      
      await Promise.all([
        fetchPrevisionsConsommation(),
        fetchUsageData(),
        fetchCentresData()
      ]);
    } catch (err) {
      console.error("Erreur chargement données:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchPrevisionsConsommation, fetchUsageData, fetchCentresData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = () => {
    fetchAllData();
  };

  const handleRegionChange = (region) => {
    setSelectedRegion(region);
    setIsRegionDropdownOpen(false);
  };

  const handleYear1Change = (year) => {
    setYear1(year);
    setIsYear1DropdownOpen(false);
  };

  const handleYear2Change = (year) => {
    setYear2(year);
    setIsYear2DropdownOpen(false);
  };

  const handleSelectedYearChange = (year) => {
    setSelectedYear(year);
    setIsYearDropdownOpen(false);
  };

  const handleLimitChange = (limit) => {
    setSelectedLimit(limit);
    setIsLimitDropdownOpen(false);
  };

  // Configuration du graphique avec couleurs adaptatives
  const getChartColors = () => {
    const isDark = document.body.classList.contains('dark');
    return {
      lineColor: isDark ? '#3b82f6' : '#2563eb',
      areaColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.08)',
      textColor: isDark ? '#8ba8cc' : '#6b7280',
      gridColor: isDark ? '#2a3545' : '#e5e7eb',
      pointBgColor: isDark ? '#3b82f6' : '#2563eb'
    };
  };

  const chartConfig = {
    type: 'line',
    data: {
      labels: displayedPrevision.labels,
      datasets: [
        {
          label: 'Consommation prévue (M m³)',
          data: displayedPrevision.values,
          borderColor: getChartColors().lineColor,
          backgroundColor: getChartColors().areaColor,
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: getChartColors().pointBgColor,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: getChartColors().textColor, boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw?.toFixed(2)} M m³`,
            afterLabel: (ctx) => {
              const idx = ctx.dataIndex;
              if (idx > 0) {
                const prev = displayedPrevision.values[idx - 1];
                const current = ctx.raw;
                const variation = ((current - prev) / prev * 100);
                return `Variation: ${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: getChartColors().gridColor },
          title: { display: true, text: 'Volume (Millions m³)', color: getChartColors().textColor, font: { size: 11 } },
          ticks: { callback: (v) => v.toFixed(1) + ' M m³', color: getChartColors().textColor }
        },
        x: {
          grid: { display: false },
          title: { display: true, text: 'Année', color: getChartColors().textColor, font: { size: 11 } },
          ticks: { color: getChartColors().textColor }
        }
      }
    }
  };

  useChart('previsionChart', chartConfig, [displayedPrevision]);

  useChart('usageChart', {
    type: 'bar',
    data: {
      labels: usageData.labels || [year1.toString(), year2.toString()],
      datasets: (usageData.datasets || []).map((ds, i) => ({
        label: ds.label || `Usage ${i + 1}`,
        data: ds.data || [0, 0],
        backgroundColor: [chartColors.blue + 'cc', chartColors.teal + 'cc', chartColors.amber + 'cc', chartColors.purple + 'cc'][i % 4],
        borderColor: 'var(--panel)',
        borderWidth: 1,
        borderRadius: 4
      }))
    },
    options: {
      ...chartOptions,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...chartOptions.plugins,
        legend: { display: true, labels: { color: 'var(--text2)', boxWidth: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) || 0} M m³` } }
      },
      scales: { 
        y: { 
          title: { display: true, text: 'Millions m³', color: 'var(--text2)' },
          ticks: { color: 'var(--text2)' },
          grid: { color: 'var(--border)' }
        },
        x: { 
          ticks: { color: 'var(--text2)' },
          grid: { display: false }
        }
      }
    }
  }, [usageData, year1, year2]);

  const tabs = [
    { id: 'prevision', label: 'Prévisions' },
    { id: 'usage', label: 'Par usage' },
    { id: 'centres', label: 'Par centre' }
  ];

  const getStatusClass = (status) => ({
    ok: 'chip ok', warn: 'chip warn', deficit: 'chip deficit'
  }[status] || 'chip info');

  if (loading && !previsionEvolution.values.some(v => v > 0)) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner"></div>
          <div className="card-title">Chargement des données de consommation...</div>
          <div className="card-sub">Connexion à l'API ONEE · {selectedRegion.name}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Modèle A — Prédiction de la Consommation</div>
        <div className="page-sub">
          Projection annuelle par centre desservi · Méthode : cascade démographique + calibrage statistique · {selectedRegion.name}
        </div>
        <button onClick={handleRefresh} disabled={isRefreshing} className="refresh-btn">
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
          {isRefreshing ? 'Chargement...' : 'Rafraîchir'}
        </button>
      </div>

      {/* Filtres */}
      <div className="card filters-card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--blue)' }} />
            Filtres
          </div>
        </div>
        <div className="filters-container">
          {/* Filtre Région */}
          <div className="filter-group">
            <div className="filter-label">
              <Globe size={14} />
              <span>Région :</span>
            </div>
            <div className="dropdown-container">
              <button onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)} disabled={loadingRegions} className="filter-button">
                <span>{loadingRegions ? 'Chargement...' : selectedRegion.name}</span>
                {isRegionDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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

          {/* Stats Prévisions */}
          {activeTab === 'prevision' && previsionEvolution.values.length > 0 && (
            <>
              <div className="filter-group">
                <div className="filter-label">Année de prévision :</div>
                <div className="dropdown-container small">
                  <button onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)} className="year-button">
                    {selectedYear} <ChevronDown size={12} />
                  </button>
                  {isYearDropdownOpen && (
                    <div className="dropdown-menu">
                      {AVAILABLE_YEARS.slice(-15).map(y => (
                        <div key={y} onClick={() => handleSelectedYearChange(y)} className="dropdown-item">{y}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="prevision-stats">
                <div className="stat-card">
                  <div className="stat-label">{displayedPrevision.firstYear}</div>
                  <div className="stat-value">{formatMm3(displayedPrevision.values[0])}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Prévision {displayedPrevision.currentYear}</div>
                  <div className="stat-value">{formatMm3(displayedPrevision.values[displayedPrevision.values.length - 1])}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Évolution</div>
                  <div className="stat-value" style={{ color: displayedPrevision.tendance > 0 ? 'var(--green)' : 'var(--red)' }}>
                    {displayedPrevision.tendance > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {displayedPrevision.tauxCroissance >= 0 ? '+' : ''}{displayedPrevision.tauxCroissance?.toFixed(1)}%
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Filtres pour les autres onglets */}
          {activeTab === 'usage' && (
            <div className="filter-group">
              <div className="filter-label">Comparer :</div>
              <div className="year-selector">
                <div className="dropdown-container small">
                  <button onClick={() => setIsYear1DropdownOpen(!isYear1DropdownOpen)} className="year-button">
                    {year1} <ChevronDown size={12} />
                  </button>
                  {isYear1DropdownOpen && (
                    <div className="dropdown-menu">
                      {AVAILABLE_YEARS.slice(-15).map(y => (
                        <div key={y} onClick={() => handleYear1Change(y)} className="dropdown-item">{y}</div>
                      ))}
                    </div>
                  )}
                </div>
                <span>vs</span>
                <div className="dropdown-container small">
                  <button onClick={() => setIsYear2DropdownOpen(!isYear2DropdownOpen)} className="year-button">
                    {year2} <ChevronDown size={12} />
                  </button>
                  {isYear2DropdownOpen && (
                    <div className="dropdown-menu">
                      {AVAILABLE_YEARS.slice(-15).map(y => (
                        <div key={y} onClick={() => handleYear2Change(y)} className="dropdown-item">{y}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'centres' && (
            <>
              <div className="filter-group">
                <div className="filter-label">Année :</div>
                <div className="dropdown-container small">
                  <button onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)} className="year-button">
                    {selectedYear} <ChevronDown size={12} />
                  </button>
                  {isYearDropdownOpen && (
                    <div className="dropdown-menu">
                      {forecastYears.map(y => (
                        <div key={y} onClick={() => handleSelectedYearChange(y)} className="dropdown-item">{y}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="filter-group">
                <div className="filter-label">
                  <List size={14} />
                  <span>Centres :</span>
                </div>
                <div className="dropdown-container small">
                  <button onClick={() => setIsLimitDropdownOpen(!isLimitDropdownOpen)} className="year-button">
                    {selectedLimit} <ChevronDown size={12} />
                  </button>
                  {isLimitDropdownOpen && (
                    <div className="dropdown-menu">
                      {AVAILABLE_LIMITS.map(limit => (
                        <div key={limit} onClick={() => handleLimitChange(limit)} className="dropdown-item">{limit}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* Onglet Prévisions */}
      {activeTab === 'prevision' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Prévision de consommation — jusqu’à {selectedYear}</div>
            <div className="card-sub">Modèle ML ONEE · Projection annuelle Q50 · Années livrées : {forecastYears.join(', ')}</div>
          </div>
          <div className="chart-container">
            <canvas id="previsionChart" style={{ width: '100%', height: '100%' }}></canvas>
          </div>
          
          {/* Tableau des prévisions */}
          <div className="previsions-table">
            <table className="data-table">
              <thead>
                <tr><th>Année</th><th>Consommation (M m³)</th><th>Variation annuelle</th><th>Variation cumulée</th></tr>
              </thead>
              <tbody>
                {displayedPrevision.labels.map((year, idx) => {
                  const currentValue = displayedPrevision.values[idx];
                  const prevValue = idx > 0 ? displayedPrevision.values[idx - 1] : currentValue;
                  const variation = idx > 0 ? ((currentValue - prevValue) / prevValue * 100) : 0;
                  const variationCumulee = idx > 0 ? ((currentValue - displayedPrevision.values[0]) / displayedPrevision.values[0] * 100) : 0;
                  
                  return (
                    <tr key={year}>
                      <td><strong>{year}</strong></td>
                      <td className="mono">{currentValue?.toFixed(2)} M m³</td>
                      <td className="mono" style={{ color: variation >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                      </td>
                      <td className="mono" style={{ color: variationCumulee >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {variationCumulee >= 0 ? '+' : ''}{variationCumulee.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet Par usage */}
      {activeTab === 'usage' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Répartition de la consommation par usage — {year1} vs {year2} · {selectedRegion.name}</div>
          </div>
          <div className="chart-container">
            <canvas id="usageChart" style={{ width: '100%', height: '100%' }}></canvas>
          </div>
        </div>
      )}

      {/* Onglet Par centre */}
      {activeTab === 'centres' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Prédiction par centre desservi — top {selectedLimit} · {selectedRegion.name} · Année {selectedYear}</div>
          </div>
          {(centresData || []).length === 0 ? (
            <div style={{ padding: '18px 8px', color: 'var(--text2)', fontSize: '13px' }}>
              Aucune donnée disponible pour cette combinaison région/année.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr><th>Centre</th><th>Province</th><th>Référence modèle</th><th>Prévision {selectedYear}</th><th>Variation</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {(centresData || []).map((c, idx) => (
                    <tr key={idx}>
                      <td>{c.name}</td>
                      <td>{c.province}</td>
                      <td className="mono">{c.conso_reference} M ({c.annee_reference})</td>
                      <td className="mono">{c.conso_selected ?? c.conso2024} M</td>
                      <td className="mono">{c.variation}</td>
                      <td><span className={getStatusClass(c.status)}>{c.statusText}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        .page { 
          padding: 20px; 
          max-width: 1400px; 
          margin: 0 auto; 
          background: var(--bg);
          min-height: calc(100vh - 56px);
        }
        
        .page-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 24px; 
          flex-wrap: wrap; 
          gap: 16px; 
        }
        
        .page-title { 
          font-size: 24px; 
          font-weight: 600; 
          color: var(--text);
        }
        
        .page-sub { 
          font-size: 13px; 
          color: var(--text2); 
          margin-top: 4px; 
        }
        
        .refresh-btn { 
          background: var(--panel); 
          border: 1px solid var(--border); 
          border-radius: 8px; 
          padding: 8px 16px; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          color: var(--text2); 
          transition: all 0.2s; 
        }
        
        .refresh-btn:hover { 
          background: var(--bg3); 
          border-color: var(--blue); 
          color: var(--blue);
        }
        
        .card { 
          background: var(--panel); 
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
          gap: 12px; 
        }
        
        .card-title { 
          font-size: 18px; 
          font-weight: 600; 
          color: var(--text);
        }
        
        .card-sub { 
          font-size: 11px; 
          color: var(--text3); 
          margin-top: 4px; 
        }
        
        .filters-card { 
          margin-bottom: 24px; 
        }
        
        .filters-container { 
          display: flex; 
          gap: 24px; 
          flex-wrap: wrap; 
          align-items: center; 
          padding: 16px; 
          background: var(--bg2); 
          border-radius: 8px; 
        }
        
        .filter-group { 
          display: flex; 
          align-items: center; 
          gap: 12px; 
        }
        
        .filter-label { 
          display: flex; 
          align-items: center; 
          gap: 6px; 
          font-size: 12px; 
          color: var(--text2); 
        }
        
        .dropdown-container { 
          position: relative; 
          min-width: 200px; 
        }
        
        .dropdown-container.small { 
          min-width: 100px; 
        }
        
        .filter-button, .year-button { 
          width: 100%; 
          padding: 8px 12px; 
          border-radius: 6px; 
          border: 1px solid var(--border); 
          background: var(--bg3); 
          color: var(--text); 
          font-size: 13px; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          gap: 8px; 
        }
        
        .filter-button:hover, .year-button:hover { 
          border-color: var(--blue); 
        }
        
        .dropdown-menu { 
          position: absolute; 
          top: 100%; 
          left: 0; 
          right: 0; 
          margin-top: 4px; 
          background: var(--panel); 
          border: 1px solid var(--border); 
          border-radius: 6px; 
          max-height: 250px; 
          overflow-y: auto; 
          z-index: 1000; 
          box-shadow: var(--shadow);
        }
        
        .dropdown-item { 
          padding: 8px 12px; 
          cursor: pointer; 
          font-size: 13px; 
          transition: background 0.2s; 
          color: var(--text);
        }
        
        .dropdown-item:hover { 
          background: var(--bg3); 
        }
        
        .prevision-stats { 
          display: flex; 
          gap: 32px; 
          margin-left: auto; 
        }
        
        .stat-card { 
          display: flex; 
          flex-direction: column; 
          gap: 4px; 
        }
        
        .stat-label { 
          font-size: 10px; 
          color: var(--text3); 
          text-transform: uppercase; 
          letter-spacing: 0.5px; 
        }
        
        .stat-value { 
          font-size: 18px; 
          font-weight: 700; 
          display: flex; 
          align-items: center; 
          gap: 4px; 
          color: var(--text);
        }
        
        .year-selector { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
        }
        
        .chart-container { 
          height: 350px; 
          position: relative; 
        }
        
        .previsions-table { 
          margin-top: 24px; 
          overflow-x: auto; 
        }
        
        .data-table { 
          width: 100%; 
          border-collapse: collapse; 
        }
        
        .data-table th { 
          text-align: left; 
          padding: 12px; 
          background: var(--bg2); 
          color: var(--text2); 
          font-size: 12px; 
          font-weight: 600; 
          text-transform: uppercase; 
        }
        
        .data-table td { 
          padding: 12px; 
          border-bottom: 1px solid var(--border); 
          color: var(--text);
        }
        
        .data-table tr:hover { 
          background: var(--bg3); 
        }
        
        .mono { 
          font-family: 'JetBrains Mono', monospace; 
          font-size: 13px; 
        }
        
        .chip { 
          padding: 4px 12px; 
          border-radius: 20px; 
          font-size: 12px; 
          font-weight: 500; 
          display: inline-block; 
        }
        
        .chip.ok { 
          background: var(--green); 
          color: white; 
        }
        
        .chip.warn { 
          background: var(--amber); 
          color: white; 
        }
        
        .chip.deficit { 
          background: var(--red); 
          color: white; 
        }
        
        .chip.info { 
          background: var(--blue); 
          color: white; 
        }
        
        .table-responsive { 
          overflow-x: auto; 
        }
        
        .tabs { 
          display: flex; 
          gap: 4px; 
          margin-bottom: 24px; 
          background: var(--panel2); 
          padding: 4px; 
          border-radius: 10px; 
          width: fit-content; 
        }
        
        .tab { 
          padding: 8px 20px; 
          border-radius: 8px; 
          cursor: pointer; 
          font-size: 14px; 
          font-weight: 500; 
          transition: all 0.2s; 
          color: var(--text2); 
        }
        
        .tab.active { 
          background: var(--blue); 
          color: white; 
        }
        
        .tab:hover:not(.active) { 
          background: var(--bg3); 
          color: var(--text);
        }
        
        .spin { 
          animation: spin 1s linear infinite; 
        }
        
        .spinner { 
          width: 40px; 
          height: 40px; 
          margin: 0 auto 20px; 
          border: 3px solid var(--border); 
          border-top-color: var(--blue); 
          border-radius: 50%; 
          animation: spin 1s linear infinite; 
        }
        
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
      `}</style>
    </div>
  );
};

export default Consommation;
