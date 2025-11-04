import React from 'react';
import { Home, ChevronRight } from 'lucide-react';
import './Breadcrumbs.css';

function Breadcrumbs({ breadcrumbs, onNavigate }) {
  return (
    <div className="breadcrumbs">
      <button 
        className="breadcrumb-item"
        onClick={() => onNavigate('')}
      >
        <Home size={18} />
        <span>Home</span>
      </button>
      
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          <ChevronRight size={18} className="breadcrumb-separator" />
          <button
            className="breadcrumb-item"
            onClick={() => onNavigate(crumb.path)}
          >
            {crumb.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export default Breadcrumbs;