# LocalTube

A self-hosted video streaming platform for your local video collection.

## Features

- 📁 Automatic video scanning and organization
- 🎬 Web-based video player with streaming support
- 🔍 Search and filter videos
- ⭐ Rate videos (1-5 stars)
- 💬 Comment system with threaded replies
- 📊 Sort by recent, top-rated, or most viewed
- 📱 Responsive design for mobile and desktop
- 🗂️ Folder-based organization
- 🎨 Dark theme UI
- 🖼️ Automatic thumbnail generation
- 🎭 Animated preview GIFs
- 🏷️ Category management

## Tech Stack

- **Backend**: Node.js, Express, SQLite/PostgreSQL
- **Frontend**: React, Vite
- **Video Processing**: FFmpeg, ImageMagick
- **Containerization**: Docker/Podman

## Quick Start

### Using Docker/Podman

1. Clone the repository:
   ```bash
   git clone https://github.com/jepjep741/localtube.git
   cd localtube
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set your videos directory:
   ```bash
   VIDEOS_DIR=/path/to/your/videos
   ```

4. Start the containers:
   ```bash
   # Using Docker
   docker-compose up -d

   # Using Podman
   podman-compose up -d
   ```

5. Access LocalTube at http://localhost:3000

### Manual Installation

1. Install dependencies:
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

2. Install system dependencies:
   - FFmpeg
   - ImageMagick

3. Set environment variables:
   ```bash
   export VIDEOS_DIR=/path/to/your/videos
   ```

4. Start the services:
   ```bash
   # Backend (in backend directory)
   npm start

   # Frontend (in frontend directory)
   npm run dev
   ```

## Configuration

### Environment Variables

- `VIDEOS_DIR`: Path to your video directory (default: ~/Videos)
- `PORT`: Backend server port (default: 3001)
- `DB_PATH`: SQLite database path (default: ./data/videos.db)
- `THUMBNAILS_DIR`: Thumbnail storage directory (default: ./thumbnails)

### Database Options

LocalTube supports both SQLite (default) and PostgreSQL:

- **SQLite**: No configuration needed, works out of the box
- **PostgreSQL**: Use `docker-compose-postgres.yml` for PostgreSQL support

## Usage

1. **Scanning Videos**: Videos are automatically scanned on startup
2. **Manual Rescan**: Click the rescan button or POST to `/api/rescan`
3. **Rating Videos**: Click the stars below the video player
4. **Comments**: Scroll below the video to add comments
5. **Categories**: Click the category tag to edit video categories

## API Endpoints

- `GET /api/videos` - List videos with pagination
- `GET /api/video/:id` - Get video details
- `GET /api/stream/:id` - Stream video
- `POST /api/rescan` - Rescan video directory
- `GET /api/categories` - List all categories
- `PUT /api/video/:id/rating` - Update video rating
- `GET /api/video/:id/comments` - Get video comments
- `POST /api/video/:id/comments` - Add comment

## Supported Video Formats

- MP4
- WebM
- MOV
- AVI
- MKV
- M4V

## License

MIT License

## Contributing

Pull requests are welcome! Please feel free to submit a Pull Request.
