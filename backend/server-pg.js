import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const VIDEOS_DIR = process.env.VIDEOS_DIR || join(process.env.HOME, 'Videos');
const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || join(__dirname, 'thumbnails');

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'localtube',
  user: process.env.DB_USER || 'localtube',
  password: process.env.DB_PASSWORD || 'localtube',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

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

async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(Math.floor(metadata.format.duration));
    });
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
      
      // Check if folder exists
      const folderResult = await pool.query(
        'SELECT id FROM folders WHERE path = $1',
        [folderRelativePath]
      );
      
      if (folderResult.rows.length === 0) {
        await pool.query(
          'INSERT INTO folders (path, name, parent_path) VALUES ($1, $2, $3)',
          [folderRelativePath, item, relativePath || null]
        );
      }
      
      await scanFolder(itemPath, itemRelativePath);
    } else {
      const ext = item.toLowerCase().substring(item.lastIndexOf('.'));
      if (!videoExtensions.includes(ext)) continue;
      
      // Check if video exists
      const videoResult = await pool.query(
        'SELECT id FROM videos WHERE path = $1',
        [itemPath]
      );
      
      if (videoResult.rows.length > 0) continue;
      
      try {
        const duration = await getVideoDuration(itemPath);
        const result = await pool.query(
          `INSERT INTO videos (filename, path, relative_path, folder_path, title, duration, size) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [item, itemPath, itemRelativePath, relativePath || null, 
           item.replace(/\.[^/.]+$/, ''), duration, stats.size]
        );
        
        const videoId = result.rows[0].id;
        const thumbnail = await generateThumbnail(itemPath, videoId);
        const preview = await generateVideoPreview(itemPath, videoId);
        
        await pool.query(
          'UPDATE videos SET thumbnail = $1, preview_path = $2 WHERE id = $3',
          [thumbnail, preview, videoId]
        );
      } catch (error) {
        console.error(`Error processing ${item}:`, error);
      }
    }
  }
}

async function scanVideos() {
  await scanFolder(VIDEOS_DIR);
}

// API Routes
app.get('/api/videos', async (req, res) => {
  const { search, category, folder, sort, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM videos';
  let countQuery = 'SELECT COUNT(*) as total FROM videos';
  const params = [];
  const conditions = [];
  let paramIndex = 1;
  
  if (search) {
    conditions.push(`title ILIKE $${paramIndex++}`);
    params.push(`%${search}%`);
  } else if (folder !== undefined) {
    if (folder === '') {
      conditions.push('folder_path IS NULL');
    } else {
      conditions.push(`folder_path = $${paramIndex++}`);
      params.push(folder);
    }
  }
  
  if (category && category !== 'All') {
    conditions.push(`category = $${paramIndex++}`);
    params.push(category);
  }
  
  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }
  
  // Sorting options
  if (sort === 'rating') {
    query += ' ORDER BY rating DESC NULLS LAST, created_at DESC';
  } else if (sort === 'views') {
    query += ' ORDER BY play_count DESC NULLS LAST, created_at DESC';
  } else {
    query += ' ORDER BY created_at DESC';
  }
  
  // Add pagination
  query += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
  
  try {
    const [videosResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params)
    ]);
    
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      videos: videosResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.get('/api/folders', async (req, res) => {
  const { parent } = req.query;
  let query = 'SELECT * FROM folders';
  const params = [];
  
  if (parent === '') {
    query += ' WHERE parent_path IS NULL';
  } else if (parent) {
    query += ' WHERE parent_path = $1';
    params.push(parent);
  }
  
  query += ' ORDER BY name ASC';
  
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

app.get('/api/browse', async (req, res) => {
  const { path = '', sort = 'recent', limit = 50, offset = 0 } = req.query;
  
  try {
    // Fetch folders
    const foldersQuery = path === '' 
      ? 'SELECT * FROM folders WHERE parent_path IS NULL ORDER BY name ASC'
      : 'SELECT * FROM folders WHERE parent_path = $1 ORDER BY name ASC';
    
    const foldersResult = await pool.query(
      foldersQuery,
      path === '' ? [] : [path]
    );
    
    // Build video query
    let videoQuery = path === ''
      ? 'SELECT * FROM videos WHERE folder_path IS NULL'
      : 'SELECT * FROM videos WHERE folder_path = $1';
    
    let countQuery = path === ''
      ? 'SELECT COUNT(*) as total FROM videos WHERE folder_path IS NULL'
      : 'SELECT COUNT(*) as total FROM videos WHERE folder_path = $1';
    
    // Add sorting
    if (sort === 'rating') {
      videoQuery += ' ORDER BY rating DESC NULLS LAST, created_at DESC';
    } else if (sort === 'views') {
      videoQuery += ' ORDER BY play_count DESC NULLS LAST, created_at DESC';
    } else {
      videoQuery += ' ORDER BY created_at DESC';
    }
    
    videoQuery += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    
    const [videosResult, countResult] = await Promise.all([
      pool.query(videoQuery, path === '' ? [] : [path]),
      pool.query(countQuery, path === '' ? [] : [path])
    ]);
    
    // Build breadcrumbs
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
    
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ 
      folders: foldersResult.rows, 
      videos: videosResult.rows, 
      breadcrumbs, 
      currentPath: path,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error browsing:', error);
    res.status(500).json({ error: 'Failed to browse' });
  }
});

app.get('/api/video/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    await pool.query(
      'UPDATE videos SET play_count = play_count + 1, last_played = CURRENT_TIMESTAMP WHERE id = $1',
      [req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

app.get('/api/stream/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT path FROM videos WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const videoPath = result.rows[0].path;
    const stat = await fs.stat(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = createReadStream(videoPath, { start, end });
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
      createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

app.post('/api/rescan', async (req, res) => {
  try {
    await scanVideos();
    res.json({ message: 'Scan completed' });
  } catch (error) {
    console.error('Error rescanning:', error);
    res.status(500).json({ error: 'Failed to rescan' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM videos ORDER BY category');
    const categories = ['All', ...result.rows.map(row => row.category)];
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.put('/api/video/:id/category', async (req, res) => {
  const { category } = req.body;
  try {
    await pool.query('UPDATE videos SET category = $1 WHERE id = $2', [category, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.put('/api/video/:id/rating', async (req, res) => {
  const { rating } = req.body;
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }
  try {
    await pool.query('UPDATE videos SET rating = $1 WHERE id = $2', [rating, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ error: 'Failed to update rating' });
  }
});

async function init() {
  try {
    await ensureThumbnailsDir();
    
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL database');
    
    // Initialize database schema
    const schemaSQL = await fs.readFile(join(__dirname, 'database', 'schema.sql'), 'utf-8');
    await pool.query(schemaSQL);
    console.log('Database schema initialized');
    
    await scanVideos();
    
    app.listen(PORT, () => {
      console.log(`LocalTube backend running on http://localhost:${PORT}`);
      console.log(`Scanning videos from: ${VIDEOS_DIR}`);
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

init().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});