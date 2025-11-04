import React, { useState, useEffect, useCallback, useRef } from 'react';
import LazyVideoCard from './LazyVideoCard';
import './InfiniteVideoGrid.css';

function InfiniteVideoGrid({ 
  initialVideos, 
  totalVideos, 
  loadMore, 
  loading 
}) {
  const [videos, setVideos] = useState(initialVideos || []);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef();
  const loadingRef = useRef(null);

  useEffect(() => {
    setVideos(initialVideos || []);
    setHasMore((initialVideos?.length || 0) < totalVideos);
  }, [initialVideos, totalVideos]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || loading) return;
    
    setIsLoadingMore(true);
    try {
      const newVideos = await loadMore(videos.length);
      if (newVideos && newVideos.length > 0) {
        setVideos(prev => [...prev, ...newVideos]);
        setHasMore(videos.length + newVideos.length < totalVideos);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more videos:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [videos.length, isLoadingMore, hasMore, loading, loadMore, totalVideos]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleLoadMore, hasMore, isLoadingMore]);

  if (loading && videos.length === 0) {
    return (
      <div className="video-grid">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="video-card-skeleton">
            <div className="skeleton-thumbnail"></div>
            <div className="skeleton-info">
              <div className="skeleton-title"></div>
              <div className="skeleton-meta"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="video-grid">
        {videos.map(video => (
          <LazyVideoCard key={video.id} video={video} />
        ))}
      </div>
      
      {hasMore && (
        <div ref={loadingRef} className="loading-more">
          {isLoadingMore && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <span>Loading more videos...</span>
            </div>
          )}
        </div>
      )}
      
      {!hasMore && videos.length > 0 && (
        <div className="end-of-list">
          <span>No more videos to load</span>
        </div>
      )}
    </>
  );
}

export default InfiniteVideoGrid;