import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function migrate() {
  console.log('Starting migration from SQLite to PostgreSQL...');
  
  // SQLite connection
  const sqliteDb = await open({
    filename: join(process.cwd(), 'videos.db'),
    driver: sqlite3.Database
  });
  
  // PostgreSQL connection
  const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'localtube',
    user: process.env.DB_USER || 'localtube',
    password: process.env.DB_PASSWORD || 'localtube',
  });
  
  try {
    // Test connections
    await sqliteDb.get('SELECT 1');
    await pgPool.query('SELECT NOW()');
    console.log('Connected to both databases');
    
    // Migrate folders
    console.log('Migrating folders...');
    const folders = await sqliteDb.all('SELECT * FROM folders');
    for (const folder of folders) {
      try {
        await pgPool.query(
          `INSERT INTO folders (path, name, parent_path, video_count, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (path) DO NOTHING`,
          [folder.path, folder.name, folder.parent_path, folder.video_count, folder.created_at]
        );
      } catch (err) {
        console.error(`Error migrating folder ${folder.path}:`, err);
      }
    }
    console.log(`Migrated ${folders.length} folders`);
    
    // Migrate videos
    console.log('Migrating videos...');
    const videos = await sqliteDb.all('SELECT * FROM videos');
    for (const video of videos) {
      try {
        const result = await pgPool.query(
          `INSERT INTO videos (filename, path, relative_path, folder_path, title, 
           duration, size, thumbnail, preview_path, created_at, last_played, 
           play_count, category, rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (path) DO UPDATE SET
           play_count = EXCLUDED.play_count,
           last_played = EXCLUDED.last_played,
           rating = EXCLUDED.rating
           RETURNING id`,
          [
            video.filename, video.path, video.relative_path, video.folder_path,
            video.title, video.duration, video.size, video.thumbnail,
            video.preview_path, video.created_at, video.last_played,
            video.play_count || 0, video.category || 'Uncategorized', video.rating || 0
          ]
        );
        
        // Update the ID mapping if needed for playlists
        if (result.rows[0]) {
          video.new_id = result.rows[0].id;
        }
      } catch (err) {
        console.error(`Error migrating video ${video.filename}:`, err);
      }
    }
    console.log(`Migrated ${videos.length} videos`);
    
    // Migrate playlists
    console.log('Migrating playlists...');
    const playlists = await sqliteDb.all('SELECT * FROM playlists');
    const playlistIdMap = {};
    
    for (const playlist of playlists) {
      try {
        const result = await pgPool.query(
          `INSERT INTO playlists (name, created_at)
           VALUES ($1, $2)
           RETURNING id`,
          [playlist.name, playlist.created_at]
        );
        playlistIdMap[playlist.id] = result.rows[0].id;
      } catch (err) {
        console.error(`Error migrating playlist ${playlist.name}:`, err);
      }
    }
    console.log(`Migrated ${playlists.length} playlists`);
    
    // Migrate playlist videos
    console.log('Migrating playlist videos...');
    const playlistVideos = await sqliteDb.all('SELECT * FROM playlist_videos');
    for (const pv of playlistVideos) {
      try {
        const video = videos.find(v => v.id === pv.video_id);
        if (video && video.new_id && playlistIdMap[pv.playlist_id]) {
          await pgPool.query(
            `INSERT INTO playlist_videos (playlist_id, video_id, position)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [playlistIdMap[pv.playlist_id], video.new_id, pv.position]
          );
        }
      } catch (err) {
        console.error('Error migrating playlist video:', err);
      }
    }
    console.log(`Migrated ${playlistVideos.length} playlist videos`);
    
    // Update sequences
    console.log('Updating sequences...');
    await pgPool.query(`
      SELECT setval('videos_id_seq', (SELECT MAX(id) FROM videos));
      SELECT setval('folders_id_seq', (SELECT MAX(id) FROM folders));
      SELECT setval('playlists_id_seq', (SELECT MAX(id) FROM playlists));
    `);
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sqliteDb.close();
    await pgPool.end();
  }
}

// Run migration
migrate().catch(console.error);