import React from 'react';

const AlertItem = ({ icon: Icon, iconColor, title, subtitle, meta }) => {
  const isCritical = iconColor === 'var(--red)';
  const isWarning = iconColor === 'var(--amber)';
  const level = isCritical ? 'Critique' : isWarning ? 'À surveiller' : 'Information';

  return (
    <article
      className={`alert-item ${isCritical ? 'critical' : isWarning ? 'warning' : 'info'}`}
      style={{ '--alert-color': iconColor }}
    >
      <div className="alert-icon" aria-hidden="true"><Icon size={20} /></div>
      <div className="alert-body">
        <div className="alert-heading">
          <div className="alert-title">{title}</div>
          <span className="alert-level">{level}</span>
        </div>
        <div className="alert-sub">{subtitle}</div>
      </div>
      <div className="alert-meta">{meta}</div>
    </article>
  );
};

export default AlertItem;
