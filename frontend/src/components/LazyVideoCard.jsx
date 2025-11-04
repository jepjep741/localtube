import React, { useState, useEffect, useRef } from 'react';
import VideoCard from './VideoCard';
import './LazyVideoCard.css';

function LazyVideoCard({ video }) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (!hasLoaded) {
            setHasLoaded(true);
          }
        } else {
          // Keep content loaded but hide preview when not visible
          setIsVisible(false);
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [hasLoaded]);

  return (
    <div ref={cardRef} style={{ minHeight: '320px' }}>
      {hasLoaded ? (
        <VideoCard video={{ ...video, _isVisible: isVisible }} />
      ) : (
        <div className="video-card-skeleton">
          <div className="skeleton-thumbnail"></div>
          <div className="skeleton-info">
            <div className="skeleton-title"></div>
            <div className="skeleton-meta"></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LazyVideoCard;