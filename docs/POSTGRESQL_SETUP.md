# PostgreSQL Setup for LocalTube

LocalTube now supports PostgreSQL as an alternative to SQLite for better performance, scalability, and concurrent access.

## Benefits of PostgreSQL

1. **Better Performance**: Optimized for large datasets and concurrent queries
2. **Full-Text Search**: Native support for advanced text search
3. **Connection Pooling**: Handle multiple concurrent users efficiently
4. **ACID Compliance**: Reliable transactions and data integrity
5. **Advanced Indexes**: Better query optimization
6. **Scalability**: Can handle millions of videos

## Quick Start

### Option 1: Using the Run Script (Recommended)

```bash
./run-podman-postgres.sh
```

This will:
- Start PostgreSQL database
- Initialize the schema
- Start the backend with PostgreSQL support
- Start the frontend
- Optionally start pgAdmin for database management

### Option 2: Using Docker Compose

```bash
docker-compose -f docker-compose-postgres.yml up -d
```

### Option 3: Manual Setup

1. Install PostgreSQL:
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# Fedora/RHEL
sudo dnf install postgresql postgresql-server

# macOS
brew install postgresql
```

2. Create database and user:
```sql
CREATE DATABASE localtube;
CREATE USER localtube WITH PASSWORD 'localtube123';
GRANT ALL PRIVILEGES ON DATABASE localtube TO localtube;
```

3. Set environment variables:
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=localtube
export DB_USER=localtube
export DB_PASSWORD=localtube123
```

4. Run the PostgreSQL backend:
```bash
cd backend
npm install
node server-pg.js
```

## Migration from SQLite

If you have an existing SQLite database, you can migrate your data:

```bash
cd backend
npm run migrate
```

This will:
- Copy all videos, folders, playlists, and metadata
- Preserve play counts and ratings
- Maintain folder structure
- Keep all thumbnails and previews

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=localtube
DB_USER=localtube
DB_PASSWORD=your_secure_password

# Application
VIDEOS_DIR=/path/to/videos
PORT=3001
```

### Connection Pool Settings

The backend uses a connection pool with these defaults:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

Adjust in `server-pg.js` if needed:

```javascript
const pool = new Pool({
  max: 50,  // Increase for high traffic
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
});
```

## Database Management

### Using pgAdmin

Access pgAdmin at http://localhost:5050

Default credentials:
- Email: admin@localtube.local
- Password: admin

Add server connection:
- Host: localtube-postgres
- Port: 5432
- Username: localtube
- Password: localtube123

### Useful Queries

Check database size:
```sql
SELECT pg_database_size('localtube');
```

Video statistics:
```sql
SELECT 
  COUNT(*) as total_videos,
  SUM(size) / 1073741824 as total_gb,
  AVG(duration) / 60 as avg_duration_min
FROM videos;
```

Most watched videos:
```sql
SELECT title, play_count, rating 
FROM videos 
ORDER BY play_count DESC 
LIMIT 20;
```

### Backup and Restore

Backup:
```bash
podman exec localtube-postgres pg_dump -U localtube localtube > backup.sql
```

Restore:
```bash
podman exec -i localtube-postgres psql -U localtube localtube < backup.sql
```

## Performance Tuning

### PostgreSQL Configuration

For large libraries, optimize PostgreSQL:

```sql
-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '256MB';

-- Optimize for SSD
ALTER SYSTEM SET random_page_cost = 1.1;

-- Increase work memory
ALTER SYSTEM SET work_mem = '10MB';
```

### Indexes

The schema includes optimized indexes:
- Full-text search on titles
- B-tree indexes on frequently queried columns
- Partial indexes for NULL values

### Vacuum and Analyze

Schedule regular maintenance:
```bash
# Vacuum and analyze
podman exec localtube-postgres vacuumdb -U localtube -d localtube -z

# Reindex for optimal performance
podman exec localtube-postgres reindexdb -U localtube -d localtube
```

## Troubleshooting

### Connection Issues

Check PostgreSQL is running:
```bash
podman ps | grep postgres
podman logs localtube-postgres
```

Test connection:
```bash
podman exec localtube-postgres pg_isready -U localtube
```

### Performance Issues

Enable query logging:
```sql
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
```

Check slow queries:
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Disk Space

Monitor disk usage:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Advanced Features

### Full-Text Search

PostgreSQL version includes enhanced search:
```sql
-- Search with ranking
SELECT title, ts_rank(to_tsvector('english', title), query) AS rank
FROM videos, to_tsquery('english', 'search & terms') query
WHERE to_tsvector('english', title) @@ query
ORDER BY rank DESC;
```

### JSON Support

Store additional metadata:
```sql
ALTER TABLE videos ADD COLUMN metadata JSONB;

-- Query JSON data
SELECT * FROM videos 
WHERE metadata->>'codec' = 'h264';
```

### Partitioning

For very large libraries (100k+ videos):
```sql
-- Partition by year
CREATE TABLE videos_2024 PARTITION OF videos
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```