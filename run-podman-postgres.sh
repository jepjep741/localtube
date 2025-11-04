#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}LocalTube PostgreSQL Setup${NC}"
echo "================================"

# Set default environment variables
export VIDEOS_DIR=${VIDEOS_DIR:-"/home/USER/Videos"}
export DB_PASSWORD=${DB_PASSWORD:-"localtube123"}
export PGADMIN_EMAIL=${PGADMIN_EMAIL:-"admin@localtube.local"}
export PGADMIN_PASSWORD=${PGADMIN_PASSWORD:-"admin"}

# Create network
echo "Creating network..."
podman network create localtube-network 2>/dev/null || true

# Create volumes
echo "Creating volumes..."
podman volume create postgres-data 2>/dev/null || true
podman volume create localtube-thumbnails 2>/dev/null || true
podman volume create pgadmin-data 2>/dev/null || true

# Stop and remove existing containers
echo "Cleaning up existing containers..."
podman stop localtube-postgres localtube-backend localtube-frontend localtube-pgadmin 2>/dev/null || true
podman rm localtube-postgres localtube-backend localtube-frontend localtube-pgadmin 2>/dev/null || true

# Start PostgreSQL
echo -e "\n${YELLOW}Starting PostgreSQL...${NC}"
podman run -d \
  --name localtube-postgres \
  --network localtube-network \
  -e POSTGRES_DB=localtube \
  -e POSTGRES_USER=localtube \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -v postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  --health-cmd="pg_isready -U localtube" \
  --health-interval=10s \
  --health-timeout=5s \
  --health-retries=5 \
  postgres:15-alpine

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if podman exec localtube-postgres pg_isready -U localtube >/dev/null 2>&1; then
    echo -e "${GREEN}PostgreSQL is ready!${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

# Build backend image
echo -e "\n${YELLOW}Building backend image...${NC}"
podman build -t localtube-backend-pg -f backend/Dockerfile.postgres ./backend

# Build frontend image
echo -e "\n${YELLOW}Building frontend image...${NC}"
podman build -t localtube-frontend ./frontend

# Run backend
echo -e "\n${YELLOW}Starting backend...${NC}"
podman run -d \
  --name localtube-backend \
  --network localtube-network \
  -e NODE_ENV=production \
  -e VIDEOS_DIR=/videos \
  -e DB_HOST=localtube-postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=localtube \
  -e DB_USER=localtube \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -v "$VIDEOS_DIR:/videos:ro" \
  -v localtube-thumbnails:/app/thumbnails \
  -p 3001:3001 \
  --security-opt label=disable \
  localtube-backend-pg

# Run frontend
echo -e "\n${YELLOW}Starting frontend...${NC}"
podman run -d \
  --name localtube-frontend \
  --network localtube-network \
  -p 3000:80 \
  localtube-frontend

# Optional: Start pgAdmin
echo -e "\n${YELLOW}Starting pgAdmin (optional)...${NC}"
podman run -d \
  --name localtube-pgadmin \
  --network localtube-network \
  -e PGADMIN_DEFAULT_EMAIL="$PGADMIN_EMAIL" \
  -e PGADMIN_DEFAULT_PASSWORD="$PGADMIN_PASSWORD" \
  -v pgadmin-data:/var/lib/pgadmin \
  -p 5050:80 \
  dpage/pgadmin4:latest

echo -e "\n${GREEN}LocalTube with PostgreSQL is running!${NC}"
echo "================================"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:3001"
echo "PostgreSQL: localhost:5432 (user: localtube, password: $DB_PASSWORD)"
echo "pgAdmin: http://localhost:5050 (login: $PGADMIN_EMAIL / $PGADMIN_PASSWORD)"
echo ""
echo "To view logs:"
echo "  podman logs -f localtube-backend"
echo "  podman logs -f localtube-postgres"
echo ""
echo "To migrate from SQLite:"
echo "  cd backend && npm run migrate"
echo ""
echo "To stop all services:"
echo "  podman stop localtube-postgres localtube-backend localtube-frontend localtube-pgadmin"
echo "  podman rm localtube-postgres localtube-backend localtube-frontend localtube-pgadmin"