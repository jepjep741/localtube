# LocalTube Performance Optimization Guide

This guide explains the performance optimizations implemented in LocalTube and how to configure them for your needs.

## Implemented Optimizations

### 1. Browser Caching
- **Thumbnails**: Cached for 30 days with `Cache-Control: public, max-age=2592000`
- **API responses**: Cached for 5 minutes
- **Static assets**: Cached for 1 year with immutable flag
- **ETags**: Enabled for all static resources

### 2. Lazy Loading
- **Video cards**: Only load when visible in viewport
- **Thumbnails**: Native lazy loading with `loading="lazy"`
- **Preview GIFs**: Only load on hover and when card is visible
- **Skeleton loading**: Shows placeholders while content loads

### 3. Infinite Scroll
- **Pagination**: Loads 50 videos at a time
- **Automatic loading**: Triggers when user scrolls near bottom
- **Memory efficient**: Only keeps visible videos in DOM

### 4. Database Optimization
- **Indexes**: Created on frequently queried columns
  - `folder_path` for folder navigation
  - `rating` for sort by rating
  - `play_count` for sort by views
  - `created_at` for recent videos
  - `title` for search performance

### 5. Service Worker
- **Offline support**: Caches critical resources
- **Thumbnail caching**: Stores thumbnails for offline viewing
- **Smart caching**: Different strategies for different resources

### 6. Network Optimization
- **Gzip compression**: Enabled for all text resources
- **Brotli compression**: Better compression when available
- **HTTP/2**: Supported by nginx for multiplexing

## Configuration Options

### Adjust Cache Times
Edit `backend/server.js`:
```javascript
// Change API cache time (currently 5 minutes)
res.set('Cache-Control', 'public, max-age=300');

// Change thumbnail cache time (currently 30 days)
app.use('/thumbnails', cacheMiddleware(2592000), ...);
```

### Adjust Pagination
Edit `frontend/src/pages/Home.jsx`:
```javascript
// Change items per page (default 50)
const params = { sort: sortBy, limit: 100, offset };
```

### Disable Service Worker
Remove from `frontend/src/main.jsx`:
```javascript
// Comment out or remove service worker registration
if ('serviceWorker' in navigator) {
  // ...
}
```

## Performance Tips

### 1. For Large Libraries (10,000+ videos)
- Increase pagination limit to reduce requests
- Consider implementing virtual scrolling
- Use folder structure to organize content

### 2. For Slow Networks
- Reduce thumbnail quality/size
- Enable more aggressive caching
- Consider local thumbnail generation

### 3. For Low-End Devices
- Reduce concurrent thumbnail loads
- Disable preview GIFs
- Simplify animations

### 4. Database Performance
```bash
# Vacuum database periodically
sqlite3 videos.db "VACUUM;"

# Analyze for query optimization
sqlite3 videos.db "ANALYZE;"
```

## Monitoring Performance

### Browser DevTools
1. Network tab: Check cache hits
2. Performance tab: Monitor rendering
3. Coverage tab: Find unused code

### Backend Monitoring
Add logging to track:
- API response times
- Database query times
- Thumbnail generation speed

### Cache Hit Rates
Check nginx logs for cache status:
```bash
# Add to nginx.conf
log_format cache '$remote_addr - $remote_user [$time_local] "$request" '
                 '$status $body_bytes_sent "$http_referer" '
                 '"$http_user_agent" "$upstream_cache_status"';
```

## Advanced Optimizations

### 1. CDN Integration
For multiple users, consider:
- Serving thumbnails from CDN
- Edge caching for API responses
- Geographic distribution

### 2. Redis Caching
For extreme performance:
```javascript
// Add Redis for API caching
import Redis from 'redis';
const redis = Redis.createClient();

// Cache API responses
const cached = await redis.get(cacheKey);
if (cached) return res.json(JSON.parse(cached));
```

### 3. WebP Thumbnails
Reduce bandwidth by 30%:
```javascript
// Generate WebP alongside JPEG
await sharp(inputPath)
  .resize(320, 180)
  .webp({ quality: 80 })
  .toFile(outputPath);
```

### 4. HTTP/3 Support
Latest protocol for better performance:
```nginx
# Add to nginx.conf
listen 443 http3 reuseport;
add_header Alt-Svc 'h3=":443"; ma=86400';
```

## Troubleshooting

### Slow Initial Load
- Check if service worker is caching too aggressively
- Verify database indexes are created
- Monitor thumbnail generation queue

### High Memory Usage
- Reduce pagination size
- Clear old thumbnail cache
- Implement video unloading on scroll

### Cache Not Working
- Check browser cache settings
- Verify nginx cache configuration
- Clear service worker cache

### Database Locks
- Use WAL mode for better concurrency:
```javascript
await db.exec('PRAGMA journal_mode=WAL');
```