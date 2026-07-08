import api from './api';

class DashboardService {
  async getDashboardData(filters = {}) {
    const params = new URLSearchParams({
      region: filters.region || 'all',
      start_year: filters.startYear || 2020,
      end_year: filters.endYear || 2030,
      mode: filters.mode || 'pred'
    });
    
    const response = await api.get(`/dashboard?${params}`);
    return response.data;
  }

  async getStatistics(region = 'all') {
    const response = await api.get(`/dashboard/statistics?region=${region}`);
    return response.data;
  }

  async getProductionByRegion(year = 2024) {
    const response = await api.get(`/dashboard/production/region?year=${year}`);
    return response.data;
  }

  async getTopCentres(limit = 10, year = 2024) {
    const response = await api.get(`/dashboard/top-centres?limit=${limit}&year=${year}`);
    return response.data;
  }
}

export default new DashboardService();