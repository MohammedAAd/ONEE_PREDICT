import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Topbar from './components/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Production from './pages/Production';
import Bilan from './pages/Bilan';
//import DonneesManquantes from './pages/DonneesManquantes';
import Architecture from './pages/Architecture';
import Scenarios from './pages/Scenarios';
import Prediction from './pages/Prediction';
import AdminUsers from './pages/AdminUsers';
import './styles/global.css';
import { Droplets } from 'lucide-react';

// Intégration de ONEPO AI : enveloppe l'app et affiche le widget de chat.
import { OnepoProvider } from './onepo/OnepoProvider';
import OnepoWidget from './onepo/OnepoWidget';
//import './onepo/onepo.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // Le tableau de bord est le point d'entrée de toute nouvelle session.
  const [activePage, setActivePage] = useState('dashboard');
  const [region, setRegion] = useState('TTA — Tanger-Tétouan');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Ajout d'un état de chargement

  useEffect(() => {
    // La plateforme présente toujours l'écran de connexion au démarrage.
    // Cela évite d'ouvrir directement une session précédente sur un poste partagé.
    setIsAuthenticated(false);
    setCurrentUser(null);
    
    // Récupérer le thème sauvegardé
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme !== null) {
      const isDark = savedTheme === 'true';
      setIsDarkMode(isDark);
      if (isDark) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
    } else {
      document.body.classList.remove('dark');
    }
    
    setIsLoading(false); // Fin du chargement
  }, []);

  useEffect(() => {
    const labels = {
      dashboard: 'Tableau de bord',
      prediction: 'Modèle IA',
      scenarios: 'Scénarios',
      simulation: 'Simulation avancée',
      production: 'Production mensuelle',
      bilan: 'Bilan ressource',
      users: 'Utilisateurs',
    };
    document.title = `${labels[activePage] || 'ONEE Predict'} — ONEE Predict`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage]);

  const handleLogin = (user) => {
    setActivePage('dashboard');
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    
    if (newDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  const renderPage = () => {
    switch(activePage) {
      case 'dashboard': return <Dashboard region={region} />;
      case 'production': return <Production />;
      case 'bilan': return <Bilan />;
      // case 'manquant': return <DonneesManquantes />;
      case 'architecture': return <Architecture />;
      case 'scenarios': return <Scenarios view="prepared" />;
      case 'simulation': return <Scenarios view="advanced" />;
      case 'prediction': return <Prediction />;
      case 'users': return currentUser?.is_admin ? <AdminUsers /> : <Dashboard region={region} />;
      default: return <Dashboard region={region} />;
    }
  };

  // Afficher un écran de chargement pendant la vérification
  if (isLoading) {
    return (
      <div className="app-loading" aria-live="polite" aria-label="Chargement de ONEE Predict">
        <div className="app-loading-mark"><Droplets size={25} /></div>
        <div className="app-loading-title">ONEE <em>Predict</em></div>
        <div className="app-loading-text">Préparation de votre espace de pilotage</div>
        <div className="app-loading-progress"><span /></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />;
  }

  return (
    <OnepoProvider activePage={activePage}>
      <div className="app">
        <Topbar
          activePage={activePage}
          setActivePage={setActivePage}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        <main className="main">
          <ErrorBoundary key={activePage}>
            {renderPage()}
          </ErrorBoundary>
        </main>
        <OnepoWidget />
      </div>
    </OnepoProvider>
  );
}

export default App;
