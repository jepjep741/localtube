-- LocalTube PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    path TEXT NOT NULL UNIQUE,
    relative_path TEXT,
    folder_path TEXT,
    title VARCHAR(255) NOT NULL,
    duration INTEGER,
    size BIGINT,
    thumbnail TEXT,
    preview_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played TIMESTAMP,
    play_count INTEGER DEFAULT 0,
    category VARCHAR(100) DEFAULT 'Uncategorized',
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5)
);

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    parent_path TEXT,
    video_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Playlist videos junction table
CREATE TABLE IF NOT EXISTS playlist_videos (
    playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    position INTEGER,
    PRIMARY KEY (playlist_id, video_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_folder_path ON videos(folder_path);
CREATE INDEX IF NOT EXISTS idx_videos_rating ON videos(rating DESC);
CREATE INDEX IF NOT EXISTS idx_videos_play_count ON videos(play_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
CREATE INDEX IF NOT EXISTS idx_folders_parent_path ON folders(parent_path);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);

-- Full text search index for video titles
CREATE INDEX IF NOT EXISTS idx_videos_title_fts ON videos USING gin(to_tsvector('english', title));

-- Function to update folder video counts
CREATE OR REPLACE FUNCTION update_folder_video_count() 
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE folders SET video_count = video_count + 1 WHERE path = NEW.folder_path;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE folders SET video_count = video_count - 1 WHERE path = OLD.folder_path;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update folder video counts
CREATE TRIGGER update_folder_count_trigger
AFTER INSERT OR DELETE ON videos
FOR EACH ROW EXECUTE FUNCTION update_folder_video_count();

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    is_edited BOOLEAN DEFAULT FALSE
);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Function to update comment updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.is_edited = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update comment timestamp on edit
CREATE TRIGGER update_comment_timestamp_trigger
BEFORE UPDATE ON comments
FOR EACH ROW
WHEN (OLD.comment_text IS DISTINCT FROM NEW.comment_text)
EXECUTE FUNCTION update_comment_timestamp();