import React from 'react';
import { TrendingUp, Clock, Star } from 'lucide-react';
import './SortFilter.css';

function SortFilter({ currentSort, onSortChange }) {
  const sortOptions = [
    { value: 'recent', label: 'Recently Added', icon: Clock },
    { value: 'rating', label: 'Top Rated', icon: Star },
    { value: 'views', label: 'Most Viewed', icon: TrendingUp },
  ];

  return (
    <div className="sort-filter">
      <span className="sort-label">Sort by:</span>
      <div className="sort-buttons">
        {sortOptions.map(option => (
          <button
            key={option.value}
            className={`sort-button ${currentSort === option.value ? 'active' : ''}`}
            onClick={() => onSortChange(option.value)}
          >
            <option.icon size={16} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SortFilter;