import React from 'react';
import {
  Droplets, BarChart3, Factory, Scale, Sparkles, Brain, SlidersHorizontal,
  Moon, Sun, Users, LogOut
} from 'lucide-react';

const Topbar = ({ activePage, setActivePage, isDarkMode, toggleDarkMode, currentUser, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'scenarios', label: 'Scénarios', icon: Sparkles },
    { id: 'simulation', label: 'Simulation avancée', icon: SlidersHorizontal },
    { id: 'production', label: 'Production mensuelle', icon: Factory },
    { id: 'bilan', label: 'Bilan', icon: Scale },
    { id: 'prediction', label: 'Model-IA', icon: Brain }
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
            <button
              key={item.id}
              type="button"
              className={`topbar-pill ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <Icon size={14} />
              {item.label}
            </button>
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
          type="button"
          onClick={onLogout} 
          className="logout-button"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </header>
  );
};

export default Topbar;
