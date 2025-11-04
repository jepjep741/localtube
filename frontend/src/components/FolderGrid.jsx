import React from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import './FolderGrid.css';

function FolderGrid({ folders, onFolderClick }) {
  return (
    <div className="folder-section">
      <h3 className="section-title">Folders</h3>
      <div className="folder-grid">
        {folders.map(folder => (
          <div
            key={folder.path}
            className="folder-card"
            onClick={() => onFolderClick(folder.path)}
          >
            <div className="folder-icon">
              <Folder size={48} />
            </div>
            <h4 className="folder-name">{folder.name}</h4>
            <span className="folder-count">
              {folder.video_count} {folder.video_count === 1 ? 'video' : 'videos'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FolderGrid;