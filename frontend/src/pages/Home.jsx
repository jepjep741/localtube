import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import FolderGrid from '../components/FolderGrid';
import CategoryFilter from '../components/CategoryFilter';
import SortFilter from '../components/SortFilter';
import Breadcrumbs from '../components/Breadcrumbs';
import axios from 'axios';
import './Home.css';

function Home() {
  const [videos, setVideos] = useState([]);
  const [folders, setFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [totalVideos, setTotalVideos] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  const currentPath = searchParams.get('path') || '';

  useEffect(() => {
    if (searchQuery) {
      fetchVideos();
    } else {
      fetchBrowseData();
    }
    fetchCategories();
  }, [searchQuery, selectedCategory, currentPath, sortBy]);

  const fetchVideos = async (offset = 0) => {
    try {
      const params = { sort: sortBy, limit: 50, offset };
      if (searchQuery) params.search = searchQuery;
      else if (selectedCategory !== 'All') params.category = selectedCategory;
      
      const response = await axios.get('/api/videos', { params });
      if (offset === 0) {
        setVideos(response.data.videos);
        setTotalVideos(response.data.total);
        setFolders([]);
      }
      return response.data.videos;
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      return [];
    } finally {
      if (offset === 0) setLoading(false);
    }
  };

  const fetchBrowseData = async (offset = 0) => {
    try {
      const response = await axios.get('/api/browse', { 
        params: { path: currentPath, sort: sortBy, limit: 50, offset } 
      });
      if (offset === 0) {
        setVideos(response.data.videos);
        setFolders(response.data.folders);
        setBreadcrumbs(response.data.breadcrumbs);
        setTotalVideos(response.data.total);
      }
      return response.data.videos;
    } catch (error) {
      console.error('Failed to fetch browse data:', error);
      return [];
    } finally {
      if (offset === 0) setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const navigateToFolder = (folderPath) => {
    setSearchParams({ path: folderPath });
  };

  const loadMoreVideos = useCallback(async (offset) => {
    if (searchQuery) {
      return fetchVideos(offset);
    } else {
      return fetchBrowseData(offset);
    }
  }, [searchQuery, selectedCategory, currentPath, sortBy]);

  return (
    <div className="home">
      <div className="container">
        {!searchQuery && currentPath && (
          <>
            <Breadcrumbs 
              breadcrumbs={breadcrumbs}
              onNavigate={(path) => setSearchParams(path ? { path } : {})}
            />
            <SortFilter
              currentSort={sortBy}
              onSortChange={setSortBy}
            />
          </>
        )}
        
        {!searchQuery && !currentPath && (
          <>
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            <SortFilter
              currentSort={sortBy}
              onSortChange={setSortBy}
            />
          </>
        )}
        
        {searchQuery && (
          <h2 className="search-results-title">
            Search results for "{searchQuery}"
          </h2>
        )}
        
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {folders.length > 0 && (
              <FolderGrid folders={folders} onFolderClick={navigateToFolder} />
            )}
            {videos.length > 0 || loading ? (
              <InfiniteVideoGrid 
                initialVideos={videos}
                totalVideos={totalVideos}
                loadMore={loadMoreVideos}
                loading={loading}
              />
            ) : (
              folders.length === 0 && (
                <div className="no-videos">
                  {searchQuery ? 'No videos found' : 'No videos in this folder'}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Home;