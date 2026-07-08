import React from 'react';
import { 
  Droplets, BarChart3, Droplet, Factory, Scale, Search, 
  Building2, Sparkles, Brain, Database, Activity, 
  Moon, Sun, Users, LogOut 
} from 'lucide-react';

const Topbar = ({ activePage, setActivePage, isDarkMode, toggleDarkMode, currentUser, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'prediction', label: 'Model-IA', icon: Brain },
    { id: 'scenarios', label: 'Scénarios', icon: Sparkles },
    {id: 'prediction_y', label: 'Prévision par centre', icon: Activity },
    { id: 'production', label: 'Production mensuelle', icon: Factory },
    { id: 'consommation', label: 'Consommation', icon: Droplet },
    { id: 'bilan', label: 'Bilan', icon: Scale },
    { id: 'tables', label: 'Tables', icon: Database }
  ];
  
  // Ajouter l'onglet Utilisateurs si l'utilisateur est admin
  if (currentUser?.is_admin) {
    navItems.push({ id: 'users', label: 'Utilisateurs', icon: Users });
  }

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <div className="logo-drop">
          <Droplets size={16} color="white" />
        </div>
        ONEE<i style={{ color: 'var(--blue)' }}>Predict</i>
      </div>
      <div className="topbar-center">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`topbar-pill ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon size={14} />
              {item.label}
            </div>
          );
        })}
      </div>
      <div className="topbar-right">
        <button
          className="theme-toggle"
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button 
          onClick={onLogout} 
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s'
          }}
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </header>
  );
};

export default Topbar;