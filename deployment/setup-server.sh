#!/bin/bash

##############################################
# Moadamda Analytics - Server Setup Script
# Naver Cloud Platform (Ubuntu 24.04)
# Server IP: 211.188.53.220
##############################################

echo "================================================"
echo "Moadamda Analytics Server Setup"
echo "================================================"
echo ""

# Update system packages
echo "[1/6] Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
echo ""
echo "[2/6] Installing Docker..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose standalone (v2)
echo ""
echo "[3/6] Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
echo ""
echo "[4/6] Installing Git..."
sudo apt-get install -y git

# Install useful tools
echo ""
echo "[5/6] Installing useful tools..."
sudo apt-get install -y htop vim curl wget unzip

# Configure firewall (ufw)
echo ""
echo "[6/6] Configuring firewall..."
sudo ufw --force enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3003/tcp  # Backend (temporary)
sudo ufw allow 3030/tcp  # Frontend (temporary)
sudo ufw reload

# Create project directory
echo ""
echo "Creating project directory..."
mkdir -p ~/moadamda-analytics
cd ~/moadamda-analytics

# Display versions
echo ""
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo ""
echo "Installed versions:"
echo "- Docker: $(docker --version)"
echo "- Docker Compose: $(docker-compose --version)"
echo "- Git: $(git --version)"
echo ""
echo "Server Info:"
echo "- Public IP: 211.188.53.220"
echo "- Project Directory: ~/moadamda-analytics"
echo ""
echo "Next steps:"
echo "1. Upload project files to ~/moadamda-analytics"
echo "2. Create .env.production files"
echo "3. Run: docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "================================================"
echo "⚠️  IMPORTANT: Please logout and login again"
echo "   to apply Docker group permissions!"
echo "================================================"

