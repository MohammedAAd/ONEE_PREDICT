// src/hooks/useChart.js — Version finale simple et fiable
import { useLayoutEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export const useChart = (canvasId, config, enabled = true) => {
  const chartRef = useRef(null);

  // 🔥 useLayoutEffect s'exécute SYNCHRONE après le DOM, avant le paint
  useLayoutEffect(() => {
    if (!enabled) return;

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Détruire l'ancien chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // 🔥 Sécuriser la config
    const safeConfig = {
      type: config?.type || 'line',
      data: {
        labels: Array.isArray(config?.data?.labels) ? config.data.labels : [],
        datasets: Array.isArray(config?.data?.datasets) 
          ? config.data.datasets.map(ds => ({
              ...ds,
              data: Array.isArray(ds?.data) ? ds.data : []
            }))
          : []
      },
      options: config?.options || {}
    };

    try {
      chartRef.current = new Chart(ctx, safeConfig);
    } catch (err) {
      console.error(`❌ Erreur chart #${canvasId}:`, err);
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }); // Recontrôle le canvas à chaque rendu, notamment après un chargement conditionnel.
};
