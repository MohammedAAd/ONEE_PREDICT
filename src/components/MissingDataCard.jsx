// components/MissingDataCard.jsx
import React from 'react';

const MissingDataCard = ({ icon, title, description, impact, impactText, withoutText, withText }) => {
  const getImpactClass = () => {
    switch(impact) {
      case 'high': return 'absent';
      case 'med': return 'partial';
      case 'low': return 'has';
      default: return 'absent';
    }
  };

  const getImpactColor = () => {
    switch(impact) {
      case 'high': return 'impact-high';
      case 'med': return 'impact-med';
      case 'low': return 'impact-low';
      default: return 'impact-high';
    }
  };

  return (
    <div className={`missing-card ${getImpactClass()}`}>
      <div className="missing-icon">{icon}</div>
      <div className="missing-title">{title}</div>
      <div className="missing-desc">{description}</div>
      <div className={`missing-impact ${getImpactColor()}`}>{impactText}</div>
      <div style={{ marginTop: '10px', fontSize: '.72rem', color: 'var(--text2)' }}>{withoutText}</div>
      <div style={{ marginTop: '8px', fontSize: '.72rem', color: 'var(--teal)' }}>{withText}</div>
    </div>
  );
};

export default MissingDataCard;
