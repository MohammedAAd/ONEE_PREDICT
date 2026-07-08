import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Topbar from './components/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consommation from './pages/Consommation';
import Production from './pages/Production';
import Bilan from './pages/Bilan';
//import DonneesManquantes from './pages/DonneesManquantes';
import Architecture from './pages/Architecture';
import Scenarios from './pages/Scenarios';
import Prediction from './pages/Prediction';
import Prediction_Y from './pages/Prediction_Y';
import Tables from './pages/Tables';
import AdminUsers from './pages/AdminUsers';
import './styles/global.css';

// Intégration de ONEPO AI : enveloppe l'app et affiche le widget de chat.
import { OnepoProvider } from './onepo/OnepoProvider';
import OnepoWidget from './onepo/OnepoWidget';
//import './onepo/onepo.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activePage, setActivePage] = useState('prediction');
  const [region, setRegion] = useState('TTA — Tanger-Tétouan');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Ajout d'un état de chargement

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    setIsAuthenticated(true);
    //setCurrentUser(parsedUser);
    
    // Vérifier si le token existe ET est valide (vous pouvez ajouter une vérification d'expiration)
    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        // Optionnel: vérifier si le token n'est pas expiré
        // const tokenData = JSON.parse(atob(token.split('.')[1]));
        // if (tokenData.exp * 1000 > Date.now()) {
          setIsAuthenticated(true);
          setCurrentUser(parsedUser);
        // }
      } catch (e) {
        // Token invalide, on reste sur la page de login
        console.error('Token invalide', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
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

  const handleLogin = (user) => {
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
      case 'consommation': return <Consommation />;
      case 'production': return <Production />;
      case 'bilan': return <Bilan />;
      // case 'manquant': return <DonneesManquantes />;
      case 'architecture': return <Architecture />;
      case 'scenarios': return <Scenarios />;
      case 'prediction': return <Prediction />;
      case 'prediction_y': return <Prediction_Y />;
      case 'tables': return <Tables />;
      case 'users': return currentUser?.is_admin ? <AdminUsers /> : <Dashboard region={region} />;
      default: return <Dashboard region={region} />;
    }
  };

  // Afficher un écran de chargement pendant la vérification
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff'
      }}>
        <div className="spinner"></div>
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