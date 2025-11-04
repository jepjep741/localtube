import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const VIDEOS_DIR = process.env.VIDEOS_DIR || join(process.env.HOME, 'Videos');
const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || join(__dirname, 'thumbnails');
const DB_PATH = process.env.DB_PATH || join(__dirname, 'videos.db');

app.use(cors());
app.use(express.json());

// Cache middleware for static assets
const cacheMiddleware = (maxAge) => (req, res, next) => {
  res.set({
    'Cache-Control': `public, max-age=${maxAge}`,
    'X-Content-Type-Options': 'nosniff'
  });
  next();
};

// Serve thumbnails with aggressive caching (30 days)
app.use('/thumbnails', cacheMiddleware(2592000), express.static(THUMBNAILS_DIR, {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.jpg')) {
      res.set('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.gif')) {
      res.set('Content-Type', 'image/gif');
    }
  }
}));

let db;

async function initDB() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      relative_path TEXT,
      folder_path TEXT,
      title TEXT NOT NULL,
      duration INTEGER,
      size INTEGER,
      thumbnail TEXT,
      preview_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_played DATETIME,
      play_count INTEGER DEFAULT 0,
      category TEXT DEFAULT 'Uncategorized',
      rating INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      parent_path TEXT,
      video_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlist_videos (
      playlist_id INTEGER,
      video_id INTEGER,
      position INTEGER,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id),
      FOREIGN KEY (video_id) REFERENCES videos(id),
      PRIMARY KEY (playlist_id, video_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      comment_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      parent_id INTEGER,
      is_edited INTEGER DEFAULT 0,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
    CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
  `);

  // Add new columns if they don't exist (for migration)
  try {
    await db.exec(`ALTER TABLE videos ADD COLUMN relative_path TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE videos ADD COLUMN folder_path TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE videos ADD COLUMN preview_path TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE videos ADD COLUMN rating INTEGER DEFAULT 0`);
  } catch (e) {}
  
  // Create indexes for better performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_folder_path ON videos(folder_path);
    CREATE INDEX IF NOT EXISTS idx_videos_rating ON videos(rating DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_play_count ON videos(play_count DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);
    CREATE INDEX IF NOT EXISTS idx_folders_parent_path ON folders(parent_path);
  `);
}

async function ensureThumbnailsDir() {
  if (!existsSync(THUMBNAILS_DIR)) {
    await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
  }
}

async function generateThumbnail(videoPath, videoId) {
  const thumbnailPath = join(THUMBNAILS_DIR, `${videoId}.jpg`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['10%'],
        filename: `${videoId}.jpg`,
        folder: THUMBNAILS_DIR,
        size: '320x180'
      })
      .on('end', () => resolve(`/thumbnails/${videoId}.jpg`))
      .on('error', reject);
  });
}

async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(Math.floor(metadata.format.duration));
    });
  });
}

async function generateVideoPreview(videoPath, videoId) {
  const previewPath = join(THUMBNAILS_DIR, `${videoId}_preview.gif`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-ss 5',
        '-t 3',
        '-vf scale=320:-1,fps=10',
        '-loop 0'
      ])
      .output(previewPath)
      .on('end', () => resolve(`/thumbnails/${videoId}_preview.gif`))
      .on('error', (err) => {
        console.error('Preview generation error:', err);
        resolve(null);
      })
      .run();
  });
}

async function scanFolder(folderPath, relativePath = '') {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
  const items = await fs.readdir(folderPath);
  
  for (const item of items) {
    const itemPath = join(folderPath, item);
    const itemRelativePath = relativePath ? join(relativePath, item) : item;
    const stats = await fs.stat(itemPath);
    
    if (stats.isDirectory()) {
      const folderRelativePath = itemRelativePath;
      const existing = await db.get('SELECT id FROM folders WHERE path = ?', folderRelativePath);
      
      if (!existing) {
        await db.run(
          'INSERT INTO folders (path, name, parent_path) VALUES (?, ?, ?)',
          folderRelativePath, item, relativePath || null
        );
      }
      
      await scanFolder(itemPath, itemRelativePath);
    } else {
      const ext = item.toLowerCase().substring(item.lastIndexOf('.'));
      if (!videoExtensions.includes(ext)) continue;
      
      const existing = await db.get('SELECT id FROM videos WHERE path = ?', itemPath);
      if (existing) continue;
      
      try {
        const duration = await getVideoDuration(itemPath);
        const result = await db.run(
          'INSERT INTO videos (filename, path, relative_path, folder_path, title, duration, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
          item, itemPath, itemRelativePath, relativePath || null, item.replace(/\.[^/.]+$/, ''), duration, stats.size
        );
        
        const thumbnail = await generateThumbnail(itemPath, result.lastID);
        const preview = await generateVideoPreview(itemPath, result.lastID);
        await db.run('UPDATE videos SET thumbnail = ?, preview_path = ? WHERE id = ?', thumbnail, preview, result.lastID);
        
        if (relativePath) {
          await db.run('UPDATE folders SET video_count = video_count + 1 WHERE path = ?', relativePath);
        }
      } catch (error) {
        console.error(`Error processing ${item}:`, error);
      }
    }
  }
}

async function scanVideos() {
  await scanFolder(VIDEOS_DIR);
}

app.get('/api/videos', async (req, res) => {
  const { search, category, folder, sort, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM videos';
  let countQuery = 'SELECT COUNT(*) as total FROM videos';
  const params = [];
  const conditions = [];
  
  if (search) {
    conditions.push('title LIKE ?');
    params.push(`%${search}%`);
  } else if (folder !== undefined) {
    if (folder === '') {
      conditions.push('folder_path IS NULL');
    } else {
      conditions.push('folder_path = ?');
      params.push(folder);
    }
  }
  
  if (category && category !== 'All') {
    conditions.push('category = ?');
    params.push(category);
  }
  
  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }
  
  // Sorting options
  if (sort === 'rating') {
    query += ' ORDER BY rating DESC, created_at DESC';
  } else if (sort === 'views') {
    query += ' ORDER BY play_count DESC, created_at DESC';
  } else {
    query += ' ORDER BY created_at DESC';
  }
  
  // Add pagination
  query += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
  
  const [videos, countResult] = await Promise.all([
    db.all(query, params),
    db.get(countQuery, params)
  ]);
  
  // Cache for 5 minutes
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    videos,
    total: countResult.total,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
});

app.get('/api/folders', async (req, res) => {
  const { parent } = req.query;
  let query = 'SELECT * FROM folders';
  const params = [];
  
  if (parent === '') {
    query += ' WHERE parent_path IS NULL';
  } else if (parent) {
    query += ' WHERE parent_path = ?';
    params.push(parent);
  }
  
  query += ' ORDER BY name ASC';
  
  const folders = await db.all(query, params);
  res.json(folders);
});

app.get('/api/browse', async (req, res) => {
  const { path = '', sort = 'recent', limit = 50, offset = 0 } = req.query;
  
  const folders = await db.all(
    path === '' 
      ? 'SELECT * FROM folders WHERE parent_path IS NULL ORDER BY name ASC'
      : 'SELECT * FROM folders WHERE parent_path = ? ORDER BY name ASC',
    path === '' ? [] : [path]
  );
  
  let videoQuery = path === ''
    ? 'SELECT * FROM videos WHERE folder_path IS NULL'
    : 'SELECT * FROM videos WHERE folder_path = ?';
  
  let countQuery = path === ''
    ? 'SELECT COUNT(*) as total FROM videos WHERE folder_path IS NULL'
    : 'SELECT COUNT(*) as total FROM videos WHERE folder_path = ?';
  
  // Add sorting
  if (sort === 'rating') {
    videoQuery += ' ORDER BY rating DESC, created_at DESC';
  } else if (sort === 'views') {
    videoQuery += ' ORDER BY play_count DESC, created_at DESC';
  } else {
    videoQuery += ' ORDER BY created_at DESC';
  }
  
  // Add pagination
  videoQuery += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
  
  const [videos, countResult] = await Promise.all([
    db.all(videoQuery, path === '' ? [] : [path]),
    db.get(countQuery, path === '' ? [] : [path])
  ]);
  
  const breadcrumbs = [];
  if (path) {
    const parts = path.split('/');
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      breadcrumbs.push({
        name: part,
        path: currentPath
      });
    }
  }
  
  // Cache for 5 minutes
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ 
    folders, 
    videos, 
    breadcrumbs, 
    currentPath: path,
    total: countResult.total,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
});

app.get('/api/video/:id', async (req, res) => {
  const video = await db.get('SELECT * FROM videos WHERE id = ?', req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  
  await db.run('UPDATE videos SET play_count = play_count + 1, last_played = CURRENT_TIMESTAMP WHERE id = ?', req.params.id);
  res.json(video);
});

app.get('/api/stream/:id', async (req, res) => {
  const video = await db.get('SELECT path FROM videos WHERE id = ?', req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  
  const stat = await fs.stat(video.path);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = createReadStream(video.path, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    createReadStream(video.path).pipe(res);
  }
});

app.post('/api/rescan', async (req, res) => {
  await scanVideos();
  res.json({ message: 'Scan completed' });
});

app.get('/api/categories', async (req, res) => {
  const categories = await db.all('SELECT DISTINCT category FROM videos');
  res.json(['All', ...categories.map(c => c.category)]);
});

app.put('/api/video/:id/category', async (req, res) => {
  const { category } = req.body;
  await db.run('UPDATE videos SET category = ? WHERE id = ?', category, req.params.id);
  res.json({ success: true });
});

app.put('/api/video/:id/rating', async (req, res) => {
  const { rating } = req.body;
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  await db.run('UPDATE videos SET rating = ? WHERE id = ?', rating, req.params.id);
  res.json({ success: true });
});

// Comments endpoints
app.get('/api/video/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  const comments = await db.all(`
    SELECT c.*, 
           (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) as reply_count
    FROM comments c
    WHERE c.video_id = ? AND c.parent_id IS NULL
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `, [id, limit, offset]);
  
  const total = await db.get(
    'SELECT COUNT(*) as count FROM comments WHERE video_id = ? AND parent_id IS NULL',
    id
  );
  
  res.json({ comments, total: total.count });
});

// Get replies for a comment
app.get('/api/comments/:id/replies', async (req, res) => {
  const { id } = req.params;
  const replies = await db.all(`
    SELECT * FROM comments
    WHERE parent_id = ?
    ORDER BY created_at ASC
  `, id);
  
  res.json(replies);
});

// Post a new comment
app.post('/api/video/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { author_name, comment_text, parent_id } = req.body;
  
  if (!author_name || !comment_text) {
    return res.status(400).json({ error: 'Author name and comment text are required' });
  }
  
  const result = await db.run(`
    INSERT INTO comments (video_id, author_name, comment_text, parent_id)
    VALUES (?, ?, ?, ?)
  `, [id, author_name, comment_text, parent_id || null]);
  
  const newComment = await db.get(
    'SELECT * FROM comments WHERE id = ?',
    result.lastID
  );
  
  res.json(newComment);
});

// Update a comment
app.put('/api/comments/:id', async (req, res) => {
  const { id } = req.params;
  const { comment_text } = req.body;
  
  if (!comment_text) {
    return res.status(400).json({ error: 'Comment text is required' });
  }
  
  await db.run(`
    UPDATE comments 
    SET comment_text = ?, updated_at = datetime('now'), is_edited = 1
    WHERE id = ?
  `, [comment_text, id]);
  
  const updatedComment = await db.get(
    'SELECT * FROM comments WHERE id = ?',
    id
  );
  
  res.json(updatedComment);
});

// Delete a comment
app.delete('/api/comments/:id', async (req, res) => {
  const { id } = req.params;
  await db.run('DELETE FROM comments WHERE id = ?', id);
  res.json({ success: true });
});

async function init() {
  await ensureThumbnailsDir();
  await initDB();
  await scanVideos();
  
  app.listen(PORT, () => {
    console.log(`LocalTube backend running on http://localhost:${PORT}`);
    console.log(`Scanning videos from: ${VIDEOS_DIR}`);
  });
}

init().catch(console.error);