// frontend/src/components/ZoneFilter.jsx
import React, { useState } from 'react';
import { Search, CheckCircle2, ChevronDown, ChevronUp, X, Layers } from 'lucide-react';

const ZoneFilter = ({ 
  zones, 
  selectedZones, 
  onZoneToggle, 
  onSelectAll, 
  onClearAll, 
  label, 
  maxDisplay = 15, 
  showCount = true,
  region 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filteredZones = zones.filter(zone =>
    zone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedZones = showAll ? filteredZones : filteredZones.slice(0, maxDisplay);
  const hasMore = filteredZones.length > maxDisplay;
  const selectedCount = selectedZones.length;
  const totalCount = zones.length;

  // Statistiques pour l'affichage
  const getZoneStats = (zone) => {
    // Vous pouvez remplacer par de vraies stats
    return {
      solde: Math.floor(Math.random() * 100) - 50,
      alertes: Math.floor(Math.random() * 3)
    };
  };

  return (
    <div className="zone-filter">
      {/* En-tête du filtre */}
      <div className="filter-header">
        <div className="filter-title">
          <Layers size={16} />
          <span>{label || 'Filtrer par zone'}</span>
          {showCount && (
            <span className="filter-count">
              {selectedCount > 0 ? `${selectedCount}/${totalCount}` : totalCount}
            </span>
          )}
        </div>
        
        <div className="filter-actions">
          {selectedCount > 0 && (
            <button onClick={onClearAll} className="action-btn clear-btn">
              <X size={14} />
              Effacer
            </button>
          )}
          <button onClick={onSelectAll} className="action-btn select-btn">
            <CheckCircle2 size={14} />
            Tout sélectionner
          </button>
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className={`toggle-btn ${isOpen ? 'open' : ''}`}
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Contenu déroulant */}
      {isOpen && (
        <div className="filter-content">
          {/* Barre de recherche */}
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Rechercher une zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="clear-search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Statistiques */}
          <div className="stats-info">
            <span>{filteredZones.length} zone{filteredZones.length > 1 ? 's' : ''} trouvée{filteredZones.length > 1 ? 's' : ''}</span>
            {selectedCount > 0 && (
              <span className="selected-badge">{selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Grille de cards */}
          <div className="zones-grid">
            {displayedZones.map((zone) => {
              const isSelected = selectedZones.includes(zone);
              const stats = getZoneStats(zone);
              
              return (
                <button
                  key={zone}
                  className={`zone-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onZoneToggle(zone)}
                >
                  <div className="zone-card-icon">
                    <div className="icon-letter">
                      {zone.charAt(0)}
                    </div>
                  </div>
                  <div className="zone-card-content">
                    <div className="zone-name">{zone}</div>
                    {/* <div className="zone-stats">
                      <span className={`stat-solde ${stats.solde >= 0 ? 'positive' : 'negative'}`}>
                        {stats.solde >= 0 ? '+' : ''}{stats.solde} Mm³
                      </span>
                      {stats.alertes > 0 && (
                        <span className="stat-alert"> {stats.alertes}</span>
                      )}
                    </div> */}
                  </div>
                  {isSelected && (
                    <div className="check-icon">
                      <CheckCircle2 size={18} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bouton Voir plus */}
          {hasMore && (
            <button 
              className="show-more-btn"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Voir moins' : `Voir plus (+${filteredZones.length - maxDisplay})`}
            </button>
          )}

          {/* Aucun résultat */}
          {filteredZones.length === 0 && (
            <div className="no-results">
              Aucune zone trouvée pour "{searchTerm}"
            </div>
          )}
        </div>
      )}

      {/* Résumé des sélections */}
      {selectedCount > 0 && !isOpen && (
        <div className="selected-summary">
          {selectedZones.slice(0, 5).map(zone => (
            <span key={zone} className="selected-tag">
              {zone}
              <button onClick={() => onZoneToggle(zone)} className="remove-tag">
                <X size={12} />
              </button>
            </span>
          ))}
          {selectedCount > 5 && (
            <span className="selected-more">+{selectedCount - 5} autres</span>
          )}
        </div>
      )}

      <style jsx>{`
        .zone-filter {
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg2);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
        }

        .filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text);
        }

        .filter-count {
          background: var(--primary);
          color: white;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .filter-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .clear-btn {
          background: rgba(239, 68, 68, 0.1);
          color: var(--red);
        }

        .clear-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .select-btn {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .select-btn:hover {
          background: rgba(16, 185, 129, 0.2);
        }

        .toggle-btn {
          background: transparent;
          border: none;
          color: var(--text2);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          background: var(--bg3);
          color: var(--text);
        }

        .filter-content {
          padding: 16px;
          border-top: 1px solid var(--border);
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

        .search-wrapper {
          position: relative;
          margin-bottom: 12px;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text2);
        }

        .search-input {
          width: 100%;
          padding: 8px 32px 8px 36px;
          background: var(--bg1);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-size: 0.8rem;
          outline: none;
          transition: all 0.2s;
        }

        .search-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(45, 139, 255, 0.1);
        }

        .clear-search {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--text2);
          cursor: pointer;
          padding: 2px;
        }

        .stats-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.7rem;
          color: var(--text2);
        }

        .selected-badge {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 500;
        }

        .zones-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 8px;
          max-height: 400px;
          overflow-y: auto;
          padding: 2px;
        }

        .zones-grid::-webkit-scrollbar {
          width: 6px;
        }

        .zones-grid::-webkit-scrollbar-track {
          background: var(--bg3);
          border-radius: 3px;
        }

        .zones-grid::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }

        .zone-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          position: relative;
        }

        .zone-card:hover {
          transform: translateX(4px);
          border-color: var(--primary);
          background: linear-gradient(135deg, var(--bg2) 0%, rgba(45, 139, 255, 0.05) 100%);
        }

        .zone-card.selected {
          border-color: #10b981;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
          box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3);
        }

        .zone-card-icon {
          flex-shrink: 0;
        }

        .icon-letter {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          border-radius: 8px;
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .zone-card-content {
          flex: 1;
        }

        .zone-name {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 4px;
        }

        .zone-stats {
          display: flex;
          gap: 10px;
          font-size: 0.65rem;
        }

        .stat-solde {
          font-weight: 500;
        }

        .stat-solde.positive {
          color: #10b981;
        }

        .stat-solde.negative {
          color: var(--red);
        }

        .stat-alert {
          color: var(--orange);
        }

        .check-icon {
          color: #10b981;
          flex-shrink: 0;
        }

        .show-more-btn {
          width: 100%;
          margin-top: 12px;
          padding: 8px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--primary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .show-more-btn:hover {
          background: var(--bg1);
          border-color: var(--primary);
        }

        .no-results {
          text-align: center;
          padding: 40px;
          color: var(--text2);
          font-size: 0.85rem;
        }

        .selected-summary {
          padding: 10px 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 1px solid var(--border);
          background: var(--bg2);
        }

        .selected-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px 4px 12px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 20px;
          font-size: 0.7rem;
          color: #10b981;
        }

        .remove-tag {
          background: transparent;
          border: none;
          color: #10b981;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          border-radius: 50%;
        }

        .remove-tag:hover {
          background: rgba(16, 185, 129, 0.2);
        }

        .selected-more {
          font-size: 0.7rem;
          color: var(--text2);
          padding: 4px 8px;
        }
      `}</style>
    </div>
  );
};

export default ZoneFilter;