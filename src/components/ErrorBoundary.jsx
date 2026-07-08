import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Erreur de page capturée :', error, info);
  }

  render() {
    if (this.state.error) {
      const msg = (this.state.error && this.state.error.message) || String(this.state.error);
      return (
        <div className="page" style={{ padding: 40 }}>
          <h2 style={{ color: '#dc2626', marginBottom: 8 }}>
            Cette page n'a pas pu s'afficher
          </h2>
          <p style={{ color: '#64748b', maxWidth: 620 }}>
            Les pages <b>Prévision</b> et <b>Scénarios</b> fonctionnent avec le
            backend actuel. Les pages d'exploration de données (Tableau de bord,
            Consommation, Production, Bilan…) nécessitent le backend complet
            relié à la base de données.
          </p>
          <pre style={{ background: '#f1f5f9', color: '#334155', padding: 12,
                        borderRadius: 8, fontSize: 12, marginTop: 12, overflow: 'auto' }}>
            {msg}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}