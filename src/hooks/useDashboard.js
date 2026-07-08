import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const useDashboard = (initialFilters = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    region: initialFilters.region || 'all',
    startYear: initialFilters.startYear || 2020,
    endYear: initialFilters.endYear || 2030,
    mode: initialFilters.mode || 'pred',
    ...initialFilters
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        region: filters.region,
        start_year: filters.startYear.toString(),
        end_year: filters.endYear.toString(),
        mode: filters.mode
      });
      
      const response = await axios.get(`${API_BASE}/dashboard?${params}`);
      setData(response.data);
    } catch (err) {
      console.error('❌ Erreur dashboard:', err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    filters,
    updateFilters,
    refresh
  };
};