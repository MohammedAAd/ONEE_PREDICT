// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AlertCircle, AlertTriangle, Info, Filter, Calendar, 
  MapPin, Building2, Globe, RefreshCw, ChevronDown, 
  ChevronUp, BarChart3, PieChart
} from 'lucide-react';
import StatCard from '../components/StatCard';
import AlertItem from '../components/AlertItem';
import ZoneFilter from '../components/ZoneFilter';
import MapSection from '../components/MapSection';
import AnalyticsCharts from '../components/AnalyticsCharts';
import RegionSelector from '../components/RegionSelector';
import { useChart } from '../hooks/useChart';
import { chartColors, chartOptions, years } from '../utils/chartConfig';

// Configuration API - Version V2
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const API_V2_PREFIX = '/dashboard/v2';
const iconMap = { AlertCircle, AlertTriangle, Info };

// Helper pour garantir que les données sont des tableaux
const ensureArray = (val, length = 0) => {
  if (Array.isArray(val)) return val;
  if (val === null || val === undefined) return Array(length).fill(null);
  return [val];
};

const Dashboard = () => {
  // États pour les données de chaque chart
  const [timeseriesData, setTimeseriesData] = useState(null);
  const [timeseriesDetailData, setTimeseriesDetailData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [bilanZonesData, setBilanZonesData] = useState(null);
  const [bilanProvincesData, setBilanProvincesData] = useState(null);
  const [bilanRegionsData, setBilanRegionsData] = useState(null);
  const [rendementsData, setRendementsData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [consommationTypesData, setConsommationTypesData] = useState(null);
  const [vulnerabilityData, setVulnerabilityData] = useState(null);
  const [masterCentresData, setMasterCentresData] = useState(null);
  const [allZones, setAllZones] = useState([]);
  
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [error, setError] = useState(null);
  const [activeBilanTab, setActiveBilanTab] = useState('zones');
  const [activeConsumptionTab, setActiveConsumptionTab] = useState('chart');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  
  // État pour la région sélectionnée
  const [selectedRegion, setSelectedRegion] = useState({ code: 'all', name: 'Toutes les régions' });
  
  const [filters, setFilters] = useState({
    startYear: 2020,
    endYear: 2024,  // Année max fixée à 2024 pour les données réelles
    bilanZones: [],
    mode: 'real'    // Mode fixé à 'real' uniquement
  });

  // 🔄 Récupérer la liste des régions depuis l'API V2
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        setLoadingRegions(true);
        const response = await fetch(`${API_BASE}${API_V2_PREFIX}/regions`);
        if (!response.ok) throw new Error('Erreur chargement régions');
        const data = await response.json();
        setRegions(data);
        const currentRegion = data.find(r => r.code === selectedRegion.code);
        if (currentRegion) {
          setSelectedRegion(currentRegion);
        }
      } catch (err) {
        console.error('Erreur chargement régions:', err);
      } finally {
        setLoadingRegions(false);
      }
    };
    fetchRegions();
  }, []);

  // 📊 Fonction pour récupérer les données de timeseries (Consommation vs Production) depuis V2
  const fetchTimeseries = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        start_year: filters.startYear.toString(),
        end_year: filters.endYear.toString()
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/timeseries?${params}`);
      if (!response.ok) throw new Error('Erreur chargement timeseries');
      const data = await response.json();
      setTimeseriesData({ ...data, mode: 'real' });
    } catch (err) {
      console.error("❌ Erreur timeseries:", err);
    }
  }, [selectedRegion.code, filters.startYear, filters.endYear]);

  // 📊 Fonction pour récupérer les données de timeseries détaillé depuis V2
  const fetchTimeseriesDetail = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        start_year: filters.startYear.toString(),
        end_year: filters.endYear.toString()
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/timeseries-detail?${params}`);
      if (!response.ok) throw new Error('Erreur chargement timeseries detail');
      const data = await response.json();
      setTimeseriesDetailData(data);
    } catch (err) {
      console.error("❌ Erreur timeseries detail:", err);
    }
  }, [selectedRegion.code, filters.startYear, filters.endYear]);

  // 📊 Fonction pour récupérer les statistiques depuis V2
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        year: filters.endYear.toString()
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/stats?${params}`);
      if (!response.ok) throw new Error('Erreur chargement stats');
      const data = await response.json();
      setStatsData(data);
    } catch (err) {
      console.error("❌ Erreur stats:", err);
    }
  }, [selectedRegion.code, filters.endYear]);

  // 📊 Fonction pour récupérer le bilan par zone depuis V2
  const fetchBilanZones = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        year: filters.endYear.toString()
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/bilan/zones?${params}`);
      if (!response.ok) throw new Error('Erreur chargement bilan zones');
      const data = await response.json();
      setBilanZonesData(data);
      if (data.labels) {
        setAllZones(data.labels);
      }
    } catch (err) {
      console.error("❌ Erreur bilan zones:", err);
    }
  }, [selectedRegion.code, filters.endYear]);

  // 📊 Fonction pour récupérer le bilan par province depuis V2
  const fetchBilanProvinces = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        year: filters.endYear.toString()
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/bilan/provinces?${params}`);
      if (!response.ok) throw new Error('Erreur chargement bilan provinces');
      const data = await response.json();
      setBilanProvincesData(data);
    } catch (err) {
      console.error("❌ Erreur bilan provinces:", err);
    }
  }, [selectedRegion.code, filters.endYear]);

  // 📊 Fonction pour récupérer la vulnérabilité depuis V2
  const fetchVulnerability = useCallback(async () => {
    try {
      const params = new URLSearchParams({ region: selectedRegion.code });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/vulnerability?${params}`);
      if (!response.ok) throw new Error('Erreur chargement vulnérabilité');
      const data = await response.json();
      setVulnerabilityData(data);
    } catch (err) {
      console.error('❌ Erreur vulnérabilité:', err);
    }
  }, [selectedRegion.code]);

  // 📊 Fonction pour récupérer la liste des centres depuis V2
  const fetchMasterCentres = useCallback(async () => {
    try {
      const params = new URLSearchParams({ region: selectedRegion.code });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/centres?${params}`);
      if (!response.ok) throw new Error('Erreur chargement centres');
      const data = await response.json();
      setMasterCentresData(data);
    } catch (err) {
      console.error('❌ Erreur centres:', err);
    }
  }, [selectedRegion.code]);

  // 📊 Fonction pour récupérer le bilan par région depuis V2
  const fetchBilanRegions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        year: filters.endYear.toString()
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/bilan/regions?${params}`);
      if (!response.ok) throw new Error('Erreur chargement bilan regions');
      const data = await response.json();
      setBilanRegionsData(data);
    } catch (err) {
      console.error("❌ Erreur bilan regions:", err);
    }
  }, [filters.endYear]);

  // 📊 Fonction pour récupérer les rendements depuis V2
  const fetchRendements = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/rendements?${params}`);
      if (!response.ok) throw new Error('Erreur chargement rendements');
      const data = await response.json();
      setRendementsData(data);
    } catch (err) {
      console.error("❌ Erreur rendements:", err);
    }
  }, [selectedRegion.code]);

  // 📊 Fonction pour récupérer les alertes depuis V2
  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/master/alerts?${params}`);
      if (!response.ok) throw new Error('Erreur chargement alertes');
      const data = await response.json();
      setAlertsData(data);
    } catch (err) {
      console.error("❌ Erreur alertes:", err);
    }
  }, [selectedRegion.code]);

  // 📊 Fonction pour récupérer la consommation par type depuis V2 (fact_long)
  const fetchConsommationTypes = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        region: selectedRegion.code,
        start_year: filters.startYear.toString(),
        end_year: filters.endYear.toString()
      });
      const response = await fetch(`${API_BASE}${API_V2_PREFIX}/consommation/types?${params}`);
      if (!response.ok) throw new Error('Erreur chargement consommation types');
      const data = await response.json();
      setConsommationTypesData(data);
    } catch (err) {
      console.error("❌ Erreur consommation types:", err);
    }
  }, [selectedRegion.code, filters.startYear, filters.endYear]);

  // 🔄 Charger toutes les données
  const fetchAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setLoading(true);
      setError(null);
      
      await Promise.all([
        fetchTimeseries(),
        fetchTimeseriesDetail(),
        fetchStats(),
        fetchBilanZones(),
        fetchBilanProvinces(),
        fetchBilanRegions(),
        fetchRendements(),
        fetchAlerts(),
        fetchVulnerability(),
        fetchMasterCentres(),
        fetchConsommationTypes()
      ]);
    } catch (err) {
      console.error("❌ Erreur chargement données:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchTimeseries, fetchTimeseriesDetail, fetchStats, fetchBilanZones, 
      fetchBilanProvinces, fetchBilanRegions, fetchRendements, fetchAlerts, 
      fetchVulnerability, fetchConsommationTypes]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Handler pour changer de région
  const handleRegionChange = (region) => {
    setSelectedRegion(region);
    setIsRegionDropdownOpen(false);
  };

  // 📊 Données avec fallback
  const ts = useMemo(() => {
    const raw = timeseriesData || {};
    const len = raw.labels?.length || 11;
    return {
      labels: Array.isArray(raw.labels) ? raw.labels : years.slice(0, len),
      conso: ensureArray(raw.conso, len),
      prod: ensureArray(raw.prod, len),
      distribution: ensureArray(raw.distribution, len),
      mode: 'real',
      real_end_year: raw.real_end_year || 2024
    };
  }, [timeseriesData]);

  const tsDetail = useMemo(() => {
    const raw = timeseriesDetailData || {};
    const len = raw.labels?.length || 11;
    return {
      labels: Array.isArray(raw.labels) ? raw.labels : [],
      production: ensureArray(raw.production, len),
      distribution: ensureArray(raw.distribution, len),
      consommation: ensureArray(raw.consommation, len)
    };
  }, [timeseriesDetailData]);

  const bilan = bilanZonesData || { labels: [], values: [] };
  const bilanProvinces = bilanProvincesData || { labels: [], values: [] };
  const bilanRegions = bilanRegionsData || { labels: [], values: [] };
  const rend = rendementsData || { labels: [], datasets: [] };
  const stats = statsData || { centres: '0', pop: '0', conso2030: '0', deficit: '0' };
  const alerts = alertsData || [];
  const consommationTypes = consommationTypesData || { labels: [], datasets: [] };

  // Filtrage frontend du bilan
  const filteredBilan = useMemo(() => {
    if (activeBilanTab !== 'zones') {
      return activeBilanTab === 'provinces' ? bilanProvinces : bilanRegions;
    }
    if (!bilan.labels?.length) return { labels: [], values: [] };
    if (filters.bilanZones.length === 0) return bilan;
    
    const indices = bilan.labels
      .map((z, i) => filters.bilanZones.includes(z) ? i : -1)
      .filter(i => i !== -1);
    
    return {
      labels: indices.map(i => bilan.labels[i]),
      values: indices.map(i => bilan.values[i])
    };
  }, [bilan, bilanProvinces, bilanRegions, filters.bilanZones, activeBilanTab]);

  // 📈 Chart principal (Conso vs Prod) - sans pointillés pour les prévisions
  const mainChartConfig = useMemo(() => ({
    type: 'line',
    data: {
      labels: ts.labels,
      datasets: [
        {
          label: 'Consommation',
          data: ts.conso || [],
          borderColor: chartColors.blue,
          backgroundColor: '#2d8bff15',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        },
        {
          label: 'Production (réelle)',
          data: ts.prod || [],
          borderColor: chartColors.teal,
          backgroundColor: '#00c9a715',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        }
      ]
    },
    options: {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('fr-FR') || 0} M m³`
          }
        }
      }
    }
  }), [ts.labels, ts.conso, ts.prod]);

  useChart('mainChart', mainChartConfig);

  // 📊 Bilan chart
  const bilanChartConfig = useMemo(() => ({
    type: 'bar',
    data: {
      labels: filteredBilan.labels || [],
      datasets: [{
        label: 'Solde (m³/an)',
        data: filteredBilan.values || [],
        backgroundColor: (filteredBilan.values || []).map(v => 
          (v < 0 ? chartColors.red : chartColors.teal) + 'aa'
        ),
        borderColor: (filteredBilan.values || []).map(v => 
          v < 0 ? chartColors.red : chartColors.teal
        ),
        borderWidth: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.8
      }]
    },
    options: {
      ...chartOptions,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.y?.toLocaleString('fr-FR', {minimumFractionDigits: 0})} m³`
          }
        }
      },
      scales: {
        x: {
          ticks: { autoSkip: true, maxRotation: 45, minRotation: 45, font: { size: 9 } },
          grid: { display: false }
        },
        y: {
          ticks: {
            callback: (v) => (v / 1e6).toFixed(1) + 'M',
            font: { size: 9 }
          }
        }
      }
    }
  }), [filteredBilan.labels, filteredBilan.values]);

  useChart('bilanChart', bilanChartConfig);

  // 📊 Flow chart
  const flowChartConfig = useMemo(() => ({
    type: 'bar',
    data: {
      labels: tsDetail.labels || [],
      datasets: [
        {
          label: 'Production',
          data: tsDetail.production || [],
          backgroundColor: chartColors.teal + 'cc',
          borderColor: chartColors.teal,
          borderWidth: 1,
          stack: 'Stack 0',
        },
        {
          label: 'Distribution',
          data: tsDetail.distribution || [],
          backgroundColor: chartColors.blue + 'cc',
          borderColor: chartColors.blue,
          borderWidth: 1,
          stack: 'Stack 0',
        },
        {
          label: 'Consommation',
          data: tsDetail.consommation || [],
          backgroundColor: chartColors.amber + 'cc',
          borderColor: chartColors.amber,
          borderWidth: 1,
          stack: 'Stack 0',
        }
      ]
    },
    options: {
      ...chartOptions,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#8ba8cc', font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('fr-FR') || 0} M m³`
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { font: { size: 9 } } },
        y: {
          stacked: true,
          ticks: { callback: (v) => (v).toFixed(0) + 'M', font: { size: 9 } },
          title: { display: true, text: 'Millions m³/an' }
        }
      }
    }
  }), [tsDetail.labels, tsDetail.production, tsDetail.distribution, tsDetail.consommation]);

  useChart('flowChart', flowChartConfig);

  // 📊 Rendements chart
  const rendChartConfig = useMemo(() => ({
    type: 'radar',
    data: {
      labels: rend.labels || [],
      datasets: (rend.datasets || []).map(ds => ({
        label: ds.label || '',
        data: ds.values || [],
        borderColor: chartColors[ds.colorKey] || chartColors.blue,
        backgroundColor: (chartColors[ds.colorKey] || chartColors.blue) + '22'
      }))
    },
    options: {
      ...chartOptions,
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,.05)' },
          ticks: { color: '#8ba8cc', font: { size: 9 } },
          pointLabels: { color: '#8ba8cc', font: { size: 10 } }
        }
      },
      plugins: {
        legend: { display: true, labels: { color: '#8ba8cc', font: { size: 10 } } }
      }
    }
  }), [rend.labels, rend.datasets]);

  useChart('rendChart', rendChartConfig);

  // 📊 Consommation par type chart (Line)
  const consommationTypesChartConfig = useMemo(() => ({
    type: 'line',
    data: {
      labels: consommationTypes.labels || [],
      datasets: (consommationTypes.datasets || []).map(ds => ({
        label: ds.label || '',
        data: ds.data || [],
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
        legend: { display: true, labels: { color: '#8ba8cc', font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('fr-FR') || 0} M m³`
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: (v) => v.toFixed(1) + 'M', font: { size: 9 } },
          title: { display: true, text: 'Millions m³/an' }
        }
      }
    }
  }), [consommationTypes.labels, consommationTypes.datasets]);

  useChart('consommationTypesChart', consommationTypesChartConfig);

  // Handlers
  const handleBilanZoneToggle = (zone) => {
    setFilters(prev => ({
      ...prev,
      bilanZones: prev.bilanZones.includes(zone)
        ? prev.bilanZones.filter(z => z !== zone)
        : [...prev.bilanZones, zone]
    }));
  };

  const handleSelectAllBilanZones = () => setFilters(prev => ({ ...prev, bilanZones: [] }));
  const handleClearBilanZones = () => setFilters(prev => ({ ...prev, bilanZones: [] }));

  const handleRefresh = () => {
    fetchAllData();
  };

  if (loading && !timeseriesData) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="card-title">Chargement des données...</div>
          <div className="card-sub">Connexion à l'API ONEE V2</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card" style={{ color: 'var(--red)', textAlign: 'center', padding: '60px' }}>
          <div className="card-title">❌ Erreur de chargement</div>
          <div className="card-sub">{error}</div>
          <button
            onClick={handleRefresh}
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
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const selectedCount = filters.bilanZones.length;
  const totalCount = allZones.length;
  const bilanTitle = {
    zones: 'par zone',
    provinces: 'par province',
    regions: 'par région'
  }[activeBilanTab];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Tableau de bord — Réseau ONEE</div>
        <div className="page-sub">
          Données historiques réelles {filters.startYear}–{filters.endYear} · {selectedRegion.name}
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
            <Filter size={16} /> Filtres
          </div>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filtre Région */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} style={{ color: 'var(--text2)' }} />
              <label style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: '500' }}>Région :</label>
            </div>
            
            <RegionSelector
              regions={regions}
              selectedRegion={selectedRegion}
              onRegionChange={handleRegionChange}
              loading={loadingRegions}
            />
          </div>

          {/* Période - uniquement données réelles jusqu'à 2024 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calendar size={16} style={{ color: 'var(--text2)' }} />
            <label style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: '500' }}>Période :</label>
            <select
              value={filters.startYear}
              onChange={e => setFilters(p => ({ ...p, startYear: +e.target.value }))}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: '0.85rem' }}
            >
              {[2004, 2010, 2015, 2020, 2022].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ color: 'var(--text2)' }}>→</span>
            <select
              value={filters.endYear}
              onChange={e => setFilters(p => ({ ...p, endYear: +e.target.value }))}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: '0.85rem' }}
            >
              {[2020, 2021, 2022, 2023, 2024].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {/* <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginLeft: '8px' }}>
              ⚡ Données réelles uniquement
            </span> */}
          </div>
          
          {activeBilanTab === 'zones' && (
            <ZoneFilter
              zones={allZones}
              selectedZones={filters.bilanZones}
              onZoneToggle={handleBilanZoneToggle}
              onSelectAll={handleSelectAllBilanZones}
              onClearAll={handleClearBilanZones}
              label="Filtrer le bilan par zone"
              maxDisplay={15}
              showCount={true}
              region={selectedRegion.code}
            />
          )}
        </div>
        <div style={{
          padding: '10px 16px',
          fontSize: '0.75rem',
          color: 'var(--text2)',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg2)',
          borderRadius: '0 0 12px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Info size={14} style={{ color: 'var(--text2)' }} />
          <span>Le filtre zone affecte <strong>uniquement</strong> l'onglet "Bilan par zone". Les autres vues affichent toutes les données.</span>
        </div>
      </div>

      {/* Chart principal */}
      <div className="charts-row">
        <div className="card chart-wide">
          <div className="card-header">
            <div>
              <div className="card-title">
                Consommation vs Production (données réelles)
              </div>
              <div className="card-sub">
                En millions m³/an · {filters.startYear}–{filters.endYear} · {selectedRegion.name}
              </div>
            </div>
            <div className="legend">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: chartColors.blue }}></div>
                Consommation
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: chartColors.teal }}></div>
                Production
              </div>
            </div>
          </div>
          <canvas id="mainChart" height="200" style={{ width: '100%', display: 'block' }}></canvas>
        </div>
      </div>

      {/* Consommation par type */}
      <div className="charts-row">
        <div className="card chart-wide">
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={16} style={{ color: 'var(--primary)' }} />
                Consommation par type
              </div>
              <div className="card-sub">
                Évolution des différents types de consommation · {selectedRegion.name}
              </div>
            </div>
            <div className="legend">
              {(consommationTypes.datasets || []).map((ds, idx) => (
                <div key={idx} className="legend-item">
                  <div className="legend-dot" style={{ background: chartColors[ds.colorKey] || chartColors.blue }}></div>
                  {ds.label}
                </div>
              ))}
            </div>
          </div>
          <canvas id="consommationTypesChart" height="200" style={{ width: '100%', display: 'block' }}></canvas>
        </div>
      </div>

      <AnalyticsCharts region={selectedRegion.code} year={parseInt(filters.endYear)} />

      {/* Onglets Bilan */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header" style={{ paddingBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            {[
              { id: 'zones', label: 'Zones', icon: MapPin, count: totalCount },
              { id: 'provinces', label: 'Provinces', icon: Building2, count: bilanProvinces.labels?.length || 0 },
              { id: 'regions', label: 'Régions', icon: Globe, count: bilanRegions.labels?.length || 0 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveBilanTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: activeBilanTab === tab.id ? '600' : '400',
                  color: activeBilanTab === tab.id ? 'var(--primary)' : 'var(--text2)',
                  borderBottom: activeBilanTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <tab.icon size={14} /> {tab.label}
                <span style={{ fontSize: '0.75rem', color: 'var(--text2)', marginLeft: '4px' }}>({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <div className="card-title" style={{ fontSize: '1rem', marginBottom: '4px' }}>
            Bilan {bilanTitle}
          </div>
          <div className="card-sub" style={{ marginBottom: '12px', fontSize: '0.85rem' }}>
            Solde production − consommation{' '}
            {activeBilanTab === 'zones' && selectedCount > 0
              ? `· ${selectedCount}/${totalCount} zones sélectionnées`
              : `· Toutes les ${bilanTitle}`}
          </div>
          <canvas id="bilanChart" height="300" style={{ width: '100%', display: 'block' }}></canvas>
        </div>
      </div>

      {/* Flux chart */}
      <div className="charts-row">
        <div className="card chart-wide">
          <div className="card-header">
            <div>
              <div className="card-title">Flux : Production → Distribution → Consommation</div>
              <div className="card-sub">
                Volumes annuels en millions m³ · Données réelles · {selectedRegion.name}
              </div>
            </div>
          </div>
          <canvas id="flowChart" height="200" style={{ width: '100%', display: 'block' }}></canvas>
        </div>
      </div>

      {/* Rendements */}
      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Rendements réseau</div>
            <div className="card-sub">Indicateurs par zone · {selectedRegion.name}</div>
          </div>
          <canvas id="rendChart" height="200" style={{ width: '100%', display: 'block' }}></canvas>
        </div>
      </div>

      {/* Alertes */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Carte de vulnérabilité</div>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <MapSection vulnerability={vulnerabilityData} masterCentres={masterCentresData} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">⚠️ Alertes actives</div>
        </div>
        <div className="alerts-list">
          {alerts.map((alert, idx) => (
            <AlertItem
              key={idx}
              icon={iconMap[alert.icon] || Info}
              iconColor={alert.color}
              title={alert.title}
              subtitle={alert.subtitle}
              meta={alert.meta}
            />
          ))}
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
      `}</style>
    </div>
  );
};

export default Dashboard;