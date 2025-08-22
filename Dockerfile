# Use a pre-built image with Chrome already installed
FROM ghcr.io/puppeteer/puppeteer:21.5.2

# Switch to root to install additional packages
USER root

# Fix GPG issues and install additional dependencies including audio support
RUN rm -f /etc/apt/sources.list.d/google-chrome.list /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y \
        curl \
        procps \
        # Audio dependencies
        pulseaudio \
        pulseaudio-utils \
        alsa-utils \
        alsa-tools \
        # Additional system tools for audio
        libasound2 \
        libasound2-dev \
        libpulse0 \
        libpulse-dev \
    && rm -rf /var/lib/apt/lists/*

# Create audio group and add pptruser to it
# Note: This will be overridden by docker-compose user mapping
RUN groupadd -g 1000 audio || true \
    && usermod -a -G audio pptruser \
    && usermod -a -G video pptruser

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install Node.js dependencies with optimizations
# The base image already has Puppeteer installed, so we skip downloading it
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV npm_config_cache=/tmp/.npm
ENV npm_config_update_notifier=false

# Use multiple optimization flags for faster npm install
RUN npm ci --only=production \
    --prefer-offline \
    --no-audit \
    --no-fund \
    --progress=false \
    --silent \
    && npm cache clean --force

# Copy application files
COPY . .

# Create logs directory and set permissions
RUN mkdir -p /app/logs \
    && chown -R pptruser:pptruser /app

# Create user home directory structure for Chrome/Puppeteer
RUN mkdir -p /home/europa/.local/share/applications \
    && mkdir -p /home/europa/.config/google-chrome \
    && mkdir -p /home/europa/.cache \
    && chown -R pptruser:pptruser /home/europa \
    && chmod 755 /home/europa \
    && chmod -R 755 /home/europa/.local \
    && chmod -R 755 /home/europa/.config \
    && chmod -R 755 /home/europa/.cache

# Create audio-related directories with proper permissions
RUN mkdir -p /tmp/.X11-unix \
    && chown -R pptruser:audio /tmp/.X11-unix \
    && chmod 755 /tmp/.X11-unix

# Switch to the existing pptruser (from puppeteer base image)
USER pptruser

# Expose port for the application
EXPOSE 8080

# Set environment variables (many are already set in base image)
ENV DISPLAY=:99
ENV NODE_ENV=production
# Audio environment variables - will be set by docker-compose
ENV ALSA_DEVICE=default

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default command - can be overridden in docker-compose
CMD ["npm", "run", "launch"]
