#!/bin/bash

# Set default videos directory
VIDEOS_DIR=${VIDEOS_DIR:-/home/USER/Videos}

# Create network
podman network create localtube-network 2>/dev/null || true

# Create volumes
podman volume create localtube-data 2>/dev/null || true
podman volume create localtube-thumbnails 2>/dev/null || true

# Build images
echo "Building backend image..."
podman build -t localtube-backend ./backend

echo "Building frontend image..."
podman build -t localtube-frontend ./frontend

# Stop and remove existing containers
podman stop localtube-backend 2>/dev/null || true
podman rm localtube-backend 2>/dev/null || true
podman stop localtube-frontend 2>/dev/null || true
podman rm localtube-frontend 2>/dev/null || true

# Run backend
echo "Starting backend..."
podman run -d \
  --name localtube-backend \
  --network localtube-network \
  -e NODE_ENV=production \
  -e VIDEOS_DIR=/videos \
  -e DB_PATH=/app/data/videos.db \
  -e THUMBNAILS_DIR=/app/thumbnails \
  -v "$VIDEOS_DIR:/videos:ro" \
  -v localtube-data:/app/data \
  -v localtube-thumbnails:/app/thumbnails \
  -p 3001:3001 \
  localtube-backend

# Run frontend
echo "Starting frontend..."
podman run -d \
  --name localtube-frontend \
  --network localtube-network \
  -p 3000:80 \
  localtube-frontend

echo "LocalTube is running!"
echo "Access it at http://localhost:3000"
echo ""
echo "To view logs:"
echo "  podman logs -f localtube-backend"
echo "  podman logs -f localtube-frontend"
echo ""
echo "To stop:"
echo "  podman stop localtube-backend localtube-frontend"
echo "  podman rm localtube-backend localtube-frontend"