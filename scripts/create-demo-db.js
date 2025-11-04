import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createDemoDatabase() {
  console.log('Creating demo database...');
  
  const db = await open({
    filename: join(__dirname, '../data/demo.db'),
    driver: sqlite3.Database
  });

  // Create tables
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
  `);

  // Insert demo folders
  const folders = [
    { path: 'Movies', name: 'Movies', parent_path: null },
    { path: 'TV Shows', name: 'TV Shows', parent_path: null },
    { path: 'Documentaries', name: 'Documentaries', parent_path: null },
    { path: 'Music Videos', name: 'Music Videos', parent_path: null },
  ];

  for (const folder of folders) {
    await db.run(
      'INSERT INTO folders (path, name, parent_path) VALUES (?, ?, ?)',
      [folder.path, folder.name, folder.parent_path]
    );
  }

  // Insert demo videos
  const demoVideos = [
    {
      filename: 'sample_movie_1.mp4',
      path: '/videos/Movies/sample_movie_1.mp4',
      relative_path: 'Movies/sample_movie_1.mp4',
      folder_path: 'Movies',
      title: 'Sample Movie 1',
      duration: 7200,
      size: 1073741824,
      play_count: 45,
      rating: 5,
      category: 'Action'
    },
    {
      filename: 'sample_movie_2.mp4',
      path: '/videos/Movies/sample_movie_2.mp4',
      relative_path: 'Movies/sample_movie_2.mp4',
      folder_path: 'Movies',
      title: 'Sample Movie 2',
      duration: 6300,
      size: 805306368,
      play_count: 23,
      rating: 4,
      category: 'Comedy'
    },
    {
      filename: 'documentary_nature.mp4',
      path: '/videos/Documentaries/documentary_nature.mp4',
      relative_path: 'Documentaries/documentary_nature.mp4',
      folder_path: 'Documentaries',
      title: 'Nature Documentary',
      duration: 3600,
      size: 536870912,
      play_count: 67,
      rating: 5,
      category: 'Documentary'
    },
    {
      filename: 'tv_show_s01e01.mp4',
      path: '/videos/TV Shows/tv_show_s01e01.mp4',
      relative_path: 'TV Shows/tv_show_s01e01.mp4',
      folder_path: 'TV Shows',
      title: 'TV Show S01E01',
      duration: 2700,
      size: 402653184,
      play_count: 89,
      rating: 4,
      category: 'TV Series'
    },
    {
      filename: 'music_video_1.mp4',
      path: '/videos/Music Videos/music_video_1.mp4',
      relative_path: 'Music Videos/music_video_1.mp4',
      folder_path: 'Music Videos',
      title: 'Music Video 1',
      duration: 240,
      size: 67108864,
      play_count: 156,
      rating: 3,
      category: 'Music'
    }
  ];

  for (const video of demoVideos) {
    const result = await db.run(
      `INSERT INTO videos (filename, path, relative_path, folder_path, title, 
       duration, size, thumbnail, preview_path, play_count, rating, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        video.filename, video.path, video.relative_path, video.folder_path,
        video.title, video.duration, video.size,
        `/thumbnails/${video.filename}.jpg`,
        `/thumbnails/${video.filename}_preview.gif`,
        video.play_count, video.rating, video.category
      ]
    );

    // Add some demo comments
    if (result.lastID <= 3) {
      await db.run(
        `INSERT INTO comments (video_id, author_name, comment_text)
         VALUES (?, ?, ?)`,
        [result.lastID, 'Demo User', 'Great video! Really enjoyed watching this.']
      );

      await db.run(
        `INSERT INTO comments (video_id, author_name, comment_text)
         VALUES (?, ?, ?)`,
        [result.lastID, 'Another User', 'Thanks for sharing!']
      );
    }
  }

  // Update folder counts
  await db.exec(`
    UPDATE folders 
    SET video_count = (
      SELECT COUNT(*) FROM videos WHERE folder_path = folders.path
    )
  `);

  console.log('Demo database created successfully!');
  await db.close();
}

createDemoDatabase().catch(console.error);