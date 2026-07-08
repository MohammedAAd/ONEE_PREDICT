import React from 'react';
import { LayoutDashboard, Droplets, Factory, Scale, Brain, Search, Building2, Sparkles, Database } from 'lucide-react';

const Sidebar = ({ activePage, setActivePage, region, setRegion }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'consommation', label: 'Consommation', icon: Droplets, badge: 'A', badgeOk: true },
    { id: 'production', label: 'Production', icon: Factory, badge: 'B', badgeOk: true },
    { id: 'bilan', label: 'Bilan ressource', icon: Scale },
    { id: 'prediction', label: 'Prédiction', icon: Brain }
  ];

  const analysisItems = [
    { id: 'manquant', label: 'Données manquantes', icon: Search, badge: '3' },
    { id: 'architecture', label: 'Architecture', icon: Building2 },
    { id: 'scenarios', label: 'Scénarios', icon: Sparkles },
    { id: 'tables', label: 'Tables', icon: Database }  // AJOUT : Tables dans l'analyse
  ];

  const regions = [
    'Toutes les régions',
    'TTA — Tanger-Tétouan',
    'Souss-Massa',
    'Marrakech-Safi',
    'Rabat-Salé'
  ];

  const selectStyle = {
    width: '100%',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '6px 10px',
    fontSize: '.75rem',
    fontFamily: "'Outfit', sans-serif"
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-section">Navigation</div>
      {navItems.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon"><Icon size={16} /></span>
            {item.label}
            {item.badge && (
              <span className={`nav-badge ${item.badgeOk ? 'ok' : ''}`}>{item.badge}</span>
            )}
          </div>
        );
      })}

      <div className="sidebar-section">Analyse</div>
      {analysisItems.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon"><Icon size={16} /></span>
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </div>
        );
      })}

      <div className="sidebar-section">Périmètre</div>
      <div style={{ padding: '8px 20px 4px' }}>
        <div style={{ fontSize: '.72rem', color: 'var(--text2)', marginBottom: '6px' }}>Région active</div>
        <select
          style={selectStyle}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          {regions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div style={{ padding: '8px 20px 4px', marginTop: '4px' }}>
        <div style={{ fontSize: '.72rem', color: 'var(--text2)', marginBottom: '6px' }}>Horizon de prédiction</div>
        <select style={selectStyle}>
          <option>5 ans (2025–2030)</option>
          <option>10 ans</option>
          <option>20 ans</option>
        </select>
      </div>
      <div style={{ padding: '16px 20px 0', marginTop: '8px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>Dernière mise à jour</div>
        <div style={{ fontSize: '.75rem', color: 'var(--text2)', fontFamily: "'DM Mono', monospace", marginTop: '2px' }}>2024 — Données HCP</div>
      </div>
    </aside>
  );
};

export default Sidebar;