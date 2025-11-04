#!/bin/bash

# CIFS mount configuration
CIFS_SHARE=${CIFS_SHARE:-"//server/share"}
CIFS_USERNAME=${CIFS_USERNAME:-"username"}
CIFS_PASSWORD=${CIFS_PASSWORD:-"password"}
MOUNT_POINT="/tmp/localtube-cifs-mount"
CIFS_OPTIONS="username=$CIFS_USERNAME,password=$CIFS_PASSWORD,uid=$(id -u),gid=$(id -g),file_mode=0755,dir_mode=0755"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}LocalTube CIFS Mount Setup${NC}"
echo "================================"

# Check if cifs-utils is installed
if ! command -v mount.cifs &> /dev/null; then
    echo -e "${RED}Error: cifs-utils is not installed${NC}"
    echo "Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install cifs-utils"
    echo "  RHEL/Fedora: sudo dnf install cifs-utils"
    exit 1
fi

# Create mount point if it doesn't exist
if [ ! -d "$MOUNT_POINT" ]; then
    echo "Creating mount point at $MOUNT_POINT"
    mkdir -p "$MOUNT_POINT"
fi

# Check if already mounted
if mountpoint -q "$MOUNT_POINT"; then
    echo -e "${GREEN}CIFS share already mounted at $MOUNT_POINT${NC}"
else
    echo "Mounting CIFS share: $CIFS_SHARE"
    echo "Mount point: $MOUNT_POINT"
    
    # Mount the CIFS share
    sudo mount -t cifs "$CIFS_SHARE" "$MOUNT_POINT" -o "$CIFS_OPTIONS"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Successfully mounted CIFS share${NC}"
    else
        echo -e "${RED}Failed to mount CIFS share${NC}"
        echo "Please check your CIFS credentials and share path"
        exit 1
    fi
fi

# Set the videos directory to the mount point
export VIDEOS_DIR="$MOUNT_POINT"

# Create network
podman network create localtube-network 2>/dev/null || true

# Create volumes
podman volume create localtube-data 2>/dev/null || true
podman volume create localtube-thumbnails 2>/dev/null || true

# Build images
echo -e "\n${YELLOW}Building container images...${NC}"
podman build -t localtube-backend ./backend
podman build -t localtube-frontend ./frontend

# Stop and remove existing containers
podman stop localtube-backend 2>/dev/null || true
podman rm localtube-backend 2>/dev/null || true
podman stop localtube-frontend 2>/dev/null || true
podman rm localtube-frontend 2>/dev/null || true

# Run backend with CIFS mount
echo -e "\n${YELLOW}Starting backend...${NC}"
podman run -d \
  --name localtube-backend \
  --network localtube-network \
  -e NODE_ENV=production \
  -e VIDEOS_DIR=/videos \
  -e DB_PATH=/app/data/videos.db \
  -e THUMBNAILS_DIR=/app/thumbnails \
  -v "$MOUNT_POINT:/videos:ro" \
  -v localtube-data:/app/data \
  -v localtube-thumbnails:/app/thumbnails \
  -p 3001:3001 \
  --security-opt label=disable \
  localtube-backend

# Run frontend
echo -e "\n${YELLOW}Starting frontend...${NC}"
podman run -d \
  --name localtube-frontend \
  --network localtube-network \
  -p 3000:80 \
  localtube-frontend

echo -e "\n${GREEN}LocalTube is running!${NC}"
echo "Access it at http://localhost:3000"
echo "CIFS share mounted from: $CIFS_SHARE"
echo ""
echo "To view logs:"
echo "  podman logs -f localtube-backend"
echo "  podman logs -f localtube-frontend"
echo ""
echo "To stop:"
echo "  podman stop localtube-backend localtube-frontend"
echo "  podman rm localtube-backend localtube-frontend"
echo ""
echo "To unmount CIFS share:"
echo "  sudo umount $MOUNT_POINT"