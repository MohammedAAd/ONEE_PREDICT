import axios from 'axios';

const API_BASE_URL_2 = 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL_2,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// API BASE (Port 8000) - Pour l'exploration des tables Access
// ============================================================
const API_BASE_URL = 'http://localhost:8000/api';

// ============================================================
// API ML (Port 8001) - Pour les prédictions du modèle
// ============================================================
const ML_API_BASE_URL = 'http://localhost:8001/api';

// ============================================================
// API BASE - Fonctions pour l'exploration des tables
// ============================================================
export const api = {
  async getTables() {
    try {
      const response = await fetch(`${API_BASE_URL}/access/tables`);
      if (!response.ok) throw new Error('Erreur lors de la récupération des tables');
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { tables: [] };
    }
  },

  async getTableSchemas() {
    try {
      const response = await fetch(`${API_BASE_URL}/access/schemas`);
      if (!response.ok) {
        // Fallback: essayer sans /access/
        const response2 = await fetch(`${API_BASE_URL}/schemas`);
        if (response2.ok) return response2.json();
        throw new Error('Erreur lors de la récupération des schémas');
      }
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      return {};
    }
  },

  async getTableData(tableName, limit = 500) {
    try {
      // Encoder le nom de la table pour gérer les underscores et caractères spéciaux
      const encodedTableName = encodeURIComponent(tableName);
      const response = await fetch(`${API_BASE_URL}/access/tables/${encodedTableName}?limit=${limit}`);
      if (!response.ok) {
        // Si 404, essayer avec l'URL non encodée
        const response2 = await fetch(`${API_BASE_URL}/access/tables/${tableName}?limit=${limit}`);
        if (response2.ok) return response2.json();
        throw new Error(`Erreur lors de la récupération de la table ${tableName}`);
      }
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { error: error.message, data: [], columns: [] };
    }
  },

  async getTableSummary(tableName) {
    try {
      const encodedTableName = encodeURIComponent(tableName);
      const response = await fetch(`${API_BASE_URL}/access/tables/${encodedTableName}/summary`);
      if (!response.ok) throw new Error(`Erreur lors de la récupération du résumé`);
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { error: error.message };
    }
  },

  async executeQuery(query) {
    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!response.ok) throw new Error('Erreur lors de l\'exécution de la requête');
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { error: error.message };
    }
  },

  async testConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/test`);
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { connected: false, error: error.message };
    }
  }
};

// ============================================================
// API ML - Fonctions pour les prédictions
// ============================================================
export const mlApi = {
  async getCentresWithNames() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/centres-with-names`);
      if (!response.ok) throw new Error('Erreur chargement centres');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getCentrePredictions(centreId) {
    try {
      const cleanId = encodeURIComponent(centreId.trim());
      const response = await fetch(`${ML_API_BASE_URL}/api/predictions/centre/${cleanId}`);
      if (!response.ok) throw new Error(`Erreur chargement prédictions pour ${centreId}`);
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getHistoricalCentre(centreId) {
    try {
      const cleanId = encodeURIComponent(centreId.trim());
      const response = await fetch(`${ML_API_BASE_URL}/historical/centre/${cleanId}`);
      if (!response.ok) throw new Error(`Erreur chargement historique pour ${centreId}`);
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getNationalPredictions() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/predictions/national`);
      if (!response.ok) throw new Error('Erreur chargement prédictions nationales');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getDashboardSummary() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/dashboard/summary`);
      if (!response.ok) throw new Error('Erreur chargement résumé dashboard');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return null;
    }
  },

  async getAlerts(annee = 2030) {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/alerts?annee=${annee}`);
      if (!response.ok) throw new Error('Erreur chargement alertes');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getCentreInfo(centreId) {
    try {
      const cleanId = encodeURIComponent(centreId.trim());
      const response = await fetch(`${ML_API_BASE_URL}/centre-info/${cleanId}`);
      if (!response.ok) throw new Error(`Erreur chargement infos pour ${centreId}`);
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return null;
    }
  },

  async getDashboardStats() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/dashboard/stats`);
      if (!response.ok) throw new Error('Erreur chargement stats dashboard');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return null;
    }
  },

  async getConsumptionTrend() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/consumption/trend`);
      if (!response.ok) throw new Error('Erreur chargement tendance consommation');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getProductionTrend() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/production/trend`);
      if (!response.ok) throw new Error('Erreur chargement tendance production');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getBilanCentres() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/bilan/centres`);
      if (!response.ok) throw new Error('Erreur chargement bilan centres');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getRendementsReseau() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/rendements/reseau`);
      if (!response.ok) throw new Error('Erreur chargement rendements');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return { labels: [], datasets: [] };
    }
  },

  async getRecentAlerts() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/alerts-recentes`);
      if (!response.ok) throw new Error('Erreur chargement alertes');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  },

  async getConsumptionAggregates() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/consumption/aggregates`);
      if (!response.ok) throw new Error('Erreur chargement agregats consommation');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return null;
    }
  },

  async getProductionAggregates() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/production/aggregates`);
      if (!response.ok) throw new Error('Erreur chargement agregats production');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return null;
    }
  },

  async getPopulationProjection() {
    try {
      const response = await fetch(`${ML_API_BASE_URL}/population/projection`);
      if (!response.ok) throw new Error('Erreur chargement projection population');
      return response.json();
    } catch (error) {
      console.error('ML API Error:', error);
      return [];
    }
  }
};

// ============================================================
// PREDICTION API (Port 8000, routes /api/v1/prediction)
// ============================================================
export const predictionAPI = {
  getAll: () => {
    return apiClient.get('/prediction/').then(res => res.data);
  },
  
  getModelInfo: () => {
    return apiClient.get('/prediction/model-info').then(res => res.data);
  },
  
  getPrevisionsAnnuelle: (centreId = null, cible = null, anneeDebut = null, anneeFin = null) => {
    const params = {};
    if (centreId) params.centre_id = centreId;
    if (cible) params.cible = cible;
    if (anneeDebut) params.annee_debut = anneeDebut;
    if (anneeFin) params.annee_fin = anneeFin;
    return apiClient.get('/prediction/previsions-annuelles', { params }).then(res => res.data);
  },
  
  getPrevisionsMensuelles: (installation = null, annee = null) => {
    const params = {};
    if (installation) params.installation = installation;
    if (annee) params.annee = annee;
    return apiClient.get('/prediction/previsions-mensuelles', { params }).then(res => res.data);
  },
  
  getPrevisionsParDr: (drId = null, annee = null) => {
    const params = {};
    if (drId) params.dr_id = drId;
    if (annee) params.annee = annee;
    return apiClient.get('/prediction/previsions-dr', { params }).then(res => res.data);
  },
  
  getHistorique: (centreId = null, cible = 'consommation_totale', region = null) => {
    const params = { cible };
    if (centreId) params.centre_id = centreId;
    if (region) params.region = region;
    return apiClient.get('/prediction/historique', { params }).then(res => res.data);
  },
  
  getShapGlobal: (cible = null) => {
    const params = {};
    if (cible) params.cible = cible;
    return apiClient.get('/prediction/shap-global', { params }).then(res => res.data);
  },
  
  getShapParCentre: (centreId = null, cible = null) => {
    const params = {};
    if (centreId) params.centre_id = centreId;
    if (cible) params.cible = cible;
    return apiClient.get('/prediction/shap-par-centre', { params }).then(res => res.data);
  },
  
  getCentres: () => {
    return apiClient.get('/prediction/centres').then(res => res.data);
  },
  
  getDrs: () => {
    return apiClient.get('/prediction/drs').then(res => res.data);
  }
};

// ============================================================
// DASHBOARD V2 API (Port 8000, routes /api/v1/dashboard)
// ============================================================
export const dashboardAPI = {
  getRegions: () => {
    return apiClient.get('/dashboard/v2/regions').then(res => res.data);
  },
  
  getDashboardData: (region = 'all', startYear = 2020, endYear = 2030, mode = 'pred') => {
    return apiClient.get('/dashboard/v2/', {
      params: { region, start_year: startYear, end_year: endYear, mode }
    }).then(res => res.data);
  },
  
  getBilanByRegion: (year = 2024) => {
    return apiClient.get('/dashboard/v2/master/bilan/regions', { params: { year } })
      .then(res => res.data);
  },
  
  getBilanByProvince: (region = 'all', year = 2024) => {
    const params = { year };
    if (region !== 'all') params.region = region;
    return apiClient.get('/dashboard/v2/master/bilan/provinces', { params })
      .then(res => res.data);
  },
  
  getBilanByZone: (region = 'all', year = 2024) => {
    const params = { year };
    if (region !== 'all') params.region = region;
    return apiClient.get('/dashboard/v2/master/bilan/zones', { params })
      .then(res => res.data);
  },
  
  getCentresByRegion: (region = 'all', year = 2024) => {
    return apiClient.get('/dashboard/v2/centres', { params: { region, year } })
      .then(res => res.data);
  },
  
  getZonesByRegion: (region = 'all', year = 2024) => {
    return apiClient.get('/dashboard/v2/zones/by-region', { params: { region, year } })
      .then(res => res.data);
  },
  
  getMasterStats: (region = 'all', year = 2024) => {
    return apiClient.get('/dashboard/v2/master/stats', { params: { region, year } })
      .then(res => res.data);
  },
  
  getMasterTimeseries: (region = 'all', startYear = 2020, endYear = 2030) => {
    return apiClient.get('/dashboard/v2/master/timeseries', {
      params: { region, start_year: startYear, end_year: endYear }
    }).then(res => res.data);
  },
  
  getRendements: (region = 'all') => {
    return apiClient.get('/dashboard/v2/master/rendements', { params: { region } })
      .then(res => res.data);
  },
  
  getAlerts: (region = 'all') => {
    return apiClient.get('/dashboard/v2/master/alerts', { params: { region } })
      .then(res => res.data);
  }
};

// ============================================================
// API PRÉVISIONS & SCÉNARIOS (Port 8000, routes /api/v1)
// ============================================================
const PREVISION_BASE = 'http://localhost:8000/api/v1';

export const previsionApi = {
  async _get(path) {
    const r = await fetch(`${PREVISION_BASE}${path}`);
    if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
    return r.json();
  },
  
  centres() { return this._get('/prediction/centres'); },
  
  drs() { return this._get('/prediction/drs'); },
  
  historique(centreId, cible, region) {
    const q = new URLSearchParams({ cible: cible || 'consommation_totale' });
    if (centreId) q.set('centre_id', centreId);
    if (region)   q.set('region', region);
    return this._get(`/prediction/historique?${q}`);
  },
  
  previsionsAnnuelles(centreId, cible) {
    const q = new URLSearchParams();
    if (centreId) q.set('centre_id', centreId);
    if (cible)    q.set('cible', cible);
    return this._get(`/prediction/previsions-annuelles?${q}`);
  },
  
  previsionsMensuelles(installation, annee) {
    const q = new URLSearchParams();
    if (installation) q.set('installation', installation);
    if (annee)        q.set('annee', annee);
    return this._get(`/prediction/previsions-mensuelles?${q}`);
  },
  
  previsionsDr(drId, annee) {
    const q = new URLSearchParams();
    if (drId)  q.set('dr_id', drId);
    if (annee) q.set('annee', annee);
    return this._get(`/prediction/previsions-dr?${q}`);
  },
  
  shapGlobal(cible) { 
    return this._get(`/prediction/shap-global?cible=${cible || ''}`); 
  },
  
  shapParCentre(centreId, cible) {
    const q = new URLSearchParams();
    if (centreId) q.set('centre_id', centreId);
    if (cible)    q.set('cible', cible);
    return this._get(`/prediction/shap-par-centre?${q}`);
  },
  
  async scenario(body) {
    const r = await fetch(`${PREVISION_BASE}/scenario/`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`scenario → HTTP ${r.status}`);
    return r.json();
  },
};

// ============================================================
// CENTRES API (CORRIGÉ - utilise /prediction/drs au lieu de /centres/drs)
// ============================================================
export const centresAPI = {
  getAllDRs: (year = 2024) => {
    return apiClient.get('/prediction/drs', { params: { year } }).then(res => res.data);
  },
  
  getCentresByDR: (drId, year = 2024, includeInstallations = false) => {
    return apiClient.get(`/centres/by-dr/${drId}`, { 
      params: { year, include_installations: includeInstallations }
    }).then(res => res.data);
  },
  
  getCentreDetail: (centreId, year = 2024) => {
    return apiClient.get(`/centres/${centreId}`, { params: { year } }).then(res => res.data);
  },
  
  getDRStats: (drId, year = 2024) => {
    return apiClient.get(`/centres/dr/${drId}/stats`, { params: { year } }).then(res => res.data);
  }
};

export default api;