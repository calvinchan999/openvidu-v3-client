#!/bin/bash

# simple-startup.sh - Basic startup script for robot audio recorder
# This replaces the complex inline scripts from the Dockerfile

echo "🚀 Starting Robot Audio Recorder..."

# Basic audio setup
echo "🎵 Setting up audio..."
mkdir -p /tmp/pulse ~/.config/pulse

# Start the application
echo "▶️ Starting headless browser..."
exec node headless-launcher.js
