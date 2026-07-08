// utils/chartConfig.js
export const chartColors = {
  blue: '#2d8bff',
  teal: '#00c9a7',
  amber: '#f5a623',
  red: '#ff4d6d',
  green: '#3cd68a',
  purple: '#8b5cf6'
};

export const gridColor = 'rgba(255,255,255,.05)';
export const fontColor = '#8ba8cc';

export const years = ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030'];

export const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: '#0f1d30',
      borderColor: '#1e3555',
      borderWidth: 1,
      titleColor: '#e8f0fe',
      bodyColor: '#8ba8cc',
      padding: 10
    }
  },
  scales: {
    x: {
      grid: { color: gridColor },
      ticks: {
        color: fontColor,
        font: { size: 10, family: 'DM Mono' }
      }
    },
    y: {
      grid: { color: gridColor },
      ticks: {
        color: fontColor,
        font: { size: 10, family: 'DM Mono' }
      }
    }
  }
};