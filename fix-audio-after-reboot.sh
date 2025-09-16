#!/bin/bash

echo "🔧 Post-Reboot Audio Diagnosis and Fix"
echo "======================================="

# Function to test pactl
test_pactl() {
    echo "Testing pactl functionality..."
    if pactl info >/dev/null 2>&1; then
        echo "✅ pactl is working"
        return 0
    else
        echo "❌ pactl is not working"
        return 1
    fi
}

# Function to restart PulseAudio
restart_pulseaudio() {
    echo "🔄 Restarting PulseAudio daemon..."
    
    # Stop existing PulseAudio processes
    docker exec robot-audio-recorder-headless pkill -f pulseaudio 2>/dev/null || true
    sleep 3
    
    # Start PulseAudio again
    docker exec robot-audio-recorder-headless /app/start-pulseaudio.sh
    
    # Wait for it to initialize
    for i in {1..10}; do
        if docker exec robot-audio-recorder-headless pactl info >/dev/null 2>&1; then
            echo "✅ PulseAudio restarted successfully"
            return 0
        fi
        echo "Waiting for PulseAudio to start... ($i/10)"
        sleep 2
    done
    
    echo "❌ Failed to restart PulseAudio"
    return 1
}

# Main diagnosis
echo "1. Checking if container is running..."
if ! docker ps | grep -q robot-audio-recorder-headless; then
    echo "❌ Container is not running. Starting container..."
    docker-compose up -d headless-browser
    sleep 10
fi

echo "2. Testing pactl in container..."
if docker exec robot-audio-recorder-headless pactl info >/dev/null 2>&1; then
    echo "✅ pactl is working in container"
    echo "Available audio devices:"
    docker exec robot-audio-recorder-headless pactl list short sinks
else
    echo "❌ pactl is not working in container"
    echo "3. Attempting to fix PulseAudio..."
    restart_pulseaudio
fi

echo "4. Testing audio playback..."
docker exec robot-audio-recorder-headless paplay /usr/share/sounds/alsa/Noise.wav 2>/dev/null && echo "✅ Audio test successful" || echo "❌ Audio test failed"

echo "5. Checking Chrome audio configuration..."
docker exec robot-audio-recorder-headless ps aux | grep -i chrome

echo "Done! If issues persist, restart the container:"
echo "docker-compose restart headless-browser"
