// components/ProgressBar.jsx
import React, { useEffect, useRef, useState } from 'react';

const ProgressBar = ({ label, value, color = 'var(--blue)' }) => {
  const [width, setWidth] = useState(0);
  const barRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          ref={barRef}
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;