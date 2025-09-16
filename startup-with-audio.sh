#!/bin/bash

echo "🎵 Initializing Robot Audio Recorder with PulseAudio..."

# Set up proper permissions for audio devices
echo "Setting up audio device permissions..."
if [ -e /dev/snd ]; then
    echo "Audio devices found in /dev/snd"
    ls -la /dev/snd/
else
    echo "Warning: No audio devices found in /dev/snd"
fi

# Set environment variables for PulseAudio
export PULSE_SERVER="unix:/tmp/pulse-socket"
export PULSE_RUNTIME_PATH="/tmp/pulse"

# Initialize PulseAudio with retry logic
echo "Starting PulseAudio daemon with retry logic..."
RETRY_COUNT=0
MAX_RETRIES=3

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "Attempt $(($RETRY_COUNT + 1))/$MAX_RETRIES to start PulseAudio..."
    
    # Run the PulseAudio startup script
    if /app/start-pulseaudio.sh; then
        echo "✅ PulseAudio started successfully"
        break
    else
        echo "❌ PulseAudio failed to start, retrying..."
        RETRY_COUNT=$(($RETRY_COUNT + 1))
        sleep 5
    fi
done

# Final check
if pactl info >/dev/null 2>&1; then
    echo "✅ pactl is working"
    echo "Available audio sinks:"
    pactl list short sinks
    echo "Available audio sources:"
    pactl list short sources
    
    # Set a default sink if available
    FIRST_SINK=$(pactl list short sinks | head -n1 | cut -f2)
    if [ ! -z "$FIRST_SINK" ]; then
        echo "Setting default sink to: $FIRST_SINK"
        pactl set-default-sink "$FIRST_SINK"
    fi
else
    echo "❌ pactl is not working after $MAX_RETRIES attempts"
    echo "Fallback: Using ALSA directly"
    export ALSA_DEVICE=${ALSA_DEVICE:-default}
    echo "ALSA device set to: $ALSA_DEVICE"
    
    # Test ALSA directly
    echo "Testing ALSA devices:"
    aplay -l 2>/dev/null || echo "No ALSA devices found"
fi

# Start the main application
echo "🚀 Starting Robot Audio Recorder application..."
exec node headless-launcher.js
