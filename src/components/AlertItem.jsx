import React from 'react';

const AlertItem = ({ icon: Icon, iconColor, title, subtitle, meta }) => {
  return (
    <div className="alert-item">
      <div className={`alert-icon ${iconColor}`}>
        <Icon size={18} />
      </div>
      <div className="alert-body">
        <div className="alert-title">{title}</div>
        <div className="alert-sub">{subtitle}</div>
      </div>
      <div className="alert-meta">{meta}</div>
    </div>
  );
};

export default AlertItem;