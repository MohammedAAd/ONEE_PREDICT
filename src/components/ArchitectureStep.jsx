// components/ArchitectureStep.jsx
import React from 'react';

const ArchitectureStep = ({ step, title, label, formula, items, color }) => {
  const getColorClass = () => {
    switch(color) {
      case 'purple': return 'purple';
      case 'blue': return 'blue';
      case 'teal': return 'teal';
      case 'green': return 'green';
      default: return 'purple';
    }
  };

  return (
    <div className="arch-step">
      <div className="arch-num">
        <div className={`step-circle ${getColorClass()}`}>{step}</div>
      </div>
      <div className="arch-content">
        <div className="arch-label">{label}</div>
        <div className="arch-name">{title}</div>
        {formula && <div className="arch-formula">{formula}</div>}
        <div className="arch-items">
          {items.map((item, idx) => (
            <div key={idx} className="arch-tag">{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArchitectureStep;