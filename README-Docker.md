# Docker Setup for Robot Audio Recorder

This document explains how to run the Robot Audio Recorder application using Docker and Docker Compose.

## 🐳 Docker Compose Configurations

The setup provides multiple ways to run the application:

### 1. **Separate Services** (Recommended for Production)
Runs web application and headless browser in separate containers:

```bash
# Run web application only
docker-compose up web-app

# Run both web app and headless browser
docker-compose --profile headless up
```

### 2. **Combined Service** (Simpler for Development)
Runs both web app and headless browser in a single container:

```bash
# Run combined service
docker-compose --profile combined up combined
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Copy and configure environment file:

```bash
# Copy the Docker environment template
cp docker.env .env

# Edit .env with your OpenVidu server settings
nano .env
```

### Option 1: Web Application Only
Perfect for manual testing via browser:

```bash
docker-compose up web-app
```

Then visit: http://localhost:8080

### Option 2: Full Automated Setup (Web App + Headless Browser)

```bash
# Build and start both services
docker-compose --profile headless up --build

# Or run in background
docker-compose --profile headless up -d --build
```

### Option 3: Combined Service (All-in-One)

```bash
# Run everything in one container
docker-compose --profile combined up combined --build
```

## 📋 Service Descriptions

### `web-app` Service
- **Purpose**: Serves the web interface and acts as CORS proxy
- **Command**: `node simple-proxy.js`
- **Port**: 8080
- **Access**: http://localhost:8080

### `headless-browser` Service
- **Purpose**: Automated browser that connects to the web app
- **Command**: `node headless-launcher.js`
- **Depends on**: `web-app` service
- **Internal URL**: `http://web-app:8080`

### `combined` Service
- **Purpose**: Runs both web app and headless browser in one container
- **Command**: Starts proxy server, then launches headless browser
- **Port**: 8080

## 🔧 Configuration

### Environment Variables

Key variables you should configure in `.env`:

```bash
# Robot identification
ROBOT_ID=robot-docker-001
SESSION_NAME=DockerSession

# OpenVidu server (update these!)
OPENVIDU_SERVER_URL=https://your-openvidu-server.com
OPENVIDU_SERVER_SECRET=your_secret_here

# Headless browser settings
ENABLE_LOGGING=true
KEEP_ALIVE=true
MAX_RECONNECT_ATTEMPTS=10
```

### Volume Mounts

- `./logs:/app/logs` - Application logs
- `./.env:/app/.env:ro` - Environment configuration (read-only)

## 📊 Monitoring and Logs

### View Logs
```bash
# View logs from all services
docker-compose --profile headless logs -f

# View logs from specific service
docker-compose logs -f web-app
docker-compose logs -f headless-browser

# View logs from combined service
docker-compose --profile combined logs -f combined
```

### Health Checks
The web-app service includes health checks that monitor the `/health` endpoint.

### Log Files
Application logs are saved to `./logs/` directory on the host.

## 🛠️ Development

### Development Mode
Use the override file for development with hot-reload:

```bash
# Development with separate services
docker-compose -f docker-compose.yml -f docker-compose.override.yml --profile headless up

# Development with combined service
docker-compose -f docker-compose.yml -f docker-compose.override.yml --profile combined up combined
```

### Building
```bash
# Build images
docker-compose build

# Force rebuild
docker-compose build --no-cache
```

## 🔍 Troubleshooting

### Common Issues

1. **Chrome/Puppeteer Issues**
   - The containers include all necessary Chrome dependencies
   - Chrome runs with `--no-sandbox` for Docker compatibility

2. **Audio Device Issues**
   - Fake audio devices are created for headless operation
   - No actual audio hardware is required

3. **Connection Issues**
   - Ensure OpenVidu server URL and credentials are correct in `.env`
   - Check if OpenVidu server is accessible from Docker container

4. **Memory Issues**
   - Chrome is allocated 2GB shared memory (`shm_size: 2gb`)
   - Increase if you encounter memory-related crashes

### Debugging

```bash
# Check container status
docker-compose ps

# Access container shell
docker-compose exec web-app bash
docker-compose exec headless-browser bash

# Check health status
docker-compose exec web-app curl -f http://localhost:8080/health
```

## 🧹 Cleanup

```bash
# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## 📝 Example Commands

```bash
# Full production setup
docker-compose --profile headless up -d --build

# Development mode with file watching
docker-compose -f docker-compose.yml -f docker-compose.override.yml --profile headless up

# Simple web app only
docker-compose up web-app

# Combined service for testing
docker-compose --profile combined up combined --build

# View logs
docker-compose --profile headless logs -f

# Clean shutdown
docker-compose --profile headless down
```
