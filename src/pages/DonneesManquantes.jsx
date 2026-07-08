import React from 'react';
import { Calendar, CloudRain, Factory, Link, Wallet, CheckCircle, AlertTriangle, TrendingUp, Droplets, Gauge } from 'lucide-react';
import MissingDataCard from '../components/MissingDataCard';
import ProgressBar from '../components/ProgressBar';

const DonneesManquantes = () => {
  const missingData = [
    {
      icon: Calendar,
      title: 'Consommation mensuelle par centre',
      description: 'Fact_Activite_AEP ne contient que des données annuelles. Aucune ventilation mensuelle disponible.',
      impact: 'high',
      impactText: 'Impact critique sur le modèle',
      withoutText: 'Sans ces données : prédiction annuelle seulement, impossible de modéliser la saisonnalité de la demande ni de détecter les pics de consommation estivaux.',
      withText: '✓ Avec ces données : modèle mensuel SARIMA, prédiction des pics, planification des coupures programmées.'
    },
    {
      icon: CloudRain,
      title: 'Données climatiques (pluviométrie / température)',
      description: 'Aucune donnée météo n\'est intégrée dans les tables fournies.',
      impact: 'high',
      impactText: 'Impact fort sur la précision',
      withoutText: 'Sans ces données : variance annuelle non expliquée, années sèches vs humides non distinguées.',
      withText: '✓ Avec ces données : corrélation conso/température, prédiction de pointe estivale, alerte sécheresse.'
    },
    {
      icon: Factory,
      title: 'Activité économique locale',
      description: 'Aucune donnée sur l\'activité industrielle, touristique ou commerciale par commune.',
      impact: 'med',
      impactText: 'Impact modéré',
      withoutText: 'Sans ces données : consommation industrielle modélisée comme constante, alors qu\'elle est liée à l\'activité économique.',
      withText: '✓ Avec ces données : prédiction de la conso. industrielle, détection des nouveaux pôles.'
    },
    {
      icon: Link,
      title: 'Table correspondance centre ↔ installation',
      description: 'Annoncée mais non encore reçue. Générée manuellement à partir des données disponibles.',
      impact: 'high',
      impactText: 'Bloque le bilan unifié',
      withoutText: 'Sans cette table : Modèle A et Modèle B opèrent indépendamment, bilan ressource/besoin non calculable.',
      withText: '✓ Dès réception : bilan unifié activé, alertes déficit par centre opérationnelles.'
    },
    {
      icon: Wallet,
      title: 'Historique des tarifs et prix',
      description: 'Aucune donnée sur l\'évolution des tarifs de l\'eau par zone ou période.',
      impact: 'med',
      impactText: 'Impact modéré',
      withoutText: 'Sans ces données : élasticité-prix non capturée, variations de consommation liées aux hausses tarifaires non expliquées.',
      withText: '✓ Avec ces données : simulation de l\'impact d\'une hausse tarifaire sur la demande.'
    },
    {
      icon: CheckCircle,
      title: 'Données démographiques HCP complètes',
      description: 'Trois recensements (1994, 2004, 2014) + projection 2024 disponibles pour tous les centres.',
      impact: 'low',
      impactText: 'Données disponibles — point fort',
      withoutText: 'Historique de 30 ans permettant un calcul robuste des taux d\'accroissement intercensitaires par centre desservi.',
      withText: '✓ Utilisé dans l\'Étape 1 du Modèle A — projection démographique.'
    }
  ];

  // Transformer les icônes pour MissingDataCard (qui attend des strings)
  const missingDataWithStringIcons = missingData.map(item => ({
    ...item,
    icon: typeof item.icon === 'function' ? 'icon' : item.icon
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Données Manquantes — Diagnostic</div>
        <div className="page-sub">Impact sur la qualité du modèle · Recommandations de collecte · Ce que ces données permettraient de faire</div>
      </div>

      <div className="missing-grid">
        {missingData.map((data, idx) => {
          const IconComponent = data.icon;
          return (
            <div key={idx} className={`missing-card ${data.impact === 'high' ? 'absent' : data.impact === 'med' ? 'partial' : 'has'}`}>
              <div className="missing-icon"><IconComponent size={24} /></div>
              <div className="missing-title">{data.title}</div>
              <div className="missing-desc">{data.description}</div>
              <div className={`missing-impact ${data.impact === 'high' ? 'impact-high' : data.impact === 'med' ? 'impact-med' : 'impact-low'}`}>{data.impactText}</div>
              <div style={{ marginTop: '10px', fontSize: '.72rem', color: 'var(--text2)' }}>{data.withoutText}</div>
              <div style={{ marginTop: '8px', fontSize: '.72rem', color: 'var(--teal)' }}>{data.withText}</div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Valeurs manquantes dans Fact_Activite_AEP — par champ</div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
          <ProgressBar label="Consommation pop. branchée" value={94} color="var(--green)" />
          <ProgressBar label="Rendement de distribution" value={78} color="var(--amber)" />
          <ProgressBar label="Consommation industrielle" value={71} color="var(--amber)" />
          <ProgressBar label="Dotations par usage" value={65} color="var(--blue)" />
          <ProgressBar label="Rendement adduction" value={52} color="var(--red)" />
        </div>
      </div>
    </div>
  );
};

export default DonneesManquantes;