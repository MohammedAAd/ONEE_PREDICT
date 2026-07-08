// frontend/src/components/RegionSelector.jsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Globe, CheckCircle2 } from 'lucide-react';

const RegionSelector = ({ regions, selectedRegion, onRegionChange, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRegions = regions.filter(region =>
    region.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRegionStats = (regionCode) => {
    // Vous pouvez remplacer ces stats par de vraies données de votre API
    const stats = {
      zones: Math.floor(Math.random() * 50) + 10,
      alertes: Math.floor(Math.random() * 5)
    };
    return stats;
  };

  return (
    <div className="region-selector">
      <button
        className={`region-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        <div className="trigger-content">
          <Globe size={18} className="trigger-icon" />
          <span className="trigger-text">
            {loading ? 'Chargement...' : selectedRegion?.name || 'Sélectionner une région'}
          </span>
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isOpen && !loading && (
        <div className="region-dropdown">
          <div className="dropdown-header">
            <input
              type="text"
              className="search-input"
              placeholder="Rechercher une région..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            <div className="region-count">
              {filteredRegions.length} région{filteredRegions.length > 1 ? 's' : ''}
            </div>
          </div>

          <div className="regions-grid">
            <button
              key="all"
              className={`region-card ${selectedRegion?.code === 'all' ? 'selected' : ''}`}
              onClick={() => {
                onRegionChange({ code: 'all', name: 'Toutes les régions' });
                setIsOpen(false);
                setSearchTerm('');
              }}
            >
              <div className="card-icon">
                <Globe size={24} />
              </div>
              <div className="card-content">
                <div className="card-title">Toutes les régions</div>
                <div className="card-stats">
                  <span className="stat">{regions.length} régions</span>
                </div>
              </div>
              {selectedRegion?.code === 'all' && (
                <div className="check-icon">
                  <CheckCircle2 size={20} />
                </div>
              )}
            </button>

            {filteredRegions.map((region) => {
              const stats = getRegionStats(region.code);
              const isSelected = selectedRegion?.code === region.code;
              
              return (
                <button
                  key={region.code}
                  className={`region-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onRegionChange(region);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <div className="card-icon">
                    <div className="icon-bg">
                      {region.name.charAt(0)}
                    </div>
                  </div>
                  <div className="card-content">
                    <div className="card-title">{region.name}</div>
                    <div className="card-stats">
                      <span className="stat">{stats.zones} zones</span>
                      {stats.alertes > 0 && (
                        <span className="stat alert">{stats.alertes} alertes</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="check-icon">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {filteredRegions.length === 0 && (
            <div className="no-results">
              Aucune région trouvée
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .region-selector {
          position: relative;
          width: 100%;
          max-width: 400px;
        }

        .region-trigger {
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text);
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
        }

        .region-trigger:hover {
          border-color: var(--primary);
          background: var(--bg3);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .region-trigger.open {
          border-color: var(--primary);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .trigger-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .trigger-icon {
          color: var(--primary);
        }

        .trigger-text {
          font-weight: 500;
        }

        .region-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          overflow: hidden;
          backdrop-filter: blur(20px);
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dropdown-header {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg3);
        }

        .search-input {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg1);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-size: 0.85rem;
          outline: none;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(45, 139, 255, 0.1);
        }

        .search-input::placeholder {
          color: var(--text2);
        }

        .region-count {
          margin-top: 10px;
          font-size: 0.75rem;
          color: var(--text2);
          text-align: center;
        }

        .regions-grid {
          max-height: 400px;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .regions-grid::-webkit-scrollbar {
          width: 6px;
        }

        .regions-grid::-webkit-scrollbar-track {
          background: var(--bg3);
          border-radius: 3px;
        }

        .regions-grid::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }

        .region-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          position: relative;
        }

        .region-card:hover {
          transform: translateX(4px);
          border-color: var(--primary);
          background: linear-gradient(135deg, var(--bg3) 0%, rgba(45, 139, 255, 0.05) 100%);
        }

        .region-card.selected {
          border-color: #10b981;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
          box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3);
        }

        .card-icon {
          flex-shrink: 0;
        }

        .icon-bg {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          border-radius: 10px;
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .card-content {
          flex: 1;
        }

        .card-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 4px;
        }

        .card-stats {
          display: flex;
          gap: 12px;
          font-size: 0.7rem;
        }

        .stat {
          color: var(--text2);
        }

        .stat.alert {
          color: var(--orange);
        }

        .check-icon {
          color: #10b981;
          flex-shrink: 0;
        }

        .no-results {
          padding: 40px 20px;
          text-align: center;
          color: var(--text2);
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
};

export default RegionSelector;