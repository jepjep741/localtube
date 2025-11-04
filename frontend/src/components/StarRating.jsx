import React from 'react';
import { Star } from 'lucide-react';
import './StarRating.css';

function StarRating({ rating, onRate, size = 20, readonly = false }) {
  const handleClick = (value) => {
    if (!readonly && onRate) {
      onRate(value);
    }
  };

  return (
    <div className={`star-rating ${readonly ? 'readonly' : 'interactive'}`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          className="star-button"
          onClick={() => handleClick(value)}
          disabled={readonly}
          aria-label={`Rate ${value} stars`}
        >
          <Star
            size={size}
            className={`star ${value <= rating ? 'filled' : 'empty'}`}
            fill={value <= rating ? '#FFD700' : 'none'}
            stroke={value <= rating ? '#FFD700' : '#666'}
          />
        </button>
      ))}
    </div>
  );
}

export default StarRating;