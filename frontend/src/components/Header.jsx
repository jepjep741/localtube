import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Film, RefreshCw } from 'lucide-react';
import axios from 'axios';
import './Header.css';

function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/');
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await axios.post('/api/rescan');
      window.location.reload();
    } catch (error) {
      console.error('Failed to rescan:', error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <header className="header">
      <div className="header-container container">
        <Link to="/" className="logo">
          <Film size={32} />
          <span>LocalTube</span>
        </Link>
        
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">
            <Search size={20} />
          </button>
        </form>
        
        <button 
          className={`rescan-button ${isScanning ? 'scanning' : ''}`}
          onClick={handleRescan}
          disabled={isScanning}
        >
          <RefreshCw size={20} />
          <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
        </button>
      </div>
    </header>
  );
}

export default Header;