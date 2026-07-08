// pages/Architecture.jsx
import React from 'react';
import ArchitectureStep from '../components/ArchitectureStep';

const Architecture = () => {
  const modeleASteps = [
    { step: 'A1', title: 'Population branchée future', label: 'Projection démographique', formula: 'Pop(t) = Pop(t₀) × (1+τ)^t × taux_branch(t)', items: ['HCP 1994–2024', 'Taux accroissement', 'Taux branchement'], color: 'purple' },
    { step: 'A2', title: 'Besoin total par centre', label: 'Besoins par usage', formula: 'Besoin = Σ (Pop_usage × Dot_usage)', items: ['Dot. PB · BF · Admin', 'Fact_AEP', 'Nbre abonnés'], color: 'blue' },
    { step: 'A3', title: 'Volume à distribuer et produire', label: 'Correction rendements', formula: 'Vol_dist = Besoin ÷ Rend_D  ·  Vol_prod = Vol_dist ÷ Rend_A', items: ['Rend. distribution', 'Rend. adduction'], color: 'blue' },
    { step: 'A4', title: 'Régression / XGBoost', label: 'Calibrage statistique', formula: 'Ŷ = f(Pop_branch, Dot_nette, Rend_D, Type_centre, ...)', items: ['Historique AEP', '12 features', 'Résidus non-démo'], color: 'purple' }
  ];

  const modeleBSteps = [
    { step: 'B1', title: 'Tendance + Saisonnalité + Résidu', label: 'Décomposition série temporelle', formula: 'Y(t) = T(t) + S(t) + ε(t)', items: ['Prod. mensuelle', 'Par installation'], color: 'teal' },
    { step: 'B2', title: 'Prédiction 60 mois par installation', label: 'Modèle SARIMA', formula: 'SARIMA(p,d,q)(P,D,Q)₁₂', items: ['Saisonnalité 12 mois', 'Intervalles conf.'], color: 'teal' },
    { step: 'B3', title: 'Alerte saturation', label: 'Taux d\'utilisation', formula: 'Taux_util = Vol_traité ÷ Vol_exploitable × 100', items: ['Alerte si > 85 %', 'INSTALLATIONS_PROD'], color: 'teal' },
    { step: 'B4', title: 'Σ productions → centre', label: 'Agrégation centre desservi', formula: 'Prod_centre = Σ Vol_install(i) pour i ∈ centre', items: ['Table correspondance', 'En attente réception'], color: 'green' }
  ];

  const moduleCItems = [
    { icon: '', title: 'Jointure A + B', subtitle: 'Sur (ID_Centre, Annee)' },
    { icon: '', title: 'Solde', subtitle: 'Prod − Conso' },
    { icon: '', title: 'Marge sécurité', subtitle: 'Solde ÷ Conso × 100' },
    { icon: '', title: 'Alertes', subtitle: 'Déficit · Saturation · Tension' }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Architecture du Modèle en Cascade</div>
        <div className="page-sub">Pipeline complet : données sources → Modèle A → Modèle B → Bilan unifié</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div className="card">
          <div className="card-header"><div className="card-title" style={{ color: 'var(--purple)' }}>Modèle A — Consommation</div></div>
          <div className="arch-flow">
            {modeleASteps.map((step, idx) => (
              <ArchitectureStep key={idx} {...step} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title" style={{ color: 'var(--teal)' }}>Modèle B — Production</div></div>
          <div className="arch-flow">
            {modeleBSteps.map((step, idx) => (
              <ArchitectureStep key={idx} {...step} />
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '14px' }}>
        <div className="card-header"><div className="card-title" style={{ color: 'var(--green)' }}>Module C — Bilan Unifié</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {moduleCItems.map((item, idx) => (
            <div key={idx} style={{ textAlign: 'center', padding: '14px', background: 'var(--bg3)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.5rem' }}>{item.icon}</div>
              <div style={{ fontSize: '.75rem', fontWeight: '600', marginTop: '8px' }}>{item.title}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--text2)', marginTop: '4px' }}>{item.subtitle}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Architecture;