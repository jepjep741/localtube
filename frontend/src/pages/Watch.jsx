import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Home, Tag } from 'lucide-react';
import StarRating from '../components/StarRating';
import Comments from '../components/Comments';
import axios from 'axios';
import './Watch.css';

function Watch() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchVideo();
  }, [id]);

  const fetchVideo = async () => {
    try {
      const response = await axios.get(`/api/video/${id}`);
      setVideo(response.data);
      setNewCategory(response.data.category);
    } catch (error) {
      console.error('Failed to fetch video:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async () => {
    try {
      await axios.put(`/api/video/${id}/category`, { category: newCategory });
      setVideo({ ...video, category: newCategory });
      setShowCategoryEdit(false);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const updateRating = async (rating) => {
    try {
      await axios.put(`/api/video/${id}/rating`, { rating });
      setVideo({ ...video, rating });
    } catch (error) {
      console.error('Failed to update rating:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading video...</div>;
  }

  if (!video) {
    return <div className="error">Video not found</div>;
  }

  return (
    <div className="watch-page">
      <div className="watch-container">
        <div className="video-player-section">
          <video
            controls
            autoPlay
            className="video-player"
            src={`/api/stream/${id}`}
          />
          
          <div className="video-details">
            <h1 className="video-title">{video.title}</h1>
            
            <div className="video-rating-section">
              <span className="rating-label">Rate this video:</span>
              <StarRating 
                rating={video.rating || 0} 
                onRate={updateRating}
                size={24}
              />
            </div>
            
            <div className="video-actions">
              <Link to="/" className="home-button">
                <Home size={20} />
                <span>Home</span>
              </Link>
              
              <div className="category-section">
                {showCategoryEdit ? (
                  <div className="category-edit">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Category name"
                    />
                    <button onClick={updateCategory}>Save</button>
                    <button onClick={() => setShowCategoryEdit(false)}>Cancel</button>
                  </div>
                ) : (
                  <button 
                    className="category-tag"
                    onClick={() => setShowCategoryEdit(true)}
                  >
                    <Tag size={16} />
                    <span>{video.category}</span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="video-metadata">
              <span>Views: {video.play_count}</span>
              {video.last_played && (
                <span>Last watched: {new Date(video.last_played).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          
          <Comments videoId={id} />
        </div>
      </div>
    </div>
  );
}

export default Watch;