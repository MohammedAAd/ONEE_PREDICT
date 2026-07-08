// components/MapSection.jsx
// Carte interactive des centres desservis et installations ONEE
// Utilise Leaflet via CDN (à charger dans index.html) ou via import dynamique

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, AlertTriangle, CheckCircle, XCircle, Layers } from 'lucide-react';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok:      { color: '#00c9a7', bg: '#00c9a722', label: 'Normal',  icon: CheckCircle },
  warn:    { color: '#f59e0b', bg: '#f59e0b22', label: 'Tension', icon: AlertTriangle },
  deficit: { color: '#ef4444', bg: '#ef444422', label: 'Déficit', icon: XCircle },
};

const INSTALL_TYPE_CONFIG = {
  station_traitement: { color: '#2d8bff', label: 'Station traitement', symbol: '◈' },
  reservoir:          { color: '#8b5cf6', label: 'Réservoir',          symbol: '⬡' },
  forage:             { color: '#f59e0b', label: 'Forage',             symbol: '◉' },
  dessalement:        { color: '#06b6d4', label: 'Dessalement',        symbol: '◆' },
};

const FallbackCoordinates = {
  'Agadir-Ida -Ou-Tanane': [30.4, -9.6],
  'Al Hoceima': [35.1, -3.9],
  'Berkane': [34.9, -2.33],
  'Chefchaouen': [35.17, -5.27],
  'Chtouka- Ait Baha': [30.4, -9.38],
  'Driouch': [35.18, -2.9],
  'Fahs-Anjra': [35.69, -5.89],
  'Figuig': [32.08, -2.14],
  'Guercif': [34.24, -3.95],
  'Inezgane- Ait Melloul': [30.4, -9.7],
  'Jerada': [34.32, -1.92],
  'Larache': [35.18, -6.15],
  'Nador': [35.17, -2.93],
  'Ouezzane': [34.77, -5.55],
  'Oujda-Angad': [34.68, -1.91],
  'Tanger-Assilah': [35.77, -5.92],
  'Taourirt': [34.4, -1.9],
  'Taroudannt': [30.47, -8.88],
  'Tata': [29.73, -7.98],
  'Tiznit': [29.7, -9.73],
  'T�touan': [35.57, -5.37],
  'Rabat-Salé-Kénitra': [34.0209, -6.8417],
  'Casablanca-Settat': [33.5731, -7.5898],
  'Marrakech-Safi': [31.6287, -7.9920],
  'Fès-Meknès': [34.0333, -5.0000],
  'Souss-Massa': [30.4200, -9.5900],
  'Tanger-Tétouan-Al Hoceïma': [35.7696, -5.8340],
  'Oriental': [34.6815, -1.9081],
  'Laâyoune-Sakia El Hamra': [27.1253, -13.1625],
  'Béni Mellal-Khénifra': [32.3372, -6.3495],
  'Drâa-Tafilalet': [31.9297, -4.4255],
  'Dakhla-Oued Ed-Dahab': [23.6848, -15.9574],
  'Guelmim-Oued Noun': [28.9730, -10.0972],
};

const DEFAULT_COORDINATE = [31.5, -6.5];

const getPerformanceScore = (centre) => {
  const rendDistribution = Number(centre?.rend_distribution ?? centre?.rendDistribution ?? 0);
  const tauxBranchement = Number(centre?.taux_branchement ?? centre?.tauxBranchement ?? 0);
  const production = Number(centre?.production ?? 0);
  const consommation = Number(centre?.consommation ?? 0);
  const balanceRatio = consommation > 0 ? production / consommation : 1;
  const weightedScore = ((rendDistribution / 100) * 0.6 + (tauxBranchement / 100) * 0.4) * 100;
  const adjustedScore = balanceRatio >= 1 ? weightedScore + 2 : weightedScore - 12;
  return Math.max(0, Math.min(100, adjustedScore));
};

const getCentreStatus = (centre) => {
  const production = Number(centre?.production ?? 0);
  const consommation = Number(centre?.consommation ?? 0);
  const rendDistribution = Number(centre?.rend_distribution ?? centre?.rendDistribution ?? 0);
  const tauxBranchement = Number(centre?.taux_branchement ?? centre?.tauxBranchement ?? 0);

  if (production < consommation) return 'deficit';
  if (rendDistribution < 70 || tauxBranchement < 85) return 'warn';
  return 'ok';
};

const getStatusColor = (status) => STATUS_CONFIG[status]?.color || STATUS_CONFIG.ok.color;

const normalizeInstallType = (rawType) => {
  const value = String(rawType || '').trim().toLowerCase();
  if (!value) return 'station_traitement';
  if (value.includes('dessal')) return 'dessalement';
  if (value.includes('forage')) return 'forage';
  if (value.includes('reservoir') || value.includes('réservoir')) return 'reservoir';
  return 'station_traitement';
};

const getPerformanceColor = (score) => {
  if (score >= 85) return '#16a34a';
  if (score >= 70) return '#10b981';
  if (score >= 55) return '#f59e0b';
  return '#ef4444';
};

const computeOffset = (index) => {
  const angle = (index * 37) % 360;
  const distance = 0.025 + (index % 4) * 0.01;
  const rad = angle * Math.PI / 180;
  return [Math.sin(rad) * distance, Math.cos(rad) * distance];
};

const resolveCentreCoordinates = (centre, index = 0) => {
  const lat = Number(centre?.lat ?? centre?.latitude ?? centre?.coord_latitude);
  const lng = Number(centre?.lng ?? centre?.longitude ?? centre?.coord_longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];

  const province = centre?.province || centre?.province_name || centre?.lib_province;
  const region = centre?.region_name || centre?.region || centre?.libelle_region;
  const base = province && FallbackCoordinates[province]
    ? FallbackCoordinates[province]
    : region && FallbackCoordinates[region]
      ? FallbackCoordinates[region]
      : DEFAULT_COORDINATE;

  const [dlng, dlat] = computeOffset(index);
  return [base[0] + dlat, base[1] + dlng];
};

const formatMetric = (value, digits = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('fr-FR', { maximumFractionDigits: digits });
};

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

const MapSection = ({ vulnerability, masterCentres }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showLayer, setShowLayer] = useState({ centres: true, installations: true });
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [installTypeFilter, setInstallTypeFilter] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('dark'));

  const realCentres = useMemo(() => {
    const centres = Array.isArray(masterCentres?.centres) ? masterCentres.centres : [];
    return centres
      .filter(Boolean)
      .map((centre, idx) => {
        const status = centre?.status || getCentreStatus(centre);
        const [lat, lng] = resolveCentreCoordinates(centre, idx);
        return {
          ...centre,
          lat,
          lng,
          status,
          statusText: STATUS_CONFIG[status]?.label || 'À vérifier',
          performanceScore: getPerformanceScore(centre),
        };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore);
  }, [masterCentres]);

  const realInstallations = useMemo(() => {
    const installations = Array.isArray(masterCentres?.installations) ? masterCentres.installations : [];
    const centresById = new Map(realCentres.map((c) => [String(c.id), c]));

    return installations
      .filter(Boolean)
      .map((installation, idx) => {
        const centreId = installation?.centre_id ? String(installation.centre_id) : null;
        const linkedCentre = centreId ? centresById.get(centreId) : null;

        const lat = Number(installation?.lat ?? installation?.latitude);
        const lng = Number(installation?.lng ?? installation?.longitude);
        let coord = Number.isFinite(lat) && Number.isFinite(lng)
          ? [lat, lng]
          : linkedCentre
            ? [linkedCentre.lat, linkedCentre.lng]
            : resolveCentreCoordinates({
                province: installation?.province,
                region_name: installation?.region_name,
              }, idx + 100);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          const [offLng, offLat] = computeOffset(idx + 11);
          coord = [coord[0] + offLat * 0.6, coord[1] + offLng * 0.6];
        }

        const tauxUtil = Number(installation?.tauxUtil ?? installation?.taux_util ?? 0);
        const status = installation?.status || (tauxUtil >= 95 ? 'deficit' : tauxUtil >= 80 ? 'warn' : 'ok');

        return {
          ...installation,
          id: installation?.id || installation?.name,
          name: installation?.name || installation?.id || 'Installation',
          type: normalizeInstallType(installation?.type || installation?.type_raw),
          lat: coord[0],
          lng: coord[1],
          status,
          tauxUtil,
          debit: Number(installation?.debit ?? installation?.debit_exploitable ?? installation?.debit_equipe ?? 0),
        };
      });
  }, [masterCentres, realCentres]);

  // Synchroniser le composant avec le theme global de l'application.
  useEffect(() => {
    const updateTheme = () => setIsDarkMode(document.body.classList.contains('dark'));
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Charger Leaflet dynamiquement
  useEffect(() => {
    if (window.L) { setLeafletLoaded(true); return; }

    // CSS Leaflet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // JS Leaflet
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Nettoyage optionnel
    };
  }, []);

  // Initialiser la carte quand Leaflet est prêt
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;

    const map = L.map(mapRef.current, {
      center: [31.5, -6.5],
      zoom: 5,
      zoomControl: true,
      attributionControl: false,
    });

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 18,
    }).addTo(map);

    L.control.attribution({ prefix: '© CartoDB · OpenStreetMap' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded, isDarkMode]);

  // Mettre a jour les tuiles lors du changement dark/light sans recreer la carte.
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 18 }).addTo(map);
  }, [isDarkMode, leafletLoaded]);

  const visibleCentres = useMemo(() => {
    if (statusFilter === 'all') return realCentres;
    return realCentres.filter((centre) => centre.status === statusFilter);
  }, [realCentres, statusFilter]);

  const visibleInstallations = useMemo(() => {
    return realInstallations.filter((installation) => {
      const statusMatch = statusFilter === 'all' || installation.status === statusFilter;
      const typeMatch = installTypeFilter === 'all' || installation.type === installTypeFilter;
      return statusMatch && typeMatch;
    });
  }, [realInstallations, statusFilter, installTypeFilter]);

  // Mettre à jour les markers quand filtres ou layers changent
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLoaded) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    // Supprimer les anciens markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const createSvgIcon = (color, symbol, size = 28, ring = false) => {
      const ringStr = ring
        ? `<circle cx="14" cy="14" r="12" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>`
        : '';
      return L.divIcon({
        className: '',
        html: `<svg width="${size}" height="${size}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
          ${ringStr}
          <circle cx="14" cy="14" r="8" fill="${color}" opacity="0.9"/>
          <circle cx="14" cy="14" r="8" fill="none" stroke="#fff" stroke-width="1.5"/>
          <text x="14" y="18" text-anchor="middle" font-size="9" fill="#fff" font-weight="bold">${symbol}</text>
        </svg>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    };

    if (showLayer.centres) {
      visibleCentres.forEach((centre) => {
        const cfg = STATUS_CONFIG[centre.status] || STATUS_CONFIG.ok;
        const marker = L.circleMarker([centre.lat, centre.lng], {
          radius: 8 + Math.round((centre.performanceScore / 100) * 8),
          color: '#ffffff',
          weight: 1.3,
          fillColor: cfg.color,
          fillOpacity: 0.85,
        });

        marker.bindTooltip(`<div style="font-family:monospace;font-size:11px;color:#e2e8f0;background:#1a2535;border:1px solid ${cfg.color};padding:6px 10px;border-radius:6px;min-width:180px">
          <div style="font-weight:700;margin-bottom:4px">${centre.name || 'Centre'}</div>
          <div style="color:#8ba8cc">${centre.province || centre.region_name || '-'}</div>
          <div style="margin-top:4px;color:${cfg.color}">● ${cfg.label}</div>
          <div style="color:#8ba8cc;margin-top:2px">Rendement: ${formatMetric(centre.rend_distribution ?? centre.rendDistribution, 1)}%</div>
          <div style="color:#8ba8cc">Branchement: ${formatMetric(centre.taux_branchement ?? centre.tauxBranchement, 1)}%</div>
        </div>`, { permanent: false, opacity: 1, className: '' });

        marker.on('click', () => setSelectedItem({ type: 'centre', data: centre }));
        marker.addTo(map);
        markersRef.current.push(marker);
      });
    }

    if (showLayer.installations) {
      visibleInstallations.forEach((installation, idx) => {
        const cfg = INSTALL_TYPE_CONFIG[installation.type] || INSTALL_TYPE_CONFIG.station_traitement;
        const statusCfg = STATUS_CONFIG[installation.status] || STATUS_CONFIG.ok;
        const marker = L.marker([installation.lat, installation.lng], {
          icon: createSvgIcon(cfg.color, cfg.symbol, 26, statusCfg.label !== 'Normal')
        });

        marker.bindTooltip(`<div style="font-family:monospace;font-size:11px;color:#e2e8f0;background:#1a2535;border:1px solid ${cfg.color};padding:6px 10px;border-radius:6px;min-width:190px">
          <div style="font-weight:700;margin-bottom:4px">${installation.name || 'Installation'}</div>
          <div style="color:#8ba8cc">${cfg.label}</div>
          <div style="color:#8ba8cc">Centre: ${installation.centre_name || '-'}</div>
          <div style="margin-top:4px;color:${statusCfg.color}">● ${statusCfg.label}</div>
          <div style="color:#8ba8cc;margin-top:2px">Débit: ${formatMetric(installation.debit, 1)} m³/h</div>
          <div style="color:#8ba8cc">Taux util.: ${formatMetric(installation.tauxUtil, 1)}%</div>
        </div>`, { permanent: false, opacity: 1, className: '' });

        marker.on('click', () => setSelectedItem({ type: 'installation', data: installation }));
        marker.addTo(map);
        markersRef.current.push(marker);
      });
    }

  }, [leafletLoaded, showLayer, statusFilter, visibleCentres, visibleInstallations]);

  const selectedCentre = selectedItem?.type === 'centre' ? selectedItem.data : null;
  const linkedCentreForInstallation = selectedItem?.type === 'installation'
    ? realCentres.find((c) => String(c.id) === String(selectedItem?.data?.centre_id))
    : null;

  const centreCount = realCentres.length;
  const statusCounts = realCentres.reduce((acc, centre) => {
    const status = centre?.status || 'ok';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { ok: 0, warn: 0, deficit: 0 });
  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      {/* Header */}
      <div className="card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} style={{ color: 'var(--primary)' }} />
            Carte — Centres desservis &amp; Installations
          </div>
          <div className="card-sub">Vue géographique du réseau ONEE · Données réelles (master_panel 2024)</div>
        </div>
        {/* Stats rapides */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block' }}></span>
              <span style={{ color: 'var(--text2)' }}>{cfg.label}</span>
              <span style={{ color: cfg.color, fontWeight: 700 }}>{statusCounts[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {vulnerability?.topRiskZones?.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text)' }}>
            Top zones à risque
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {vulnerability.topRiskZones.slice(0, 5).map((zone, index) => (
              <div key={index} style={{ padding: '12px', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>{zone.zone}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{zone.population.toLocaleString('fr-FR')} hab.</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem' }}>
                  <div style={{ color: 'var(--text2)' }}>Solde: <span style={{ color: zone.solde < 0 ? 'var(--red)' : 'var(--teal)', fontWeight: 700 }}>{zone.solde.toLocaleString('fr-FR')}</span></div>
                  <div style={{ color: 'var(--text2)' }}>Rend: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{zone.rendDistribution}%</span></div>
                  <div style={{ color: 'var(--text2)' }}>Branchement: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{zone.tauxBranchement}%</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        {/* Layers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={13} style={{ color: 'var(--text2)' }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text2)', fontWeight: 600 }}>Couches :</span>
          {[
            { key: 'centres', label: ' Centres' },
            { key: 'installations', label: '◈ Installations' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setShowLayer(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid',
                borderColor: showLayer[key] ? 'var(--primary)' : 'var(--border)',
                background: showLayer[key] ? 'var(--primary)' + '22' : 'transparent',
                color: showLayer[key] ? 'var(--primary)' : 'var(--text2)',
                fontWeight: showLayer[key] ? 600 : 400,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Filtre statut */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text2)', fontWeight: 600 }}>Statut :</span>
          {[
            { key: 'all', label: 'Tous' },
            ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label, color: cfg.color }))
          ].map(({ key, label, color }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid',
                borderColor: statusFilter === key ? (color || 'var(--primary)') : 'var(--border)',
                background: statusFilter === key ? (color || 'var(--primary)') + '22' : 'transparent',
                color: statusFilter === key ? (color || 'var(--primary)') : 'var(--text2)',
                fontWeight: statusFilter === key ? 600 : 400,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Filtre type d'installation */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text2)', fontWeight: 600 }}>Type installation :</span>
          {[{ key: 'all', label: 'Tous' }, ...Object.entries(INSTALL_TYPE_CONFIG).map(([key, cfg]) => ({ key, label: `${cfg.symbol} ${cfg.label}`, color: cfg.color }))].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setInstallTypeFilter(key)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid',
                borderColor: installTypeFilter === key ? (color || 'var(--primary)') : 'var(--border)',
                background: installTypeFilter === key ? ((color || 'var(--primary)') + '22') : 'transparent',
                color: installTypeFilter === key ? (color || 'var(--primary)') : 'var(--text2)',
                fontWeight: installTypeFilter === key ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Map + Side panel */}
      <div style={{ display: 'flex', height: '480px', background: isDarkMode ? 'var(--bg2)' : '#f8fafc', border: '1px solid var(--border)', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {/* Carte */}
        <div ref={mapRef} style={{ flex: 1, minWidth: 0, background: isDarkMode ? '#0f172a' : '#e2e8f0' }}>
          {!leafletLoaded && (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDarkMode ? 'var(--bg3)' : '#f1f5f9', color: 'var(--text2)' }}>
              Chargement de la carte...
            </div>
          )}
        </div>

        {/* Panneau détail */}
        <div style={{ width: 260, borderLeft: '1px solid var(--border)', background: 'var(--bg2)', overflowY: 'auto', padding: '12px' }}>
          {selectedItem ? (
            <DetailPanel item={selectedItem} linkedCentre={selectedCentre || linkedCentreForInstallation} />
          ) : (
            <DefaultPanel
              counts={{
                centres: centreCount,
                installations: realInstallations.length,
                displayed: visibleCentres.length,
                displayedInstallations: visibleInstallations.length,
              }}
              statusCounts={statusCounts}
              activeFilter={statusFilter}
              activeInstallType={installTypeFilter}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── SOUS-COMPOSANTS ──────────────────────────────────────────────────────────

const DetailPanel = ({ item, linkedCentre }) => {
  const isCentre = item.type === 'centre';
  const d = item.data;
  const statusCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.ok;

  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        {isCentre ? '⭐ Centre desservi' : '◈ Installation'}
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '4px', lineHeight: 1.3 }}>{d.name}</div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: 20, background: statusCfg.bg, border: `1px solid ${statusCfg.color}`, marginBottom: '12px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.color, display: 'inline-block' }}></span>
        <span style={{ fontSize: '0.72rem', color: statusCfg.color, fontWeight: 600 }}>{statusCfg.label}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isCentre ? (
          <>
            <InfoRow label="Province" value={d.province || d.province_name || '-'} />
            <InfoRow label="Région" value={d.region_name || d.region || '-'} />
            <InfoRow label="Population" value={formatMetric(d.population)} />
            <InfoRow label="Production" value={formatMetric(d.production)} />
            <InfoRow label="Consommation" value={formatMetric(d.consommation)} />
            <InfoRow label="Rend. dist." value={`${Number(d.rend_distribution ?? d.rendDistribution ?? 0).toFixed(1)} %`} highlight />
            <InfoRow label="Taux branchement" value={`${Number(d.taux_branchement ?? d.tauxBranchement ?? 0).toFixed(1)} %`} />
            <InfoRow label="Score perf." value={`${Math.round(d.performanceScore ?? 0)} / 100`} />
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text2)' }}>
              Priorité de réhabilitation : {d.performanceScore < 60 ? 'Élevée' : d.performanceScore < 75 ? 'Moyenne' : 'Faible'}
            </div>
          </>
        ) : (
          <>
            {linkedCentre && <InfoRow label="Centre" value={linkedCentre.name} />}
            <InfoRow label="Type" value={INSTALL_TYPE_CONFIG[d.type]?.label || d.type} />
            <InfoRow label="Débit exploit." value={`${d.debit} m³/h`} />
            <InfoRow label="Taux util." value={`${d.tauxUtil} %`} highlight />
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4 }}>Taux utilisation</div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.tauxUtil}%`, background: STATUS_CONFIG[d.status].color, borderRadius: 3, transition: 'width .5s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text2)', marginTop: 2 }}>
                <span>0%</span><span style={{ color: STATUS_CONFIG[d.status].color, fontWeight: 700 }}>{d.tauxUtil}%</span><span>100%</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const DefaultPanel = ({ counts, statusCounts, activeFilter, activeInstallType }) => (
  <div>
    <div style={{ fontSize: '0.7rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
      Vue d'ensemble
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
      <div style={{ padding: '10px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4 }}> Centres desservis</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>{counts.centres}</div>
      </div>
      <div style={{ padding: '10px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4 }}>◈ Installations</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>{counts.installations}</div>
      </div>
      <div style={{ gridColumn: '1 / -1', padding: '10px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4 }}>Centres affichés</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>{counts.displayed} / {counts.centres}</div>
      </div>
      <div style={{ gridColumn: '1 / -1', padding: '10px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 4 }}>Installations affichées</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>{counts.displayedInstallations} / {counts.installations}</div>
      </div>
    </div>
    <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: '8px', fontWeight: 600 }}>Statut des centres :</div>
    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.color}` }}>
        <span style={{ fontSize: '0.8rem', color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
        <span style={{ fontWeight: 700, color: cfg.color }}>{statusCounts[key]}</span>
      </div>
    ))}
    <div style={{ marginTop: '14px', fontSize: '0.72rem', color: 'var(--text2)', lineHeight: 1.5 }}>
      Filtre appliqué : {activeFilter === 'all' ? 'Tous les centres' : STATUS_CONFIG[activeFilter].label}.
    </div>
    <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text2)', lineHeight: 1.5 }}>
      Type installation : {activeInstallType === 'all' ? 'Tous les types' : (INSTALL_TYPE_CONFIG[activeInstallType]?.label || activeInstallType)}.
    </div>
  </div>
);

const InfoRow = ({ label, value, highlight }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', gap: '8px' }}>
    <span style={{ color: 'var(--text2)', flexShrink: 0 }}>{label}</span>
    <span style={{ color: highlight ? 'var(--primary)' : 'var(--text)', fontWeight: highlight ? 700 : 400, textAlign: 'right' }}>{value}</span>
  </div>
);

export default MapSection;