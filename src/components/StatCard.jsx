import React from 'react';

const StatCard = ({ type, label, value, unit, trend, trendDirection }) => {
  const getColorClass = () => {
    switch(type) {
      case 'blue': return 'blue';
      case 'teal': return 'teal';
      case 'amber': return 'amber';
      case 'red': return 'red';
      default: return 'blue';
    }
  };

  return (
    <div className={`stat-card ${getColorClass()}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-val">{value}</div>
      <div className="stat-unit">{unit}</div>
      {trend && (
        <div className={`stat-trend ${trendDirection === 'up' ? 'trend-up' : 'trend-down'}`}>
          {trend}
        </div>
      )}
    </div>
  );
};

export default StatCard;