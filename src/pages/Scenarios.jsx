import React, { useState, useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import { previsionApi } from '../services/api';
import StatCard from '../components/StatCard';
import { useScreenContext } from '../onepo/useScreenContext';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3, Settings, Rocket, Droplets, Factory, Users, Calendar, Target, Zap, ChevronDown, ChevronUp, Search } from 'lucide-react';

const fmtM = (v) => (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const yearlyM3ToLs = (m3PerYear) => (m3PerYear * 1000) / (365 * 24 * 3600);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CIBLES = [
  { id: 'consommation_totale', label: 'Consommation totale', icon: Droplets },
  { id: 'distribution', label: 'Distribution', icon: Factory },
  { id: 'production', label: 'Production', icon: Zap },
];

const PRESETS = [
  {
    id: 'taroudant', color: '#3b82f6', icon: TrendingUp,
    categorie: 'Demande · horizon n+30',
    titre: 'Intégration progressive — Taroudant',
    contexte: "Raccordement progressif de nouveaux centres en 2026 et 2028",
    leviers: ['Croissance +3,2 %/an', 'Horizon 2045'],
    decision: "anticiper les volumes à mobiliser et le calendrier d'investissement réseau.",
    params: { cible: 'consommation_totale', taux_accroissement: 3.2, annee_horizon: 2045 },
  },
  {
    id: 'larache', color: '#f59e0b', icon: AlertTriangle,
    categorie: 'Ressource · bilan m+12',
    titre: 'Larache — forages en baisse',
    contexte: "Déclin des forages (−15 % de capacité), compensé par l'extension LOUKKOUS",
    leviers: ['Capacité −15 %', '+330 l/s LOUKKOUS', 'Dessalement'],
    decision: "vérifier si la nouvelle ressource compense la perte des forages.",
    params: { cible: 'production', delta_capacite_pct: -15, capacite_additionnelle_m3: 868000,
              capacite_additionnelle_libelle: 'LOUKKOUS + dessalement', annee_mensuel: 2024 },
  },
  {
    id: 'larache-tanger', color: '#0ea5e9', icon: BarChart3,
    categorie: 'Ressource · bilan m+12',
    titre: 'Larache — renforcement via Tanger 150 Mm³/an',
    contexte: "Simulation d'un renforcement Larache depuis la station de dessalement projetée de Tanger.",
    leviers: ['Dessalement Tanger 150 Mm³/an', '≈ 12,5 Mm³/mois', 'Affectation vers Larache'],
    decision: "quantifier l'impact du transfert Tanger -> Larache sur le déficit mensuel et annuel.",
    params: { cible: 'production', capacite_additionnelle_m3: 12500000,
              capacite_additionnelle_libelle: 'Renforcement Tanger -> Larache (150 Mm³/an)', annee_mensuel: 2024 },
  },
  {
    id: 'agadir', color: '#10b981', icon: CheckCircle,
    categorie: 'Ressource · bilan m+12',
    titre: 'Dessalement Agadir — 1740 l/s',
    contexte: "Station de dessalement de 1740 l/s pour sécuriser le Grand Agadir",
    leviers: ['+1740 l/s', '≈ 4,58 Mm³/mois', 'Hors patrimoine ONEE'],
    decision: "mesurer le gain de sécurité d'approvisionnement.",
    params: { cible: 'production', capacite_additionnelle_m3: 4576000,
              capacite_additionnelle_ulterieure_m3: 1916667,
              annee_debut_capacite_ulterieure: 2030,
              capacite_additionnelle_libelle: 'Dessalement Agadir existant (1740 l/s) + projet 23 Mm³/an', annee_mensuel: 2024 },
  },
  {
    id: 'pilot-zones', color: '#6366f1', icon: Rocket,
    categorie: 'Pilote stratégique',
    titre: 'Taroudant / Larache / Agadir',
    contexte: "Scénario combiné des trois zones pilotes pour tester besoins et ressources.",
    leviers: ['Intégration progressive Taroudant', 'LOUKKOUS + dessalement', 'Dessalement Agadir'],
    decision: "Comparer les besoins à long terme et valider l'effort de renforcement local.",
    params: {
      cible: 'production',
      taux_accroissement: 3.2,
      annee_horizon: 2045,
      delta_capacite_pct: -10,
      capacite_additionnelle_m3: 4576000,
      capacite_additionnelle_libelle: 'Dessalement Agadir + LOUKKOUS',
      annee_mensuel: 2024,
    },
  },
];

const PILOT_PRESET_IDS = new Set(['taroudant', 'larache', 'agadir']);
const PRESETS_OVERVIEW = PRESETS.filter((preset) => !PILOT_PRESET_IDS.has(preset.id));

// Modèles décisionnels du blueprint : ils représentent des questions de
// planification réelles, pas des exemples arbitraires.
const BLUEPRINT_PRESETS = [
  {
    id: 'secheresse-3-ans', color: '#dc2626', icon: AlertTriangle,
    categorie: 'Choc · ressource', titre: 'Sécheresse sur trois ans',
    contexte: 'Réduction de la ressource exploitable afin de mesurer l’année où la capacité ne couvre plus le besoin.',
    leviers: ['Ressource −20 % (2024–2026)', 'Horizon 2035'],
    decision: 'Prioriser les systèmes dont le déficit apparaît le plus tôt.',
    params: { cible: 'production', stress_ressource_pct: 20, annee_debut_stress: 2024, duree_stress_ans: 3, annee_horizon: 2035, annee_mensuel: 2024 },
  },
  {
    id: 'reduction-pertes', color: '#10b981', icon: CheckCircle,
    categorie: 'Efficacité · réseau', titre: 'Programme de réduction des pertes',
    contexte: 'Amélioration du rendement de distribution pour comparer l’efficacité réseau à un investissement de capacité.',
    leviers: ['Rendement distribution 85 %', 'Horizon 2035'],
    decision: 'Mesurer le déficit évité par la réduction des pertes.',
    params: { cible: 'production', rendement_distribution: 85, annee_horizon: 2035, annee_mensuel: 2024 },
  },
  {
    id: 'hausse-touristique', color: '#f59e0b', icon: TrendingUp,
    categorie: 'Demande · fréquentation', titre: 'Hausse de fréquentation touristique',
    contexte: 'Hausse annuelle de la demande, à décliner par mois lorsque le profil touristique local sera disponible.',
    leviers: ['Demande annuelle +12 %', 'Horizon 2035'],
    decision: 'Vérifier si la marge disponible absorbe le pic de demande.',
    params: { cible: 'consommation_totale', tourisme_pct: 12, annee_horizon: 2035, annee_mensuel: 2024 },
  },
  {
    id: 'nouvelle-zone-industrielle', color: '#6366f1', icon: Factory,
    categorie: 'Demande · développement', titre: 'Nouvelle zone industrielle',
    contexte: 'Ajout d’un besoin industriel à partir d’une date de mise en service définie.',
    leviers: ['+3 Mm³/an dès 2030', 'Horizon 2038'],
    decision: 'Dimensionner la ressource avant la mise en service de la zone.',
    params: { cible: 'consommation_totale', industrie_m3_an: 3000000, annee_debut_industrie: 2030, annee_horizon: 2038, annee_mensuel: 2024 },
  },
];

const PILOT_ZONES = [
  {
    id: 'taroudant-2026',
    presetId: 'taroudant',
    nonExhaustive: true,
    paramsOverride: {
      taux_accroissement: 2.4,
      annee_horizon: 2038,
    },
    title: 'Taroudant — phase 2026',
    subtitle: 'Intégration progressive de centres',
    note: 'Centres alimentés progressivement à partir de 2026',
    dataNote: 'Les historiques et prévisions de ces centres doivent être intégrés avant simulation.',
    inputs: [
      ['Mise en service', '2026'],
      ['Croissance annuelle', '2,4 %'],
      ['Horizon de calcul', '2038'],
      ['Rendements et branchement', 'Moyennes des centres'],
    ],
    centres: [
      { id: '09.541.05.01', name: 'Ahl Ramel' },
      { id: '09.541.04.09', name: 'Arazane' },
      { id: '09.541.04.13', name: 'El Faid' },
      { id: '09.541.04.23', name: 'Igli' },
      { id: '09.541.04.25', name: 'Igoudar Mnabha' },
    ],
  },
  {
    id: 'taroudant-2028',
    presetId: 'taroudant',
    nonExhaustive: true,
    paramsOverride: {
      taux_accroissement: 3.2,
      annee_horizon: 2045,
    },
    title: 'Taroudant — phase 2028',
    subtitle: 'Raccordement complémentaire',
    note: 'Centres alimentés progressivement à partir de 2028',
    dataNote: 'Les historiques et prévisions de ces centres doivent être intégrés avant simulation.',
    inputs: [
      ['Mise en service', '2028'],
      ['Croissance annuelle', '3,2 %'],
      ['Horizon de calcul', '2045'],
      ['Rendements et branchement', 'Moyennes des centres'],
    ],
    centres: [
      { id: '09.541.07.09', name: 'Assaki' },
      { id: '09.541.07.11', name: 'Azrar' },
      { id: '09.541.07.19', name: 'Tassousfi' },
      { id: '09.541.07.25', name: 'Zagmouzen' },
    ],
  },
  {
    id: 'agadir',
    presetId: 'agadir',
    nonExhaustive: true,
    paramsOverride: {
      capacite_additionnelle_m3: 4576000,
      annee_mensuel: 2024,
    },
    title: 'Agadir',
    subtitle: 'Station de dessalement projetée',
    note: 'Dessalement 23 Mm³/an projeté à partir de 2030 + intégration de la station existante (1740 l/s).',
    inputs: [
      ['Capacité existante', '1 740 l/s (4,576 Mm³/mois)'],
      ['Capacité future', '23 Mm³/an'],
      ['Mise en service future', '2030'],
    ],
    centres: [
      { id: '0427305273', name: 'Temsia' },
      // L'identifiant exploitable dans les données de prévision est 0416307273.
      { id: '0416307273', name: 'Sidi Bibi' },
    ],
  },
  {
    id: 'larache',
    presetId: 'larache',
    nonExhaustive: true,
    paramsOverride: {
      delta_capacite_pct: -15,
      capacite_additionnelle_m3: 868000,
      annee_mensuel: 2024,
    },
    title: 'Larache',
    subtitle: 'Extension LOUKKOUS / dessalement / appui Tanger',
    note: 'Étude de renforcement de la ressource (LOUKKOUS, dessalement local, et transfert potentiel depuis Tanger 150 Mm³/an).',
    dataNote: 'Les projets doivent être associés aux centres de desserte et à leurs prévisions avant simulation.',
    inputs: [
      ['Baisse des forages', '−15 %'],
      ['LOUKKOUS', '660 + 330 l/s'],
      ['Renforcement modélisé', '+330 l/s (0,868 Mm³/mois)'],
      ['Transfert Tanger potentiel', '150 Mm³/an'],
    ],
    centres: [
      { id: '01.234.56789', name: 'LOUKKOUS' },
      { id: '01.234.56790', name: 'Dessalement local' },
    ],
  },
];

// Composant SelectWithSearch réutilisable
function SelectWithSearch({ options, value, onChange, placeholder, labelKey = 'label', valueKey = 'id', allOptionLabel = 'Tous' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => 
      opt[labelKey].toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, labelKey]);

  const selectedOption = value === '' 
    ? { [valueKey]: '', [labelKey]: allOptionLabel }
    : options.find(opt => opt[valueKey] === value);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-select-container" ref={dropdownRef}>
      <div 
        className="search-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="selected-value">
          {selectedOption?.[labelKey] || allOptionLabel}
        </span>
        <ChevronDown size={16} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="search-dropdown">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="dropdown-options">
            <div 
              className={`dropdown-option ${value === '' ? 'selected' : ''}`}
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchTerm('');
              }}
            >
              {allOptionLabel}
            </div>
            {filteredOptions.map(opt => (
              <div 
                key={opt[valueKey]}
                className={`dropdown-option ${value === opt[valueKey] ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt[valueKey]);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                {opt[labelKey]}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="dropdown-empty">Aucun résultat</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({ label, min, max, step, value, set, suffix = '', icon: Icon }) {
  const percent = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="slider-group">
      <div className="slider-header">
        <div className="slider-label">
          {Icon && <Icon size={14} className="slider-icon" />}
          <span>{label}</span>
        </div>
        <div className="slider-value">{value}{suffix}</div>
      </div>
      <div className="slider-track">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => set(+e.target.value)}
          className="slider-input"
          style={{ '--percent': `${percent}%` }}
        />
        <div className="slider-range">
          <span>{min}{suffix}</span>
          <span>{max}{suffix}</span>
        </div>
      </div>
    </div>
  );
}

export default function Scenarios({ view = 'prepared' }) {
  const [centres, setCentres] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [cible, setCible] = useState('consommation_totale');
  const [centreId, setCentreId] = useState('');
  const [taux, setTaux] = useState(3);
  const [rendDist, setRendDist] = useState(75);
  const [rendAdd, setRendAdd] = useState(85);
  const [branch, setBranch] = useState(88);
  const [horizon, setHorizon] = useState(2054);
  const [deltaCap, setDeltaCap] = useState(0);
  const [capAdd, setCapAdd] = useState(0);
  const [capAddLib, setCapAddLib] = useState('');
  const [installation, setInstallation] = useState('');
  const [capaciteAbsolue, setCapaciteAbsolue] = useState(0);
  const [capAddFuture, setCapAddFuture] = useState(0);
  const [capAddFutureYear, setCapAddFutureYear] = useState(2030);
  const [activePreset, setActivePreset] = useState(null);
  const [res, setRes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [charge, setCharge] = useState(false);
  const [activeTab, setActiveTab] = useState(view === 'advanced' ? 'custom' : 'presets');
  const [growthLow, setGrowthLow] = useState(1.5);
  const [growthHigh, setGrowthHigh] = useState(4.5);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [chargementParametres, setChargementParametres] = useState(false);
  const [infoParametres, setInfoParametres] = useState('');

  useEffect(() => {
    setActiveTab(view === 'advanced' ? 'custom' : 'presets');
    setRes(null);
    setErreur(null);
  }, [view]);
  
  // États pour les barres de recherche des options
  const [cibleSearch, setCibleSearch] = useState('');
  const [cibleDropdownOpen, setCibleDropdownOpen] = useState(false);
  const cibleDropdownRef = useRef(null);

  const chartRef = useRef(null);
  const chart = useRef(null);
  const baselineInitialisee = useRef(false);

  // Filtrer les CIBLES
  const filteredCibles = useMemo(() => {
    if (!cibleSearch) return CIBLES;
    return CIBLES.filter(c => 
      c.label.toLowerCase().includes(cibleSearch.toLowerCase())
    );
  }, [cibleSearch]);

  // Fermer le dropdown des cibles
  useEffect(() => {
    function handleClickOutside(event) {
      if (cibleDropdownRef.current && !cibleDropdownRef.current.contains(event.target)) {
        setCibleDropdownOpen(false);
        setCibleSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ins = useMemo(() => {
    if (!res) return null;
    const a = res.annuel, b = res.bilan, m = res.mensuel;
    let deficit = 0, capacite = 0, nDeficit = 0, nTension = 0;
    (b?.par_dr || []).forEach(d => {
      deficit += d.deficit || 0;
      capacite += d.capacite || 0;
      if (d.statut === 'deficit') nDeficit++;
      else if (d.statut === 'tension') nTension++;
    });
    let deltaPct = 0, demandeScn = 0, horizonAnnee = null;
    const params = res?.parametres || {};
    const demandeIndustrielle = Number(params.industrie_m3_an || 0);
    const rendementCible = params.rendement_distribution;
    const stressRessource = Number(params.stress_ressource_pct || 0);
    const capaciteAdditionnelle = res?.bilan?.capacite_additionnelle_m3 || 0;
    const capaciteAdditionnelleLibelle = res?.bilan?.capacite_additionnelle_libelle || '';
    if (a && a.annees && a.annees.length) {
      const i = a.annees.length - 1;
      horizonAnnee = a.annees[i];
      const base = a.baseline?.q50?.[i] || 0;
      demandeScn = a.scenario?.q50?.[i] || 0;
      deltaPct = base ? (demandeScn - base) / base * 100 : 0;
    }
    let v;
    if (m && deficit > 0) {
      v = {
        ton: 'deficit',
        titre: 'Capacité insuffisante',
        texte: `Ce scénario laisse un déficit de ${fmtM(deficit)} Mm³/mois sur ${nDeficit} zone(s). Un renforcement de la production est nécessaire avant l'échéance.`,
        action: 'Plan de renforcement prioritaire'
      };
    } else if (demandeIndustrielle > 0) {
      v = {
        ton: 'warn',
        titre: 'Nouvelle demande industrielle à intégrer',
        texte: `Le scénario ajoute ${fmtM(demandeIndustrielle)} Mm³/an dès ${params.annee_debut_industrie}. Même si la couverture reste suffisante, ce besoin doit être intégré au dimensionnement de la ressource et du réseau.`,
        action: 'Planifier la ressource avant la mise en service'
      };
    } else if (rendementCible != null && params.cible === 'production' && Math.abs(deltaPct) >= 0.1) {
      v = {
        ton: 'ok',
        titre: 'Efficacité réseau améliorée',
        texte: `Le volume annuel à mobiliser diminue de ${Math.abs(deltaPct).toFixed(1)} % grâce au rendement de distribution cible de ${rendementCible} %. La consommation des usagers n'est pas réduite par ce levier.`,
        action: 'Valider le programme de réduction des pertes'
      };
    } else if (stressRessource > 0) {
      const debut = params.annee_debut_stress || 'la première année';
      const duree = params.duree_stress_ans || 1;
      v = {
        ton: 'warn',
        titre: 'Stress hydrique testé',
        texte: `La capacité exploitable est réduite de ${stressRessource} % pendant ${duree} an(s), à partir de ${debut}. Le bilan annuel identifie directement toute année de rupture sur cette période.`,
        action: 'Préparer un plan de continuité pour la période de stress'
      };
    } else if (m && m.n_saturees_scenario < m.n_saturees_baseline) {
      v = {
        ton: 'ok',
        titre: 'Approvisionnement consolidé',
        texte: `Le renforcement de capacité fait passer les installations saturées de ${m.n_saturees_baseline} à ${m.n_saturees_scenario}. La ressource couvre la demande sur le périmètre.`,
        action: 'Poursuivre le plan actuel'
      };
    } else if (m) {
      v = {
        ton: nTension > 0 ? 'warn' : 'ok',
        titre: nTension > 0 ? 'Couverture sous tension' : 'Approvisionnement sécurisé',
        texte: nTension > 0
          ? `La demande est couverte mais ${nTension} zone(s) opèrent avec une marge inférieure à 10 %. À surveiller.`
          : `La capacité couvre la demande avec une marge confortable sur l'ensemble du périmètre.`,
        action: nTension > 0 ? 'Surveillance renforcée' : 'Maintenir le cap'
      };
    } else if (Math.abs(deltaPct) >= 1) {
      v = {
        ton: deltaPct > 0 ? 'warn' : 'ok',
        titre: deltaPct > 0 ? 'Demande en hausse — anticiper' : 'Pression en baisse',
        texte: `La demande projetée ${deltaPct > 0 ? 'augmente' : 'diminue'} de ${Math.abs(deltaPct).toFixed(1)} % d'ici ${horizonAnnee} par rapport à la référence. ${deltaPct > 0 ? 'Dimensionnez la capacité de production et le réseau en conséquence.' : 'La pression sur la ressource se relâche.'}`,
        action: deltaPct > 0 ? 'Planification des investissements' : 'Réévaluation des besoins'
      };
    } else {
      v = {
        ton: 'ok',
        titre: 'Scénario proche de la référence',
        texte: `Les paramètres choisis modifient peu la trajectoire : écart de ${deltaPct.toFixed(1)} % à l'horizon ${horizonAnnee}.`,
        action: 'Scénario validé'
      };
    }
    return {
      deficit, capacite, nDeficit, deltaPct, demandeScn,
      horizonAnnee, capaciteAdditionnelle, capaciteAdditionnelleLibelle,
      verdict: v
    };
  }, [res]);

  useScreenContext({
    cible,
    centre: centreId || null,
    scenario: activePreset || null,
    resume: res && ins ? {
      ecart_demande_pct: Math.round(ins.deltaPct * 10) / 10,
      deficit_m3: Math.round(ins.deficit),
      recommandation: ins.verdict.titre,
    } : null,
  });

  useEffect(() => {
    previsionApi.centres()
      .then(setCentres)
      .catch(e => setErreur('Backend injoignable sur le port 8000. ' + e.message));
    previsionApi.installations().then(setInstallations)
      .catch(() => setInstallations([]));
  }, []);

  const installationSelectionnee = useMemo(
    () => installations.find((item) => item.id === installation),
    [installations, installation]
  );

  async function selectionnerCentre(id) {
    setCentreId(id);
    setActivePreset(null);
    setInfoParametres('');

    if (!id) return;

    setChargementParametres(true);
    try {
      const valeurs = await previsionApi.parametresCentre(id);
      // On ne remplace un curseur que lorsqu'une moyenne historique existe.
      // L'utilisateur peut toujours modifier ces valeurs après le préremplissage.
      if (valeurs.taux_accroissement !== null) setTaux(clamp(valeurs.taux_accroissement, -5, 15));
      if (valeurs.rendement_distribution !== null) setRendDist(clamp(valeurs.rendement_distribution, 30, 95));
      if (valeurs.rendement_adduction !== null) setRendAdd(clamp(valeurs.rendement_adduction, 60, 100));
      if (valeurs.taux_branchement !== null) setBranch(clamp(valeurs.taux_branchement, 5, 100));

      setInfoParametres(
        valeurs.nb_lignes_historique
          ? `Paramètres préremplis par les moyennes historiques (${valeurs.nb_lignes_historique} année(s)).`
          : 'Aucune donnée historique disponible pour ce centre : les valeurs actuelles sont conservées.'
      );
    } catch (e) {
      setInfoParametres('Impossible de charger les moyennes du centre : les valeurs actuelles sont conservées.');
    } finally {
      setChargementParametres(false);
    }
  }

  useEffect(() => {
    return () => { 
      if (chart.current) chart.current.destroy(); 
    };
  }, []);

  const annualComparison = useMemo(() => {
    const a = res?.annuel;
    if (!a?.annees?.length) return null;

    const years = a.annees;
    const baselineData = a.baseline?.q50 || [];
    const scenarioData = a.scenario?.q50 || [];
    const q90Data = a.scenario?.q90 || [];
    const baseGrowthPct = Number(a?.hypotheses?.croissance_base_pct ?? 1.8);

    const buildCurve = (targetGrowthPct) => {
      const gBase = baseGrowthPct / 100;
      const gTarget = targetGrowthPct / 100;
      const y0 = years[0];
      return baselineData.map((baseValue, idx) => {
        const y = years[idx] ?? y0;
        const n = y - y0;
        const factor = ((1 + gTarget) / (1 + gBase)) ** n;
        return Number((baseValue * factor).toFixed(1));
      });
    };

    return {
      years,
      baselineData,
      scenarioData,
      q10Data: a.baseline?.q10 || [],
      q90Data,
      baseGrowthPct,
      lowCurve: buildCurve(growthLow),
      highCurve: buildCurve(growthHigh),
    };
  }, [res, growthLow, growthHigh, taux]);

  const annualBalance = useMemo(() => {
    if (!annualComparison) return null;

    const params = res?.parametres || {};
    const capBaselineFromMensuel = (res?.mensuel?.capacite_baseline || []).reduce((s, v) => s + (Number(v) || 0), 0);

    const capScenarioFromBilan = (res?.bilan?.par_dr || []).reduce((s, z) => s + (Number(z?.capacite) || 0), 0);
    const deltaEffectifPct = Number(res?.bilan?.delta_capacite_pct || 0);
    const deltaManuelPct = Number(params.delta_capacite_pct || 0);
    const stressPct = Number(params.stress_ressource_pct || 0);
    const maintenancePct = Number(params.maintenance_pct || 0);
    const capAdd = Number(res?.bilan?.capacite_additionnelle_m3 || 0);
    const capAddFuture = Number(res?.bilan?.capacite_additionnelle_ulterieure_m3 || 0);
    const capAddFutureYear = Number(res?.bilan?.annee_debut_capacite_ulterieure || Infinity);
    const factor = 1 + (deltaEffectifPct / 100);
    const capBaselineFromBilan = factor > 0
      ? Math.max(0, (capScenarioFromBilan - capAdd) / factor)
      : Math.max(0, capScenarioFromBilan - capAdd);

    const capBaselineAnnual = capBaselineFromMensuel > 0 ? capBaselineFromMensuel : capBaselineFromBilan;
    const years = annualComparison.years || [];
    const premiereAnnee = years[0] || Number(params.annee_mensuel) || new Date().getFullYear();
    const debutStress = Number(params.annee_debut_stress || premiereAnnee);
    const dureeStress = stressPct > 0 ? Number(params.duree_stress_ans || 1) : 0;
    const finStress = dureeStress > 0 ? debutStress + dureeStress - 1 : null;

    const rows = years.map((year, idx) => {
      const besoinScenario = Number(annualComparison.scenarioData?.[idx] || 0);
      const besoinReference = Number(annualComparison.baselineData?.[idx] || 0);
      const capaciteReference = capBaselineAnnual;
      const stressActif = finStress !== null && year >= debutStress && year <= finStress;
      const deltaAnnee = deltaManuelPct - (stressActif ? stressPct : 0) - maintenancePct;
      // En l'absence de plan de capacité par année, la capacité de référence
      // est maintenue constante. Les chocs et mises en service déclarés, eux,
      // sont positionnés dans le temps.
      const capaciteScenario = Math.max(0, capaciteReference * (1 + deltaAnnee / 100))
        + capAdd * 12
        + (year >= capAddFutureYear ? capAddFuture * 12 : 0);
      const ecartScenario = capaciteScenario - besoinScenario;
      const deficitScenario = Math.max(0, -ecartScenario);
      const tauxDeficit = besoinScenario > 0 ? (deficitScenario / besoinScenario) * 100 : 0;

      return {
        annee: year,
        besoinReference,
        besoinScenario,
        capaciteReference,
        capaciteScenario,
        ecartScenario,
        deficitScenario,
        tauxDeficit,
      };
    });

    const firstDeficit = rows.find((r) => r.deficitScenario > 0);
    const firstBaselineDeficit = rows.find((r) => r.besoinReference > r.capaciteReference);
    const firstScenarioDeficit = rows.find((r) => r.besoinScenario > r.capaciteScenario);
    const rowsSousStress = finStress === null
      ? []
      : rows.filter((row) => row.annee >= debutStress && row.annee <= finStress);
    const pointCritique = rowsSousStress.length > 0
      ? rowsSousStress.reduce((plusFaible, row) => (!plusFaible || row.ecartScenario < plusFaible.ecartScenario ? row : plusFaible), null)
      : (rows[rows.length - 1] || null);
    const shiftYears = firstBaselineDeficit && firstScenarioDeficit
      ? firstScenarioDeficit.annee - firstBaselineDeficit.annee
      : null;

    const reinforcementYearlyM3 = firstDeficit?.deficitScenario || 0;
    const reinforcementLs = yearlyM3ToLs(reinforcementYearlyM3);

    return {
      rows,
      horizonRow: rows[rows.length - 1] || null,
      capBaselineAnnual,
      capScenarioAnnual: rows[rows.length - 1]?.capaciteScenario || 0,
      firstDeficitYear: firstDeficit?.annee || null,
      reinforcementYearlyM3,
      reinforcementLs,
      firstBaselineDeficitYear: firstBaselineDeficit?.annee || null,
      shiftYears,
      pointCritique,
      debutStress: stressPct > 0 ? debutStress : null,
      finStress,
      capaciteReferenceConstante: true,
      hasCapacityVariation: stressPct > 0 || maintenancePct > 0 || deltaManuelPct !== 0 || capAdd > 0 || capAddFuture > 0,
    };
  }, [annualComparison, res]);

  const vulnerabilityMap = useMemo(() => {
    const zones = (res?.bilan?.par_dr || []).map((z) => {
      const besoin = Number(z.besoin || 0);
      const deficit = Number(z.deficit || 0);
      const vulnerabilityPct = besoin > 0 ? (deficit / besoin) * 100 : 0;
      return {
        ...z,
        vulnerabilityPct,
      };
    });

    return zones.sort((a, b) => {
      const rank = { deficit: 0, tension: 1, ok: 2 };
      const d = (rank[a.statut] ?? 9) - (rank[b.statut] ?? 9);
      if (d !== 0) return d;
      return (b.vulnerabilityPct || 0) - (a.vulnerabilityPct || 0);
    });
  }, [res]);

  async function lancer(forced) {
    setCharge(true);
    setErreur(null);
    const body = forced || {
      cible, centre_id: centreId || null,
      taux_accroissement: taux, rendement_distribution: rendDist,
      rendement_adduction: rendAdd, taux_branchement: branch,
      annee_horizon: horizon, annee_mensuel: 2024,
      installation: installation || null,
      delta_capacite_pct: deltaCap || null,
      capacite_absolue: installation && capaciteAbsolue > 0 ? capaciteAbsolue : null,
      capacite_additionnelle_m3: capAdd || null,
      capacite_additionnelle_libelle: capAddLib || null,
      capacite_additionnelle_ulterieure_m3: capAddFuture || null,
      annee_debut_capacite_ulterieure: capAddFuture > 0 ? capAddFutureYear : null,
    };
    try {
      const result = await previsionApi.scenario(body);
      if (!result.annuel && Array.isArray(body.centre_ids) && body.centre_ids.length > 0) {
        setErreur("Les centres sélectionnés ne disposent pas encore d'historique ni de prévisions dans les données livrées. Aucun regroupement national n'a été utilisé.");
        setRes(null);
        return;
      }
      setRes(result);
    } catch (e) {
      setErreur(e.message);
      setRes(null);
    }
    setCharge(false);
  }

  // Le blueprint impose une page utile dès son ouverture : la référence est
  // donc calculée automatiquement, sans attendre le clic sur un modèle.
  useEffect(() => {
    if (view !== 'prepared' || baselineInitialisee.current) return;
    baselineInitialisee.current = true;
    lancer({
      cible: 'consommation_totale', centre_id: null, centre_ids: [],
      taux_accroissement: null, rendement_distribution: null,
      rendement_adduction: null, taux_branchement: null,
      annee_horizon: 2035, annee_mensuel: 2024,
      delta_capacite_pct: null, capacite_additionnelle_m3: null,
      capacite_additionnelle_libelle: null,
    });
  }, [view]);

  function appliquerPreset(p) {
    const x = p.params;
    setCible(x.cible || 'consommation_totale');
    setTaux(x.taux_accroissement ?? 1.8);
    setRendDist(x.rendement_distribution ?? 75);
    setRendAdd(x.rendement_adduction ?? 85);
    setBranch(x.taux_branchement ?? 88);
    setHorizon(x.annee_horizon ?? 2054);
    setDeltaCap(x.delta_capacite_pct ?? 0);
    setCapAdd(x.capacite_additionnelle_m3 ?? 0);
    setCapAddLib(x.capacite_additionnelle_libelle ?? '');
    setCapAddFuture(x.capacite_additionnelle_ulterieure_m3 ?? 0);
    setCapAddFutureYear(x.annee_debut_capacite_ulterieure ?? 2030);
    setCentreId('');
    setActivePreset(p.id);
    lancer({
      cible: x.cible || 'consommation_totale', centre_id: null,
      taux_accroissement: x.taux_accroissement ?? null,
      rendement_distribution: x.rendement_distribution ?? null,
      rendement_adduction: x.rendement_adduction ?? null,
      taux_branchement: x.taux_branchement ?? null,
      annee_horizon: x.annee_horizon ?? 2054,
      annee_mensuel: x.annee_mensuel ?? 2024,
      delta_capacite_pct: x.delta_capacite_pct ?? null,
      capacite_additionnelle_m3: x.capacite_additionnelle_m3 ?? null,
      capacite_additionnelle_libelle: x.capacite_additionnelle_libelle ?? null,
      capacite_additionnelle_ulterieure_m3: x.capacite_additionnelle_ulterieure_m3 ?? null,
      annee_debut_capacite_ulterieure: x.annee_debut_capacite_ulterieure ?? null,
      centre_ids: x.centre_ids ?? [],
      dotation_pct: x.dotation_pct ?? null,
      tourisme_pct: x.tourisme_pct ?? null,
      industrie_m3_an: x.industrie_m3_an ?? null,
      annee_debut_industrie: x.annee_debut_industrie ?? null,
      stress_ressource_pct: x.stress_ressource_pct ?? null,
      annee_debut_stress: x.annee_debut_stress ?? null,
      duree_stress_ans: x.duree_stress_ans ?? null,
      maintenance_pct: x.maintenance_pct ?? null,
    });
  }

  function simulerZonePilote(zone) {
    const centreIdsDisponibles = new Set(centres.map((centre) => centre.id));
    const centresIndisponibles = zone.centres.filter(
      (centre) => centres.length > 0 && !centreIdsDisponibles.has(centre.id),
    );

    if (centresIndisponibles.length > 0) {
      setRes(null);
      setErreur(
        `Le pilote « ${zone.title} » ne peut pas encore être simulé : ${centresIndisponibles
          .map((centre) => `${centre.name} (${centre.id})`)
          .join(', ')} ne figure pas dans les données de prévision livrées.`,
      );
      return;
    }

    const preset = PRESETS.find((p) => p.id === zone.presetId);
    if (!preset) return;

    appliquerPreset({
      ...preset,
      id: zone.id,
      params: {
        ...preset.params,
        ...(zone.paramsOverride || {}),
        centre_ids: zone.centres.map((centre) => centre.id),
      },
    });
  }

  useEffect(() => {
    if (!annualComparison || !chartRef.current) return;
    if (chart.current) chart.current.destroy();
    
    const {
      years,
      baselineData,
      scenarioData,
      q10Data,
      q90Data,
      lowCurve,
      highCurve,
    } = annualComparison;
    const capBaselineLine = years.map(() => annualBalance?.capBaselineAnnual || 0);
    const capScenarioLine = annualBalance?.rows?.map((row) => row.capaciteScenario)
      || years.map(() => 0);
    const intersectionIdx = annualBalance?.firstDeficitYear
      ? years.findIndex((y) => y === annualBalance.firstDeficitYear)
      : -1;
    const intersectionData = years.map((_, idx) => (idx === intersectionIdx ? scenarioData[idx] : null));
    
    chart.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Borne basse de l’incertitude',
            data: q10Data,
            borderColor: 'transparent',
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Référence',
            data: baselineData,
            borderColor: '#3b82f6',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Intervalle 80 %',
            data: q90Data,
            borderColor: 'transparent',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            pointRadius: 0,
            fill: '-1'
          },
          {
            label: 'Scénario simulé',
            data: scenarioData,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [6, 3],
            tension: 0.3,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Capacité annuelle de référence',
            data: capBaselineLine,
            borderColor: '#0ea5e9',
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
            hidden: true
          },
          {
            label: annualBalance?.hasCapacityVariation
              ? 'Capacité exploitable simulée'
              : 'Capacité de référence 2024 (hypothèse constante)',
            data: capScenarioLine,
            borderColor: '#16a34a',
            borderWidth: 2,
            borderDash: [9, 4],
            pointRadius: 0,
            fill: false
          },
          {
            label: annualBalance?.firstDeficitYear
              ? `Alerte basculement (${annualBalance.firstDeficitYear})`
              : 'Pas de basculement détecté',
            data: intersectionData,
            borderColor: '#dc2626',
            backgroundColor: '#dc2626',
            pointRadius: 5,
            pointHoverRadius: 6,
            showLine: false,
          },
          {
            label: `Hypothèse basse (${growthLow.toFixed(1)} %/an)`,
            data: lowCurve,
            borderColor: '#14b8a6',
            borderWidth: 2,
            borderDash: [3, 4],
            tension: 0.3,
            pointRadius: 0,
            fill: false,
            hidden: true
          },
          {
            label: `Hypothèse haute (${growthHigh.toFixed(1)} %/an)`,
            data: highCurve,
            borderColor: '#8b5cf6',
            borderWidth: 2,
            borderDash: [2, 5],
            tension: 0.3,
            pointRadius: 0,
            fill: false,
            hidden: true
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              filter: (item) => ![0, 4, 7, 8].includes(item.datasetIndex)
                && (item.datasetIndex !== 6 || Boolean(annualBalance?.firstDeficitYear)),
              boxWidth: 10,
              font: { size: 11, weight: '500' },
              color: '#4b5563'
            },
          },
          tooltip: {
            callbacks: { 
              label: (ctx) => {
                const value = ctx.parsed.y;
                return `${ctx.dataset.label}: ${value ? fmtM(value) : '0'} Mm³`;
              }
            }
          }
        },
        scales: {
          y: {
            grid: { color: '#e5e7eb' },
            ticks: { callback: v => `${fmtM(v)} Mm³`, font: { size: 10 }, color: '#6b7280' },
            title: { display: true, text: 'Volume (Millions m³)', font: { size: 10, weight: '500' }, color: '#6b7280' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: '#6b7280' }
          }
        }
      },
    });
  }, [annualComparison, annualBalance, growthLow, growthHigh]);

  const getStatusColor = (ton) => {
    switch (ton) {
      case 'deficit': return '#dc2626';
      case 'warn': return '#f59e0b';
      case 'ok': return '#10b981';
      default: return '#6b7280';
    }
  };

  // La référence correspond au scénario sans levier. Pour chaque carte, on
  // expose uniquement les hypothèses effectivement transmises au moteur.
  const activeScenario = BLUEPRINT_PRESETS.find((preset) => preset.id === activePreset);
  const parametresAppliques = res?.parametres || {};
  const hypotheseTrace = [
    Number(parametresAppliques.stress_ressource_pct || 0) > 0
      ? `Ressource exploitable −${parametresAppliques.stress_ressource_pct} % (${parametresAppliques.annee_debut_stress || 2024}–${(parametresAppliques.annee_debut_stress || 2024) + (parametresAppliques.duree_stress_ans || 1) - 1})`
      : null,
    Number(parametresAppliques.maintenance_pct || 0) > 0
      ? `Indisponibilité maintenance −${parametresAppliques.maintenance_pct} %`
      : null,
    Number(parametresAppliques.stress_ressource_pct || 0) === 0
      && Number(parametresAppliques.maintenance_pct || 0) === 0
      && Number(parametresAppliques.delta_capacite_pct || 0) !== 0
      ? `Capacité ${Number(parametresAppliques.delta_capacite_pct) > 0 ? '+' : ''}${parametresAppliques.delta_capacite_pct} %`
      : null,
    Number(parametresAppliques.tourisme_pct || 0) > 0
      ? `Demande touristique +${parametresAppliques.tourisme_pct} %`
      : null,
    Number(parametresAppliques.industrie_m3_an || 0) > 0
      ? `Demande industrielle +${fmtM(parametresAppliques.industrie_m3_an)} Mm³/an dès ${parametresAppliques.annee_debut_industrie}`
      : null,
    parametresAppliques.rendement_distribution != null
      ? `Rendement de distribution cible ${parametresAppliques.rendement_distribution} %`
      : null,
    Number(parametresAppliques.capacite_additionnelle_m3 || 0) > 0
      ? `Capacité additionnelle +${fmtM(Number(parametresAppliques.capacite_additionnelle_m3) * 12)} Mm³/an`
      : null,
  ].filter(Boolean);

  return (
    <div className="scenarios-page">
      <div className="scenarios-header">
        <div>
          <h1 className="scenarios-title">Cockpit de décision besoins–ressources</h1>
          <p className="scenarios-subtitle">
            Comparez le besoin à la ressource exploitable, identifiez le point de bascule et testez les leviers d’action.
          </p>
        </div>
        <div className="header-badge">
          <Rocket size={16} />
          <span>Simulation documentée</span>
        </div>
      </div>

      {view === 'all' && <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          <Target size={16} />
          Scénarios préparés
        </button>
        <button
          className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          <Settings size={16} />
          Paramètres avancés
        </button>
      </div>}

      {view !== 'advanced' && activeTab === 'presets' && (
        <div className="presets-section">
          <div className="presets-grid">
            {BLUEPRINT_PRESETS.map(p => (
              <div
                key={p.id}
                className={`preset-card ${activePreset === p.id ? 'active' : ''}`}
                onClick={() => appliquerPreset(p)}
                style={{ '--preset-color': p.color }}
              >
                <div className="preset-header" style={{ background: `${p.color}10` }}>
                  <div className="preset-icon" style={{ color: p.color }}>
                    <p.icon size={24} />
                  </div>
                  <span className="preset-category" style={{ background: `${p.color}15`, color: p.color }}>
                    {p.categorie}
                  </span>
                </div>
                <div className="preset-body">
                  <h3 className="preset-title">{p.titre}</h3>
                  <p className="preset-contexte">{p.contexte}</p>
                  <div className="preset-leviers">
                    {p.leviers.map(l => (
                      <span key={l} className="levier-tag">{l}</span>
                    ))}
                  </div>
                  <div className="preset-decision">
                    <span className="decision-label">Décision éclairée</span>
                    <span className="decision-text">{p.decision}</span>
                  </div>
                </div>
                <div className="preset-footer" style={{ color: p.color }}>
                  Simuler ce scénario →
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {false && view !== 'advanced' && activeTab === 'presets' && (
        <div className="pilot-zones-section">
          <div className="section-header">
            <div>
              <div className="section-title">Zones pilotes</div>
              <div className="section-subtitle">Taroudant, Agadir et Larache — focus sur les centres et projets clés.</div>
              <div className="section-note">NB: les listes de centres ci-dessous ne sont pas exhaustives.</div>
            </div>
          </div>
          <div className="pilot-zone-grid">
            {PILOT_ZONES.map((zone) => {
              const centreIdsDisponibles = new Set(centres.map((centre) => centre.id));
              const donneesChargees = centres.length > 0;
              const indisponible = donneesChargees && zone.centres.some(
                (centre) => !centreIdsDisponibles.has(centre.id),
              );

              return (
              <div key={zone.id} className={`pilot-zone-card${indisponible ? ' pilot-zone-card-unavailable' : ''}`}>
                <div className="pilot-zone-header">
                  <div>
                    <div className="pilot-zone-title">{zone.title}</div>
                    <div className="pilot-zone-subtitle">{zone.subtitle}</div>
                  </div>
                  <span className={`pilot-zone-badge${indisponible ? ' pilot-zone-badge-unavailable' : ' pilot-zone-badge-ready'}`}>
                    {indisponible ? 'Données à intégrer' : 'Simulable'}
                  </span>
                </div>
                <div className="pilot-zone-note">{zone.note}</div>
                {zone.nonExhaustive && (
                  <div className="pilot-zone-non-exhaustive">Liste indicative, non exhaustive</div>
                )}
                <div className="pilot-inputs" aria-label={`Paramètres du scénario ${zone.title}`}>
                  <div className="pilot-inputs-title">Paramètres du scénario</div>
                  {zone.inputs.map(([label, value]) => (
                    <div key={label} className="pilot-input-row">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                {zone.centres.length > 0 ? (
                  <ul className="pilot-centers-list">
                    {zone.centres.map((centre) => (
                      <li key={centre.id}>
                        <span className="pilot-center-id">{centre.id}</span>
                        <span className="pilot-center-name">{centre.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="pilot-zone-empty">Aucune liste de centres détaillée disponible pour cette zone.</div>
                )}
                {indisponible && <div className="pilot-zone-data-note">{zone.dataNote || 'Les données nécessaires doivent être intégrées avant simulation.'}</div>}
                <button
                  className="pilot-zone-action"
                  title={indisponible ? 'Simulation indisponible tant que les données ne sont pas intégrées.' : 'Simuler ce pilote'}
                  disabled={indisponible}
                  onClick={() => simulerZonePilote(zone)}
                >
                  {indisponible ? 'Simulation indisponible' : 'Simuler ce pilote'}
                </button>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {view !== 'prepared' && activeTab === 'custom' && (
        <div className="custom-section">
          <div className="params-grid">
            <div className="params-card">
              <div className="params-card-header">
                <div className="params-icon"><TrendingUp size={18} /></div>
                <div>
                  <div className="params-title">Demande en eau</div>
                  <div className="params-sub">Horizon n+30</div>
                </div>
              </div>
              <div className="params-body">
                <div className="param-field">
                  <label className="param-label">INDICATEUR</label>
                  <div className="search-select-container" ref={cibleDropdownRef}>
                    <div 
                      className="search-select-trigger"
                      onClick={() => setCibleDropdownOpen(!cibleDropdownOpen)}
                    >
                      <span className="selected-value">
                        {CIBLES.find(c => c.id === cible)?.label || 'Sélectionner'}
                      </span>
                      <ChevronDown size={16} className={`dropdown-chevron ${cibleDropdownOpen ? 'open' : ''}`} />
                    </div>
                    
                    {cibleDropdownOpen && (
                      <div className="search-dropdown">
                        <div className="search-input-wrapper">
                          <Search size={14} className="search-icon" />
                          <input
                            type="text"
                            className="search-input"
                            placeholder="Rechercher un indicateur..."
                            value={cibleSearch}
                            onChange={e => setCibleSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                        <div className="dropdown-options">
                          {filteredCibles.map(c => (
                            <div 
                              key={c.id}
                              className={`dropdown-option ${cible === c.id ? 'selected' : ''}`}
                              onClick={() => {
                                setCible(c.id);
                                setCibleDropdownOpen(false);
                                setCibleSearch('');
                              }}
                            >
                              <div className="option-with-icon">
                                <c.icon size={14} />
                                <span>{c.label}</span>
                              </div>
                            </div>
                          ))}
                          {filteredCibles.length === 0 && (
                            <div className="dropdown-empty">Aucun indicateur trouvé</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="param-field">
                  <label className="param-label">PÉRIMÈTRE</label>
                  <SelectWithSearch 
                    options={centres}
                    value={centreId}
                    onChange={selectionnerCentre}
                    placeholder="Rechercher un centre..."
                    labelKey="label"
                    valueKey="id"
                    allOptionLabel="Tous les centres"
                  />
                  {chargementParametres && <div className="params-sub">Chargement des moyennes historiques…</div>}
                  {!chargementParametres && infoParametres && <div className="params-sub">{infoParametres}</div>}
                </div>
                
                <Slider label="Taux d'accroissement" min={-5} max={15} step={0.1} value={taux} set={setTaux} suffix=" %/an" icon={TrendingUp} />
                <Slider label="Rendement distribution" min={30} max={95} step={1} value={rendDist} set={setRendDist} suffix=" %" icon={Factory} />
                <Slider label="Rendement adduction" min={60} max={100} step={1} value={rendAdd} set={setRendAdd} suffix=" %" icon={Factory} />
                <Slider label="Taux de branchement" min={5} max={100} step={1} value={branch} set={setBranch} suffix=" %" icon={Users} />
                <Slider label="Horizon" min={2026} max={2056} step={1} value={horizon} set={setHorizon} suffix="" icon={Calendar} />
              </div>
            </div>

            <div className="params-card">
              <div className="params-card-header">
                <div className="params-icon"><Droplets size={18} /></div>
                <div>
                  <div className="params-title">Ressources en eau</div>
                  <div className="params-sub">Horizon m+12</div>
                </div>
              </div>
              <div className="params-body">
                <Slider label="Δ capacité de production" min={-100} max={0} step={5} value={deltaCap} set={setDeltaCap} suffix=" %" icon={Zap} />

                <div className="param-field">
                  <label className="param-label">INSTALLATION À SIMULER</label>
                  <SelectWithSearch
                    options={installations}
                    value={installation}
                    onChange={(id) => { setInstallation(id); setCapaciteAbsolue(0); }}
                    placeholder="Rechercher une installation..."
                    labelKey="label"
                    valueKey="id"
                    allOptionLabel="Toutes les installations"
                  />
                </div>

                {installationSelectionnee && (
                  <div className="param-field">
                    <label className="param-label">CAPACITÉ IMPOSÉE (m³/mois)</label>
                    <input
                      type="number"
                      className="param-input"
                      min="0"
                      max={installationSelectionnee.capacite_max_m3}
                      placeholder={`Maximum disponible : ${Math.round(installationSelectionnee.capacite_max_m3).toLocaleString('fr-FR')}`}
                      value={capaciteAbsolue || ''}
                      onChange={e => setCapaciteAbsolue(Math.min(installationSelectionnee.capacite_max_m3, Math.max(0, +e.target.value || 0)))}
                    />
                    <div className="params-sub">Bornée par la capacité disponible de l’installation.</div>
                  </div>
                )}
                
                <div className="param-field">
                  <label className="param-label">RESSOURCE ADDITIONNELLE</label>
                  <input
                    type="number"
                    className="param-input"
                    placeholder="m³/mois"
                    value={capAdd || ''}
                    onChange={e => setCapAdd(Math.max(0, +e.target.value || 0))}
                  />
                </div>

                <div className="param-field">
                  <label className="param-label">CAPACITÉ FUTURE (m³/mois)</label>
                  <input type="number" className="param-input" min="0" value={capAddFuture || ''}
                    onChange={e => setCapAddFuture(Math.max(0, +e.target.value || 0))} />
                </div>
                <div className="param-field">
                  <label className="param-label">MISE EN SERVICE</label>
                  <input type="number" className="param-input" min="2024" max="2060" value={capAddFutureYear}
                    onChange={e => setCapAddFutureYear(Math.min(2060, Math.max(2024, +e.target.value || 2024)))} />
                </div>
                
                <div className="param-field">
                  <label className="param-label">LIBELLÉ DE LA RESSOURCE</label>
                  <input
                    type="text"
                    className="param-input"
                    placeholder="ex : Dessalement Agadir"
                    value={capAddLib}
                    onChange={e => setCapAddLib(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            className="simulate-btn"
            onClick={() => { setActivePreset(null); lancer(); }}
            disabled={charge}
          >
            {charge ? (
              <>
                <div className="spinner"></div>
                Simulation en cours...
              </>
            ) : (
              <>
                <Rocket size={18} />
                Lancer la simulation
              </>
            )}
          </button>
        </div>
      )}

      {erreur && (
        <div className="error-card">
          <AlertTriangle size={18} />
          <span>{erreur}</span>
        </div>
      )}

      {!res && !erreur && view !== 'prepared' && activeTab === 'custom' && (
        <div className="empty-state">
          <BarChart3 size={48} />
          <div className="empty-title">Aucune simulation</div>
          <div className="empty-text">Configurez les paramètres ci-dessus et lancez la simulation</div>
        </div>
      )}

      {res && ins && (
        <div className="results-section">
          <section className="decision-summary" aria-label="Résumé de décision">
            <div className="decision-summary-head">
              <div>
                <div className="eyebrow">RÉSULTAT DU SCÉNARIO</div>
                <h2>{activeScenario ? activeScenario.titre : 'Référence du modèle'} · horizon {ins.horizonAnnee || 'sélectionné'}</h2>
                <p>Les traits pleins représentent la référence du modèle ; le trait orange traduit l’hypothèse simulée.</p>
              </div>
              <div className={`decision-status ${ins.deficit > 0 ? 'risk' : (Number(parametresAppliques.stress_ressource_pct || 0) > 0 ? 'warn' : 'safe')}`}>
                {ins.deficit > 0
                  ? 'Renforcement nécessaire'
                  : Number(parametresAppliques.stress_ressource_pct || 0) > 0
                    ? 'Capacité suffisante sous stress'
                    : 'Capacité suffisante'}
              </div>
            </div>
            <div className="scenario-trace">
              <span className="scenario-trace-label">Hypothèses appliquées</span>
              {hypotheseTrace.length > 0 ? hypotheseTrace.map((hypothese) => (
                <span className="scenario-trace-tag" key={hypothese}>{hypothese}</span>
              )) : (
                <span className="scenario-trace-tag neutral">Aucun levier — situation de référence</span>
              )}
            </div>
            <div className="decision-kpis">
              <div className="decision-kpi">
                <span>{parametresAppliques.cible === 'production' && parametresAppliques.rendement_distribution != null ? 'Volume à mobiliser' : 'Besoin à l’horizon'}</span>
                <strong>{fmtM(ins.demandeScn || 0)} <small>Mm³/an</small></strong>
              </div>
              <div className="decision-kpi">
                <span>Capacité simulée à l’horizon</span>
                <strong>{fmtM(annualBalance?.capScenarioAnnual || 0)} <small>Mm³/an</small></strong>
              </div>
              <div className={`decision-kpi ${(annualBalance?.pointCritique?.ecartScenario || 0) < 0 ? 'risk' : 'safe'}`}>
                <span>{annualBalance?.debutStress ? `Marge minimale (${annualBalance.debutStress}–${annualBalance.finStress})` : 'Écart à l’horizon'}</span>
                <strong>{(annualBalance?.pointCritique?.ecartScenario || 0) < 0 ? 'Déficit ' : 'Marge '}{fmtM(Math.abs(annualBalance?.pointCritique?.ecartScenario || 0))} <small>Mm³/an</small></strong>
              </div>
              <div className={`decision-kpi ${annualBalance?.firstDeficitYear ? 'risk' : 'safe'}`}>
                <span>Année de rupture</span>
                <strong>{annualBalance?.firstDeficitYear || 'Aucune'} </strong>
              </div>
            </div>
          </section>

          {ins.verdict && (
            <div className="recommendation-card" style={{ borderLeftColor: getStatusColor(ins.verdict.ton) }}>
              <div className="recommendation-header">
                <span className="recommendation-badge" style={{ background: getStatusColor(ins.verdict.ton) }}>
                  RECOMMANDATION
                </span>
                <div className="recommendation-title" style={{ color: getStatusColor(ins.verdict.ton) }}>
                  {ins.verdict.titre}
                </div>
              </div>
              <p className="recommendation-text">{ins.verdict.texte}</p>
              <div className="recommendation-action">
                <strong>Action recommandée :</strong> {ins.verdict.action}
              </div>
              <div className="recommendation-note">
                Référence issue du modèle ONEE-Predict. Les leviers et leurs effets sont explicitement tracés ci-dessus ; ils doivent être validés par les équipes métier.
              </div>
            </div>
          )}

          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">Courbes croisées demande vs capacité</div>
              <div className="chart-subtitle">{res.annuel?.perimetre || 'Tous les centres'} · volume annuel jusqu'à l'horizon · capacité 2024 maintenue constante hors choc ou mise en service déclarés</div>
            </div>
            <div className="decision-legend">
              <span><i className="legend-line reference" /> Référence du modèle</span>
              <span><i className="legend-line scenario" /> Hypothèse de scénario</span>
              <span><i className="legend-line capacity" /> Capacité exploitable simulée</span>
              <span><i className="legend-band" /> Zone d'incertitude</span>
            </div>
            <div className="chart-container">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>

          <button
            type="button"
            className="technical-toggle"
            onClick={() => setShowTechnicalDetails((open) => !open)}
            aria-expanded={showTechnicalDetails}
          >
            {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showTechnicalDetails ? 'Masquer les détails techniques' : 'Voir les détails techniques'}
          </button>

          {showTechnicalDetails && annualBalance && (
            <div className="alerts-grid">
              <div className={`alert-card ${annualBalance.firstDeficitYear ? 'critical' : 'safe'}`}>
                <div className="alert-title">Alerte basculement en déficit</div>
                <div className="alert-value">
                  {annualBalance.firstDeficitYear ? `${annualBalance.firstDeficitYear}` : 'Aucun basculement sur l\'horizon'}
                </div>
                <div className="alert-subtext">
                  {annualBalance.firstDeficitYear
                    ? 'Première année où la demande dépasse la capacité simulée.'
                    : 'La capacité simulée reste au-dessus de la demande sur la période.'}
                </div>
              </div>

              <div className={`alert-card ${annualBalance.reinforcementYearlyM3 > 0 ? 'warn' : 'safe'}`}>
                <div className="alert-title">Débit de renforcement estimé</div>
                <div className="alert-value">
                  {annualBalance.reinforcementYearlyM3 > 0
                    ? `${annualBalance.reinforcementLs.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} l/s`
                    : '0 l/s'}
                </div>
                <div className="alert-subtext">
                  {annualBalance.reinforcementYearlyM3 > 0
                    ? `${fmtM(annualBalance.reinforcementYearlyM3)} Mm³/an à mobiliser au minimum l'année de basculement.`
                    : 'Aucun renforcement immédiat requis selon les hypothèses actuelles.'}
                </div>
              </div>

              <div className="alert-card info">
                <div className="alert-title">Comparaison simultanée des scénarios</div>
                <div className="alert-value">
                  {annualBalance.shiftYears === null
                    ? 'Décalage non calculable'
                    : `${annualBalance.shiftYears > 0 ? '+' : ''}${annualBalance.shiftYears} an(s)`}
                </div>
                <div className="alert-subtext">
                  Décalage du point de rupture entre référence et scénario courant (investissement / économie d'eau).
                </div>
              </div>
            </div>
          )}

          {showTechnicalDetails && annualBalance?.rows?.length > 0 && (
            <div className="table-card" style={{ marginBottom: '20px' }}>
              <div className="table-header">
                <div className="table-title">Bilan annuel détaillé (Besoins / Capacités / Écarts)</div>
                <div className="table-subtitle">Données réelles projetées par le modèle et scénario actif</div>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Année</th>
                      <th>Besoin scénario</th>
                      <th>Capacité scénario</th>
                      <th>Écart (cap - besoin)</th>
                      <th>Taux déficit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualBalance.rows.map((r) => (
                      <tr key={r.annee}>
                        <td className="zone-name">{r.annee}</td>
                        <td>{fmtM(r.besoinScenario || 0)} Mm³</td>
                        <td>{fmtM(r.capaciteScenario || 0)} Mm³</td>
                        <td className={(r.ecartScenario || 0) < 0 ? 'deficit-value' : ''}>
                          {(r.ecartScenario || 0) < 0
                            ? `-${fmtM(Math.abs(r.ecartScenario))} Mm³`
                            : `+${fmtM(r.ecartScenario || 0)} Mm³`}
                        </td>
                        <td className={(r.tauxDeficit || 0) > 0 ? 'deficit-value' : ''}>
                          {(r.tauxDeficit || 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showTechnicalDetails && res.bilan?.par_dr && res.bilan.par_dr.length > 0 && (
            <div className="table-card">
              <div className="table-header">
                <div className="table-title">Bilan besoins / capacité par zone</div>
                <div className="table-subtitle">{res.bilan?.source || 'Données simulées'}</div>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Besoin</th>
                      <th>Capacité</th>
                      <th>Déficit</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(res.bilan.par_dr || []).map(d => (
                      <tr key={d.dr}>
                        <td className="zone-name">{d.dr}</td>
                        <td>{fmtM(d.besoin || 0)} Mm³</td>
                        <td>{fmtM(d.capacite || 0)} Mm³</td>
                        <td className={(d.deficit || 0) > 0 ? 'deficit-value' : ''}>
                          {(d.deficit || 0) > 0 ? `${fmtM(d.deficit)} Mm³` : '—'}
                        </td>
                        <td>
                          <span className={`status-badge ${d.statut || 'ok'}`}>
                            {d.statut === 'deficit' ? '⚠️ Déficit' : d.statut === 'tension' ? '📊 Tension' : '✅ OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showTechnicalDetails && vulnerabilityMap.length > 0 && (
            <div className="vulnerability-card">
              <div className="table-header">
                <div className="table-title">Carte de vulnérabilité (horizon simulé)</div>
                <div className="table-subtitle">Coloration des zones selon l'état du bilan</div>
              </div>
              <div className="vulnerability-grid">
                {vulnerabilityMap.map((zone) => (
                  <div key={zone.dr} className={`vuln-item ${zone.statut || 'ok'}`}>
                    <div className="vuln-head">
                      <div className="vuln-zone">{zone.dr}</div>
                      <div className="vuln-status">{zone.statut === 'deficit' ? 'Déficit' : zone.statut === 'tension' ? 'Tension' : 'OK'}</div>
                    </div>
                    <div className="vuln-metrics">
                      <span>Besoin: {fmtM(zone.besoin || 0)} Mm³</span>
                      <span>Capacité: {fmtM(zone.capacite || 0)} Mm³</span>
                    </div>
                    <div className="vuln-bar">
                      <div
                        className="vuln-fill"
                        style={{ width: `${Math.min(100, Math.max(0, zone.vulnerabilityPct || 0))}%` }}
                      />
                    </div>
                    <div className="vuln-foot">
                      Vulnérabilité: {(zone.vulnerabilityPct || 0).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .scenarios-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
        }

        .scenarios-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .scenarios-title {
          font-size: 1.75rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        .scenarios-subtitle {
          font-size: 0.9rem;
          color: #64748b;
          margin: 0;
        }

        .header-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #eef2ff;
          border-radius: 40px;
          font-size: 0.8rem;
          font-weight: 500;
          color: #3b82f6;
        }

        .tabs-container {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 12px;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          color: #1e293b;
          background: #f1f5f9;
        }

        .tab-btn.active {
          color: #3b82f6;
          background: #eef2ff;
        }

        .presets-section {
          margin-bottom: 32px;
        }

        .presets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .preset-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .preset-card:hover {
          transform: translateY(-2px);
          border-color: var(--preset-color);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .preset-card.active {
          border-color: var(--preset-color);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        .preset-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .preset-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preset-category {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .preset-body {
          padding: 16px;
        }

        .preset-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 8px 0;
        }

        .preset-contexte {
          font-size: 0.8rem;
          color: #64748b;
          line-height: 1.5;
          margin: 0 0 12px 0;
        }

        .preset-leviers {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }

        .levier-tag {
          padding: 3px 8px;
          background: #f1f5f9;
          border-radius: 12px;
          font-size: 0.7rem;
          color: #475569;
        }

        .preset-decision {
          padding: 10px;
          background: #f8fafc;
          border-radius: 8px;
          margin-top: 8px;
        }

        .decision-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 4px;
        }

        .decision-text {
          font-size: 0.75rem;
          color: #64748b;
          font-style: italic;
        }

        .preset-footer {
          padding: 12px 16px;
          border-top: 1px solid #f1f5f9;
          font-size: 0.8rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .preset-card:hover .preset-footer {
          padding-left: 20px;
        }

        .custom-section {
          margin-bottom: 32px;
        }

        .params-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
          gap: 24px;
          margin-bottom: 24px;
        }

        .params-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .params-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .params-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: #eef2ff;
          border-radius: 10px;
          color: #3b82f6;
        }

        .params-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e293b;
        }

        .params-sub {
          font-size: 0.7rem;
          color: #64748b;
        }

        .params-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .param-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .param-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .param-options {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .option-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
        }

        .option-btn:hover {
          border-color: #3b82f6;
          color: #1e293b;
        }

        .option-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .param-select, .param-input {
          padding: 10px 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #1e293b;
          font-size: 0.85rem;
          outline: none;
          transition: all 0.2s;
        }

        .param-select:focus, .param-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        /* Styles pour les select avec recherche */
        .search-select-container {
          position: relative;
        }

        .search-select-trigger {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 42px;
        }

        .search-select-trigger:hover {
          border-color: #3b82f6;
        }

        .selected-value {
          color: #1e293b;
          font-size: 0.85rem;
        }

        .dropdown-chevron {
          color: #94a3b8;
          transition: transform 0.2s;
        }

        .dropdown-chevron.open {
          transform: rotate(180deg);
        }

        .search-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          overflow: hidden;
        }

        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .search-icon {
          color: #94a3b8;
        }

        .search-input {
          flex: 1;
          padding: 8px 0;
          border: none;
          outline: none;
          font-size: 0.85rem;
          background: transparent;
        }

        .dropdown-options {
          max-height: 250px;
          overflow-y: auto;
        }

        .dropdown-option {
          padding: 10px 12px;
          cursor: pointer;
          transition: background 0.2s;
          font-size: 0.85rem;
          color: #475569;
        }

        .dropdown-option:hover {
          background: #f1f5f9;
        }

        .dropdown-option.selected {
          background: #eef2ff;
          color: #3b82f6;
          font-weight: 500;
        }

        .option-with-icon {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dropdown-empty {
          padding: 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 0.8rem;
        }

        .slider-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .slider-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: #475569;
        }

        .slider-icon {
          color: #94a3b8;
        }

        .slider-value {
          font-size: 0.85rem;
          font-weight: 600;
          color: #3b82f6;
        }

        .slider-track {
          position: relative;
        }

        .slider-input {
          width: 100%;
          height: 4px;
          -webkit-appearance: none;
          background: linear-gradient(to right, #3b82f6 0%, #3b82f6 var(--percent), #e2e8f0 var(--percent), #e2e8f0 100%);
          border-radius: 4px;
          outline: none;
        }

        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .slider-range {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 0.65rem;
          color: #94a3b8;
        }

        .simulate-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 28px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .simulate-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .simulate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 12px;
          color: #dc2626;
          margin-bottom: 24px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          background: #ffffff;
          border-radius: 16px;
          text-align: center;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
        }

        .empty-title {
          font-size: 1.1rem;
          font-weight: 500;
          color: #64748b;
          margin-top: 16px;
        }

        .empty-text {
          font-size: 0.85rem;
          margin-top: 8px;
        }

        .results-section {
          margin-top: 32px;
        }

        .decision-summary {
          background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
          border: 1px solid #dbeafe;
          border-radius: 16px;
          padding: 22px;
          margin-bottom: 20px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
        }

        .decision-summary-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .eyebrow { font-size: 0.68rem; font-weight: 700; letter-spacing: .08em; color: #2563eb; }
        .decision-summary h2 { margin: 5px 0; color: #0f172a; font-size: 1.25rem; }
        .decision-summary p { margin: 0; color: #64748b; font-size: .82rem; }
        .decision-status { white-space: nowrap; padding: 7px 10px; border-radius: 999px; font-size: .75rem; font-weight: 700; }
        .decision-status.safe { color: #047857; background: #d1fae5; }
        .decision-status.warn { color: #b45309; background: #fef3c7; }
        .decision-status.risk { color: #b91c1c; background: #fee2e2; }

        .scenario-trace { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: -6px 0 16px; }
        .scenario-trace-label { color: #475569; font-size: .74rem; font-weight: 700; margin-right: 2px; }
        .scenario-trace-tag { color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 999px; padding: 5px 8px; font-size: .72rem; line-height: 1; }
        .scenario-trace-tag.neutral { color: #475569; background: #f8fafc; border-color: #cbd5e1; }

        .decision-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .decision-kpi { padding: 14px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; }
        .decision-kpi span { display: block; color: #64748b; font-size: .72rem; margin-bottom: 7px; }
        .decision-kpi strong { color: #0f172a; font-size: 1.04rem; line-height: 1.25; }
        .decision-kpi small { color: #64748b; font-weight: 500; font-size: .72rem; }
        .decision-kpi.safe strong { color: #047857; }
        .decision-kpi.risk strong { color: #b91c1c; }

        .compare-controls { display: none; }

        .decision-legend { display: flex; flex-wrap: wrap; gap: 14px; margin: -6px 0 16px; color: #475569; font-size: .76rem; }
        .decision-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .legend-line { display: inline-block; width: 22px; border-top: 3px solid; }
        .legend-line.reference { border-color: #3b82f6; }
        .legend-line.scenario { border-color: #f59e0b; border-top-style: dashed; }
        .legend-line.capacity { border-color: #16a34a; border-top-style: dashed; }
        .legend-band { width: 18px; height: 10px; background: rgba(59, 130, 246, .16); border-radius: 3px; }

        .technical-toggle { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px; margin: 0 0 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #334155; font-weight: 600; cursor: pointer; }
        .technical-toggle:hover { background: #f8fafc; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .stat-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #94a3b8;
          letter-spacing: 0.03em;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1e293b;
        }

        .stat-unit {
          font-size: 0.9rem;
          font-weight: 400;
          color: #64748b;
        }

        .stat-value.trend-up { color: #f59e0b; }
        .stat-value.trend-down { color: #10b981; }
        .stat-value.positive { color: #10b981; }
        .stat-value.negative { color: #ef4444; }

        .stat-desc {
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 6px;
        }

        .recommendation-card {
          background: #ffffff;
          border-left: 4px solid;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
          border-left-width: 4px;
        }

        .recommendation-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .recommendation-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 700;
          color: white;
          letter-spacing: 0.03em;
        }

        .recommendation-title {
          font-size: 1.15rem;
          font-weight: 600;
        }

        .recommendation-text {
          font-size: 0.9rem;
          color: #475569;
          line-height: 1.6;
          margin: 0 0 12px 0;
        }

        .recommendation-action {
          padding: 10px 12px;
          background: #f8fafc;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #1e293b;
          margin-bottom: 12px;
        }

        .recommendation-note {
          font-size: 0.7rem;
          color: #94a3b8;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
        }

        .chart-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .chart-header {
          margin-bottom: 20px;
        }

        .compare-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin: -6px 0 14px;
        }

        .compare-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
        }

        .compare-fixed {
          justify-content: center;
        }

        .compare-alert {
          border-color: #fecaca;
          background: #fff1f2;
        }

        .compare-label {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .compare-value {
          font-size: 0.92rem;
          color: #0f172a;
          font-weight: 700;
        }

        .compare-input {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 0.88rem;
          color: #0f172a;
          background: #fff;
        }

        .compare-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }

        .alerts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .alert-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #64748b;
          border-radius: 12px;
          padding: 14px;
        }

        .alert-card.critical {
          border-left-color: #dc2626;
          background: #fff5f5;
        }

        .alert-card.warn {
          border-left-color: #f59e0b;
          background: #fffbeb;
        }

        .alert-card.safe {
          border-left-color: #16a34a;
          background: #f0fdf4;
        }

        .alert-card.info {
          border-left-color: #3b82f6;
          background: #eff6ff;
        }

        .alert-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #475569;
          margin-bottom: 6px;
          font-weight: 600;
        }

        .alert-value {
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .alert-subtext {
          font-size: 0.8rem;
          color: #475569;
          line-height: 1.35;
        }

        .chart-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
        }

        .chart-subtitle {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 4px;
        }

        .chart-container {
          height: 280px;
          position: relative;
        }

        .table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .table-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .table-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
        }

        .table-subtitle {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 4px;
        }

        .table-responsive {
          overflow-x: auto;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .data-table td {
          padding: 12px 16px;
          font-size: 0.85rem;
          color: #475569;
          border-bottom: 1px solid #f1f5f9;
        }

        .data-table tr:hover td {
          background: #f8fafc;
        }

        .zone-name {
          font-weight: 500;
          color: #1e293b;
        }

        .deficit-value {
          color: #ef4444;
          font-weight: 500;
        }

        .status-badge {
          display: inline-flex;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .status-badge.deficit {
          background: #fef2f2;
          color: #dc2626;
        }

        .status-badge.tension {
          background: #fffbeb;
          color: #d97706;
        }

        .status-badge.ok {
          background: #ecfdf5;
          color: #059669;
        }

        .vulnerability-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          margin-top: 20px;
        }

        .vulnerability-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
          padding: 16px;
        }

        .vuln-item {
          border: 1px solid #e2e8f0;
          border-left: 4px solid #94a3b8;
          border-radius: 10px;
          padding: 12px;
          background: #ffffff;
        }

        .vuln-item.deficit {
          border-left-color: #dc2626;
          background: #fff5f5;
        }

        .vuln-item.tension {
          border-left-color: #f59e0b;
          background: #fffbeb;
        }

        .vuln-item.ok {
          border-left-color: #16a34a;
          background: #f0fdf4;
        }

        .vuln-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          gap: 8px;
        }

        .vuln-zone {
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
        }

        .vuln-status {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #334155;
        }

        .vuln-metrics {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 8px;
          font-size: 0.78rem;
          color: #475569;
        }

        .vuln-bar {
          width: 100%;
          height: 8px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
          margin-bottom: 6px;
        }

        .vuln-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #f59e0b 0%, #dc2626 100%);
        }

        .vuln-foot {
          font-size: 0.75rem;
          color: #334155;
          font-weight: 600;
        }

        .pilot-zones-section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 16px;
        }

        .section-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e293b;
        }

        .section-subtitle {
          font-size: 0.9rem;
          color: #475569;
          margin-top: 4px;
        }

        .section-note {
          font-size: 0.78rem;
          color: #b45309;
          margin-top: 8px;
          font-weight: 600;
        }

        .pilot-zone-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 30px;
        }

        .pilot-zone-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
          display: flex;
          flex-direction: column;
          min-height: 280px;
        }

        @media (max-width: 900px) {
          .decision-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 560px) {
          .decision-summary-head { flex-direction: column; }
          .decision-kpis { grid-template-columns: 1fr; }
        }

        .pilot-zone-card-unavailable {
          border-color: #fed7aa;
          background: #fffdf9;
        }

        .pilot-zone-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .pilot-zone-title {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .pilot-zone-subtitle {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 4px;
        }

        .pilot-zone-badge {
          padding: 6px 12px;
          border-radius: 999px;
          background: #eef2ff;
          color: #3b82f6;
          font-size: 0.7rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .pilot-zone-badge-ready {
          background: #ecfdf5;
          color: #047857;
        }

        .pilot-zone-badge-unavailable {
          background: #fff7ed;
          color: #c2410c;
        }

        .pilot-zone-note {
          font-size: 0.8rem;
          color: #475569;
          margin-bottom: 14px;
          flex-shrink: 0;
        }

        .pilot-zone-non-exhaustive {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          background: #fffbeb;
          color: #b45309;
          font-size: 0.72rem;
          font-weight: 700;
          margin-bottom: 12px;
          flex-shrink: 0;
        }

        .pilot-inputs {
          margin: 0 0 12px;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          display: grid;
          gap: 6px;
          flex-shrink: 0;
        }

        .pilot-inputs-title {
          color: #334155;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 2px;
        }

        .pilot-input-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
          color: #64748b;
          font-size: 0.72rem;
        }

        .pilot-input-row strong {
          color: #0f172a;
          text-align: right;
          font-weight: 700;
        }

        .pilot-centers-list {
          list-style: none;
          padding: 0;
          margin: 0 0 12px 0;
          display: grid;
          gap: 10px;
          flex: 1;
        }

        .pilot-centers-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #f8fafc;
          color: #0f172a;
          font-size: 0.88rem;
        }

        .pilot-center-id {
          font-weight: 700;
          color: #334155;
        }

        .pilot-center-name {
          color: #475569;
          text-align: right;
          flex: 1;
        }

        .pilot-zone-empty {
          padding: 16px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 0.85rem;
          flex: 1;
        }

        .pilot-zone-data-note {
          margin: 0 0 12px;
          padding: 9px 10px;
          border-radius: 10px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 0.74rem;
          line-height: 1.35;
          font-weight: 600;
        }

        .pilot-zone-action {
          width: 100%;
          margin-top: 12px;
          padding: 10px 12px;
          border: 1px solid #c7d2fe;
          border-radius: 10px;
          background: #eef2ff;
          color: #3730a3;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .pilot-zone-action:hover {
          background: #e0e7ff;
          border-color: #a5b4fc;
        }

        .pilot-zone-action:disabled {
          cursor: not-allowed;
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #94a3b8;
        }

        .pilot-zone-action:disabled:hover {
          background: #f1f5f9;
          border-color: #e2e8f0;
        }

        @media (max-width: 1200px) {
          .pilot-zone-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .pilot-zone-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
