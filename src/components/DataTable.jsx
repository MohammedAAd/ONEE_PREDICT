import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const DataTable = ({ tableName, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    if (tableName) {
      loadData();
    }
  }, [tableName]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTableData(tableName);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getFilteredData = () => {
    if (!data?.data) return [];
    
    let filtered = [...data.data];
    
    if (searchTerm) {
      filtered = filtered.filter(row => {
        return Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }
    
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  };

  const getPaginatedData = () => {
    const filtered = getFilteredData();
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filtered.slice(start, end);
  };

  const totalPages = () => {
    const filtered = getFilteredData();
    return Math.ceil(filtered.length / rowsPerPage);
  };

  const exportToCSV = () => {
    if (!data?.data) return;
    
    const headers = data.columns.join(',');
    const rows = data.data.map(row => 
      data.columns.map(col => `"${String(row[col] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Styles pour les boutons
  const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--blue)',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  };

  const buttonOutlineStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: '1px solid var(--blue)',
    padding: '8px 16px',
    borderRadius: '8px',
    color: 'var(--blue)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  };

  const searchInputStyle = {
    padding: '8px 12px 8px 32px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '13px',
    width: '200px'
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <p>Chargement de la table {tableName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px', borderColor: 'var(--red)' }}>
        <AlertCircle size={32} color="var(--red)" style={{ marginBottom: '16px' }} />
        <h4>Erreur</h4>
        <p>{error}</p>
        <button onClick={loadData} style={{ ...buttonStyle, marginTop: '12px' }}>Réessayer</button>
      </div>
    );
  }

  if (!data) return null;

  const filteredData = getPaginatedData();
  const filteredTotal = getFilteredData().length;

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="card-title">{tableName}</div>
          <div className="card-sub">
            {data.row_count} lignes · {data.column_count} colonnes
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)' }} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={searchInputStyle}
            />
          </div>
          <button onClick={exportToCSV} style={buttonStyle}>
            <Download size={14} /> Exporter CSV
          </button>
          <button onClick={loadData} style={buttonOutlineStyle}>
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '600px', width: '100%' }}>
          <thead>
            <tr>
              {data.columns.map(col => (
                <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer' }}>
                  {col}
                  {sortColumn === col && (
                    <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr key={idx}>
                {data.columns.map(col => (
                  <td key={col} style={{ maxWidth: '250px', overflow: 'auto', padding: '10px 12px' }}>
                    {String(row[col] || '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTotal === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          Aucun résultat trouvé
        </div>
      )}

      {filteredTotal > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
            {filteredTotal} lignes · Page {currentPage} sur {totalPages()}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                padding: '6px',
                fontSize: '12px'
              }}
            >
              <option value={10}>10 lignes</option>
              <option value={20}>20 lignes</option>
              <option value={50}>50 lignes</option>
              <option value={100}>100 lignes</option>
            </select>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 10px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
                color: 'var(--text)'
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages(), p + 1))}
              disabled={currentPage === totalPages()}
              style={{
                padding: '6px 10px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: currentPage === totalPages() ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages() ? 0.5 : 1,
                color: 'var(--text)'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;