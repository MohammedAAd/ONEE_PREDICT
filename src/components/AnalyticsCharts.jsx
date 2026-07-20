// frontend/src/components/AnalyticsCharts.jsx
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Target, Calendar, 
  MapPin, Droplets, BarChart3, Activity, 
  Info, Eye, Building2, Users, Gauge,
  Ruler, Zap, Scale, Globe, Database
} from 'lucide-react';
import { useChart } from '../hooks/useChart';
import { chartColors, chartOptions } from '../utils/chartConfig';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ✅ Helper pour formater les nombres à 2 décimales
const formatTo2Decimals = (value) => {
  if (value === null || value === undefined) return '0';
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toFixed(2);
};

// Années disponibles
const AVAILABLE_YEARS = Array.from({ length: 2023 - 2000 + 1 }, (_, i) => 2000 + i);

const AnalyticsCharts = ({ region = 'all', year = 2023, zones = [] }) => {
  const [tauxData, setTauxData] = useState(null);
  const [rendementData, setRendementData] = useState(null);
  const [scatterData, setScatterData] = useState(null);
  const [dotationBfData] = useState(null);
  const [dotationsData, setDotationsData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // États pour les plages d'années personnalisées
  const [tauxStartYear, setTauxStartYear] = useState(2015);
  const [tauxEndYear, setTauxEndYear] = useState(2023);
  const [rendStartYear, setRendStartYear] = useState(2015);
  const [rendEndYear, setRendEndYear] = useState(2023);
  const [dotsStartYear, setDotsStartYear] = useState(2015);
  const [dotsEndYear, setDotsEndYear] = useState(2023);
  const [scatterYear, setScatterYear] = useState(2023);
  const [dotationYear, setDotationYear] = useState(2023);
  
  const [isTauxStartOpen, setIsTauxStartOpen] = useState(false);
  const [isTauxEndOpen, setIsTauxEndOpen] = useState(false);
  const [isRendStartOpen, setIsRendStartOpen] = useState(false);
  const [isRendEndOpen, setIsRendEndOpen] = useState(false);
  const [isDotsStartOpen, setIsDotsStartOpen] = useState(false);
  const [isDotsEndOpen, setIsDotsEndOpen] = useState(false);
  const [isScatterYearOpen, setIsScatterYearOpen] = useState(false);
  const [isDotationYearOpen, setIsDotationYearOpen] = useState(false);

  // Fetch Taux de branchement
  useEffect(() => {
    const fetchTaux = async () => {
      try {
        const params = new URLSearchParams({ 
          region, 
          start_year: tauxStartYear.toString(), 
          end_year: tauxEndYear.toString() 
        });
        const res = await fetch(`${API_BASE}/dashboard/analytics/taux-branchement?${params}`);
        const data = await res.json();
        setTauxData(data);
      } catch (err) {
        console.error("Erreur taux branchement:", err);
      }
    };
    fetchTaux();
  }, [region, tauxStartYear, tauxEndYear]);

  // Fetch Rendement distribution
  useEffect(() => {
    const fetchRendement = async () => {
      try {
        const params = new URLSearchParams({ 
          region, 
          start_year: rendStartYear.toString(), 
          end_year: rendEndYear.toString() 
        });
        const res = await fetch(`${API_BASE}/dashboard/analytics/rendement-distribution?${params}`);
        const data = await res.json();
        setRendementData(data);
      } catch (err) {
        console.error("Erreur rendement:", err);
      }
    };
    fetchRendement();
  }, [region, rendStartYear, rendEndYear]);

  // Fetch Scatter Rendement vs Taux
  useEffect(() => {
    const fetchScatter = async () => {
      try {
        const params = new URLSearchParams({ region, year: scatterYear.toString() });
        const res = await fetch(`${API_BASE}/dashboard/analytics/scatter-rendement-taux?${params}`);
        const data = await res.json();
        setScatterData(data);
      } catch (err) {
        console.error("Erreur scatter:", err);
      }
    };
    fetchScatter();
  }, [region, scatterYear]);

  // Fetch Dotations annuelles
  useEffect(() => {
    const fetchDotations = async () => {
      try {
        const params = new URLSearchParams({ 
          region, 
          start_year: dotsStartYear.toString(), 
          end_year: dotsEndYear.toString() 
        });
        const res = await fetch(`${API_BASE}/dashboard/analytics/dotations-annuelles?${params}`);
        const data = await res.json();
        setDotationsData(data);
      } catch (err) {
        console.error("Erreur dotations:", err);
      }
    };
    fetchDotations();
  }, [region, dotsStartYear, dotsEndYear]);

  useEffect(() => {
    if (tauxData && rendementData && scatterData && dotationsData) {
      setLoading(false);
    }
  }, [tauxData, rendementData, scatterData, dotationsData]);

  // Dropdown component
  const YearDropdown = ({ value, onChange, isOpen, setIsOpen, options }) => (
    <div style={{ position: 'relative', minWidth: '80px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="year-button"
      >
        {value} <span>▼</span>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {options.map(y => (
            <div key={y} onClick={() => { onChange(y); setIsOpen(false); }} className="dropdown-item">
              {y}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ✅ MODIFICATION 1: Chart Taux avec formatage à 2 décimales
  useChart('tauxChart', {
    type: 'line',
    data: {
      labels: tauxData?.labels || [],
      datasets: [{
        label: 'Taux de branchement',
        data: tauxData?.values?.map(v => v * 100) || [],
        borderColor: chartColors.blue,
        backgroundColor: chartColors.blue + '15',
        fill: true,
        tension: 0.4,
        pointRadius: 3
      }]
    },
    options: {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        tooltip: { 
          callbacks: { 
            label: (ctx) => `${formatTo2Decimals(ctx.raw)}%` 
          } 
        }
      },
      scales: { 
        y: { 
          title: { display: true, text: 'Taux de branchement (%)' }, 
          min: 0,
          max: 100,
          ticks: { 
            callback: (v) => formatTo2Decimals(v) + '%'
          }
        } 
      }
    }
  });

  // ✅ MODIFICATION 2: Chart Rendement avec formatage à 2 décimales
  useChart('rendementChart', {
    type: 'line',
    data: {
      labels: rendementData?.labels || [],
      datasets: [{
        label: 'Rendement distribution',
        data: rendementData?.values.map(v => v * 100) || [],
        borderColor: chartColors.teal,
        backgroundColor: chartColors.teal + '15',
        fill: true,
        tension: 0.4,
        pointRadius: 3
      }]
    },
    options: {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        tooltip: { 
          callbacks: { 
            label: (ctx) => `${formatTo2Decimals(ctx.raw)}%` 
          } 
        }
      },
      scales: { 
        y: { 
          title: { display: true, text: 'Rendement (%)' }, 
          min: 0,
          max: 100,
          ticks: { 
            callback: (v) => formatTo2Decimals(v) + '%'
          }
        } 
      }
    }
  });

  // ✅ MODIFICATION 3: Scatter Rendement vs Taux avec formatage à 2 décimales
  useChart('scatterChart', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Centres',
        data: (scatterData?.data || []).map(d => ({ x: d.x * 100, y: d.y * 100, label: d.label })),
        backgroundColor: chartColors.blue + 'cc', borderColor: chartColors.blue, pointRadius: 6, pointHoverRadius: 8, pointBorderWidth: 2, pointBorderColor: '#fff'
      }]
    },
    options: {
      ...chartOptions,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = ctx.raw;
              const label = point.label || 'Centre inconnu';
              return [
                `centre : ${label}`,
                ` Taux: ${formatTo2Decimals(point.x)}%`,
                ` Rendement: ${formatTo2Decimals(point.y)}%`
              ];
            }
          },
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#8ba8cc',
          borderColor: chartColors.blue,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Taux de branchement (%)' }, 
          min: 0, 
          max: 100,
          ticks: { 
            callback: (v) => formatTo2Decimals(v) + '%'
          }
        },
        y: { 
          title: { display: true, text: 'Rendement distribution (%)' }, 
          min: 0, 
          max: 100,
          ticks: { 
            callback: (v) => formatTo2Decimals(v) + '%'
          }
        }
      }
    }
  });

  // ✅ MODIFICATION 4: Scatter Dotation BF vs Population avec formatage à 2 décimales
  useChart('dotationBfChart', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Centres',
        data: dotationBfData?.data?.map(d => ({ 
          x: d.x * 100, 
          y: d.y,  // Ne pas multiplier par 100 car c'est déjà en L/j/hab
          label: d.label,
          taux: d.taux
        })) || [],
        backgroundColor: chartColors.amber + 'cc',
        borderColor: chartColors.amber,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        pointBorderColor: '#fff'
      }]
    },
    options: {
      ...chartOptions,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = ctx.raw;
              const label = point.label || 'Centre inconnu';
              const taux = point.taux || 0;
              return [
                `centre : ${label}`,
                ` Population: ${formatTo2Decimals(point.x)} k hab`,
                ` Dotation BF: ${formatTo2Decimals(point.y)} l/hab/j`,
                ` Taux: ${formatTo2Decimals(taux)}%`
              ];
            }
          },
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#8ba8cc',
          borderColor: chartColors.amber,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Population branchée (milliers habitants)' },
          ticks: { 
            callback: (v) => formatTo2Decimals(v) + 'k'
          }
        },
        y: { 
          title: { display: true, text: 'Dotation BF (l/hab/j)' },
          ticks: { 
            callback: (v) => formatTo2Decimals(v)
          }
        }
      }
    }
  });

  // ✅ MODIFICATION 5: Dotations annuelles avec formatage à 2 décimales
  useChart('dotationsChart', {
    type: 'line',
    data: {
      labels: dotationsData?.labels || [],
      datasets: (dotationsData?.datasets || []).map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: chartColors[ds.colorKey] || chartColors.blue,
        backgroundColor: (chartColors[ds.colorKey] || chartColors.blue) + '15',
        fill: true,
        tension: 0.4,
        pointRadius: 3
      }))
    },
    options: {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        tooltip: { 
          callbacks: { 
            label: (ctx) => `${ctx.dataset.label}: ${formatTo2Decimals(ctx.raw)} l/hab/j` 
          } 
        }
      },
      scales: { 
        y: { 
          title: { display: true, text: 'Dotation (l/hab/j)' },
          ticks: { 
            callback: (v) => formatTo2Decimals(v)
          }
        } 
      }
    }
  });

  if (loading) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Database size={20} className="spin" />
          Chargement des graphiques analytiques...
        </div>
        <style>{`
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="analytics-section" style={{ marginTop: '24px' }}>
      <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        
        {/* Taux de branchement */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Target size={14} style={{ marginRight: '6px', color: chartColors.blue }} />
              Taux de branchement moyen (%)
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Calendar size={12} style={{ color: 'var(--text2)' }} />
              <YearDropdown 
                value={tauxStartYear} 
                onChange={setTauxStartYear}
                isOpen={isTauxStartOpen}
                setIsOpen={setIsTauxStartOpen}
                options={AVAILABLE_YEARS.filter(y => y <= tauxEndYear)}
              />
              <span>→</span>
              <YearDropdown 
                value={tauxEndYear} 
                onChange={setTauxEndYear}
                isOpen={isTauxEndOpen}
                setIsOpen={setIsTauxEndOpen}
                options={AVAILABLE_YEARS.filter(y => y >= tauxStartYear)}
              />
            </div>
          </div>
          <canvas id="tauxChart" height="200"></canvas>
        </div>

        {/* Rendement distribution */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Gauge size={14} style={{ marginRight: '6px', color: chartColors.teal }} />
              Rendement de distribution par année (%)
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Calendar size={12} style={{ color: 'var(--text2)' }} />
              <YearDropdown 
                value={rendStartYear} 
                onChange={setRendStartYear}
                isOpen={isRendStartOpen}
                setIsOpen={setIsRendStartOpen}
                options={AVAILABLE_YEARS.filter(y => y <= rendEndYear)}
              />
              <span>→</span>
              <YearDropdown 
                value={rendEndYear} 
                onChange={setRendEndYear}
                isOpen={isRendEndOpen}
                setIsOpen={setIsRendEndOpen}
                options={AVAILABLE_YEARS.filter(y => y >= rendStartYear)}
              />
            </div>
          </div>
          <canvas id="rendementChart" height="200"></canvas>
        </div>

        {/* Scatter: Rendement vs Taux branchement */}
        <div className="card chart-wide" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div className="card-title">
              <Activity size={14} style={{ marginRight: '6px', color: chartColors.blue }} />
              Rendement vs Taux de branchement
            </div>
            <div className="card-sub" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
              Valeurs calculées selon les formules métier ; aucun seuil d'alerte n'est appliqué.
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Calendar size={12} style={{ color: 'var(--text2)' }} />
              <YearDropdown 
                value={scatterYear} 
                onChange={setScatterYear}
                isOpen={isScatterYearOpen}
                setIsOpen={setIsScatterYearOpen}
                options={AVAILABLE_YEARS}
              />
              {scatterData?.regression && (
                <div className="card-sub" style={{ fontSize: '0.7rem' }}>
                  <Ruler size={10} style={{ display: 'inline', marginRight: '4px' }} />
                  {scatterData.regression.formula}
                </div>
              )}
              <div className="card-sub" style={{ fontSize: '0.7rem', marginLeft: 'auto' }}>
                <Info size={10} style={{ display: 'inline', marginRight: '4px' }} />
                Passez la souris sur un point pour voir le nom du centre
              </div>
            </div>
          </div>
          <canvas id="scatterChart" height="250"></canvas>
        </div>

        {/* Scatter: Dotation BF vs Population branchée */}
        <div className="card chart-wide" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div className="card-title">
              <Droplets size={14} style={{ marginRight: '6px', color: chartColors.amber }} />
              Dotation BF vs Population branchée
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Calendar size={12} style={{ color: 'var(--text2)' }} />
              <YearDropdown 
                value={dotationYear} 
                onChange={setDotationYear}
                isOpen={isDotationYearOpen}
                setIsOpen={setIsDotationYearOpen}
                options={AVAILABLE_YEARS}
              />
              <div className="card-sub" style={{ fontSize: '0.7rem', marginLeft: 'auto' }}>
                <Info size={10} style={{ display: 'inline', marginRight: '4px' }} />
                Passez la souris sur un point pour voir le nom du centre
              </div>
            </div>
          </div>
          <canvas id="dotationBfChart" height="250"></canvas>
        </div>

        {/* Dotations nette et brute */}
        <div className="card chart-wide" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div className="card-title">
              <BarChart3 size={14} style={{ marginRight: '6px', color: chartColors.purple }} />
              Dotations nette et brute par année
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Calendar size={12} style={{ color: 'var(--text2)' }} />
              <YearDropdown 
                value={dotsStartYear} 
                onChange={setDotsStartYear}
                isOpen={isDotsStartOpen}
                setIsOpen={setIsDotsStartOpen}
                options={AVAILABLE_YEARS.filter(y => y <= dotsEndYear)}
              />
              <span>→</span>
              <YearDropdown 
                value={dotsEndYear} 
                onChange={setDotsEndYear}
                isOpen={isDotsEndOpen}
                setIsOpen={setIsDotsEndOpen}
                options={AVAILABLE_YEARS.filter(y => y >= dotsStartYear)}
              />
            </div>
            <div className="legend">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: chartColors.blue }}></div>
                <span>Dotation nette</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: chartColors.teal }}></div>
                <span>Dotation brute</span>
              </div>
            </div>
          </div>
          <canvas id="dotationsChart" height="200"></canvas>
        </div>

      </div>

      <style jsx>{`
        .card:has(#dotationBfChart) { display: none; }
        .year-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--bg3);
          color: var(--text);
          font-size: 0.8rem;
          cursor: pointer;
          min-width: 70px;
        }
        .year-button:hover {
          background: var(--bg2);
          border-color: var(--primary);
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
          padding: 6px 12px;
          cursor: pointer;
          font-size: 0.8rem;
          color: var(--text);
          transition: background 0.2s;
        }
        .dropdown-item:hover {
          background: var(--bg2);
        }
        .legend {
          display: flex;
          gap: 12px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          color: var(--text2);
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default AnalyticsCharts;
