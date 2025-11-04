#!/bin/bash

##############################################
# Moadamda Analytics - Deployment Script
# Naver Cloud Platform (Ubuntu 24.04)
# Server IP: 211.188.53.220
##############################################

echo "================================================"
echo "Moadamda Analytics Deployment"
echo "================================================"
echo ""

# Check if running in project directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Error: docker-compose.prod.yml not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if .env.production files exist
if [ ! -f "backend/.env.production" ]; then
    echo "⚠️  Warning: backend/.env.production not found!"
    echo "Creating from template..."
    cp deployment/env-backend-production.txt backend/.env.production
    echo "⚠️  Please edit backend/.env.production and update DB_PASSWORD!"
    read -p "Press Enter to continue after editing..."
fi

if [ ! -f "frontend/.env.production" ]; then
    echo "⚠️  Warning: frontend/.env.production not found!"
    echo "Creating from template..."
    cp deployment/env-frontend-production.txt frontend/.env.production
fi

# Stop existing containers
echo ""
echo "[1/5] Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Remove old frontend build
echo ""
echo "[2/5] Cleaning old frontend build..."
rm -rf frontend/dist
rm -rf frontend/node_modules/.vite
rm -rf frontend/.vite

# Build frontend
echo ""
echo "[3/5] Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build and start containers
echo ""
echo "[4/5] Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "[5/5] Starting containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo ""
echo "Waiting for services to start..."
sleep 10

# Check container status
echo ""
echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

# Display logs
echo ""
echo "Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

# Check if services are healthy
echo ""
echo "================================================"
echo "Deployment Complete!"
echo "================================================"
echo ""
echo "Service URLs:"
echo "- Frontend: http://211.188.53.220:3030"
echo "- Backend:  http://211.188.53.220:3003/health"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose -f docker-compose.prod.yml down"
echo ""
echo "================================================"

