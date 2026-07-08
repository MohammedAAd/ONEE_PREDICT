import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { api } from '../services/api';

const MissingDataReport = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const response = await fetch('/ml/data/missing_data_report.json');
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Erreur chargement rapport:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--amber)' }}>
      <div className="card-header">
        <Info size={18} color="var(--amber)" />
        <div className="card-title">📊 Disponibilité des données</div>
      </div>
      
      <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>
        <p><strong>Note importante:</strong> La population n'est disponible que pour les années de recensement (1994, 2004, 2014, 2024).</p>
        <p>Les autres années sont interpolées linéairement entre ces points.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {report && Object.entries(report).map(([key, value]) => {
          const completeness = 100 - value.pourcentage;
          let icon, color;
          if (completeness >= 90) {
            icon = <CheckCircle size={16} color="var(--green)" />;
            color = 'var(--green)';
          } else if (completeness >= 70) {
            icon = <AlertTriangle size={16} color="var(--amber)" />;
            color = 'var(--amber)';
          } else {
            icon = <XCircle size={16} color="var(--red)" />;
            color = 'var(--red)';
          }
          
          return (
            <div key={key} style={{ textAlign: 'center', padding: '8px', background: 'var(--bg3)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
                {icon}
                <span style={{ fontSize: '12px', fontWeight: '500' }}>{key}</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color }}>{completeness}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>complet</div>
            </div>
          );
        })}
      </div>

      {report?.population?.explication && (
        <div style={{ marginTop: '12px', padding: '8px', background: 'var(--amber-10)', borderRadius: '6px', fontSize: '11px', color: 'var(--amber)' }}>
          <Info size={12} style={{ display: 'inline', marginRight: '6px' }} />
          {report.population.explication}
        </div>
      )}
    </div>
  );
};

export default MissingDataReport;