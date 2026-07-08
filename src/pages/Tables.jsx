// pages/Tables.jsx
import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Table as TableIcon, BarChart3, AlertCircle, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import DataTable from '../components/DataTable';

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schemas, setSchemas] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTables();
    loadSchemas();
  }, []);

  const loadTables = async () => {
    try {
      const result = await api.getTables();
      // Filtrer les tables temporaires (commençant par ~)
      const filteredTables = (result.tables || []).filter(table => !table.startsWith('~'));
      setTables(filteredTables);
      if (filteredTables.length > 0 && !selectedTable) {
        setSelectedTable(filteredTables[0]);
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // CORRECTION : Gérer le cas où getTableSchemas n'est pas disponible
  const loadSchemas = async () => {
    try {
      const result = await api.getTableSchemas();
      if (result && Object.keys(result).length > 0) {
        setSchemas(result);
      } else {
        console.log('getTableSchemas retourné vide ou non disponible');
      }
    } catch (err) {
      console.log('getTableSchemas non disponible:', err.message);
      // Ne pas bloquer l'application si les schémas ne sont pas disponibles
    }
  };

  // Formater le nombre de lignes avec séparateur
  const formatRowCount = (count) => {
    if (!count) return '';
    return count.toLocaleString('fr-FR') + ' lignes';
  };

  if (error) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">Explorateur de Bases de Données</div>
          <div className="page-sub">Erreur de connexion à la base de données</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px', borderColor: 'var(--red)' }}>
          <AlertCircle size={48} color="var(--red)" style={{ marginBottom: '16px' }} />
          <h4>Erreur de connexion</h4>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '20px', padding: '8px 20px', background: 'var(--blue)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Explorateur de Bases de Données</div>
        <div className="page-sub">
          Visualisez et explorez vos tables Access avec des statistiques détaillées
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        {/* Sidebar des tables */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', marginBottom: '0' }}>
            <Database size={18} />
            <div className="card-title">Tables disponibles</div>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : tables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
                Aucune table trouvée
              </div>
            ) : (
              tables.map((table, index) => {
                const isActive = selectedTable === table;
                const rowCount = schemas[table]?.row_count;
                return (
                  <div
                    key={`table-${index}`}
                    onClick={() => setSelectedTable(table)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 20px',
                      cursor: 'pointer',
                      borderLeft: `3px solid ${isActive ? 'var(--blue)' : 'transparent'}`,
                      background: isActive ? 'var(--bg3)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--bg2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <TableIcon size={16} style={{ color: isActive ? 'var(--blue)' : 'var(--text2)' }} />
                      <span style={{ 
                        fontWeight: isActive ? '600' : '400',
                        color: isActive ? 'var(--text)' : 'var(--text2)',
                        fontSize: '13px'
                      }}>
                        {table}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {rowCount && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: 'var(--text3)',
                          background: 'var(--bg3)',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}>
                          {rowCount.toLocaleString('fr-FR')}
                        </span>
                      )}
                      <ChevronRight size={14} style={{ color: isActive ? 'var(--blue)' : 'var(--text3)', opacity: isActive ? 1 : 0.5 }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Contenu principal */}
        <div>
          {selectedTable ? (
            <DataTable tableName={selectedTable} />
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
              <Database size={48} color="var(--text3)" />
              <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>Sélectionnez une table</h4>
              <p style={{ color: 'var(--text2)', fontSize: '13px' }}>Choisissez une table dans la colonne de gauche pour visualiser son contenu</p>
            </div>
          )}

          {/* Statistiques des tables */}
          {Object.keys(schemas).length > 0 && (
            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card-header">
                <BarChart3 size={18} />
                <div className="card-title">Statistiques des tables</div>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '12px', 
                marginTop: '16px' 
              }}>
                {Object.entries(schemas)
                  .filter(([name]) => !name.startsWith('~'))
                  .slice(0, 8)
                  .map(([name, info], index) => (
                    <div 
                      key={`schema-${index}`}
                      style={{ 
                        background: 'var(--bg3)', 
                        borderRadius: '10px', 
                        padding: '12px 16px',
                        border: '1px solid var(--border)',
                        transition: 'transform 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedTable(name)}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TableIcon size={14} style={{ color: 'var(--blue)' }} />
                        {name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                        {info.row_count?.toLocaleString('fr-FR') || '0'} lignes · {info.columns?.length || 0} colonnes
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Tables;