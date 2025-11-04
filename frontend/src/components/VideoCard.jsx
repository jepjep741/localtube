import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Eye } from 'lucide-react';
import StarRating from './StarRating';
import './VideoCard.css';

function VideoCard({ video }) {
  const [isHovering, setIsHovering] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  
  // Only show preview if card is visible (from lazy loading)
  const shouldShowPreview = isHovering && video._isVisible !== false;

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < sizes.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${sizes[i]}`;
  };

  return (
    <Link 
      to={`/watch/${video.id}`} 
      className="video-card"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="thumbnail-container">
        {video.thumbnail ? (
          <>
            <img 
              src={video.thumbnail} 
              alt={video.title} 
              className={`thumbnail ${shouldShowPreview && video.preview_path && !previewError ? 'hidden' : ''} ${thumbnailLoaded ? 'loaded' : ''}`}
              onLoad={() => setThumbnailLoaded(true)}
              loading="lazy"
            />
            {shouldShowPreview && video.preview_path && !previewError && (
              <img 
                src={video.preview_path} 
                alt={`${video.title} preview`} 
                className="preview-gif"
                onError={() => setPreviewError(true)}
              />
            )}
          </>
        ) : (
          <div className="thumbnail-placeholder">
            <Clock size={48} />
          </div>
        )}
        {video.duration && (
          <span className="duration">{formatDuration(video.duration)}</span>
        )}
      </div>
      
      <div className="video-info">
        <h3 className="video-title">{video.title}</h3>
        {video.rating > 0 && (
          <div className="video-rating">
            <StarRating rating={video.rating} size={16} readonly />
          </div>
        )}
        <div className="video-meta">
          <span className="file-size">{formatFileSize(video.size)}</span>
          {video.play_count > 0 && (
            <span className="play-count">
              <Eye size={16} />
              {video.play_count}
            </span>
          )}
        </div>
        {video.folder_path && (
          <span className="folder-path">{video.folder_path}</span>
        )}
        <span className="category">{video.category}</span>
      </div>
    </Link>
  );
}

export default VideoCard;