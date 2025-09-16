#!/bin/bash

# setup-audio.sh - Audio setup script for Ubuntu 18 compatibility
# This script sets up audio devices and permissions before starting the application

# Don't exit on errors during setup (some checks may fail in build environment)
set +e

echo "🎵 Setting up audio for Ubuntu 18..."

# Function to log with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Detect if we're in a build environment (no actual devices)
BUILD_MODE=false
if [ ! -d "/dev/snd" ] || [ ! -c "/dev/snd/controlC0" ]; then
    BUILD_MODE=true
    log "🔧 Build mode detected - skipping device-specific checks"
fi

# Check if running as root or with proper permissions
if [ "$(id -u)" -eq 0 ]; then
    log "⚠️ Running as root - audio setup may have different behavior"
else
    log "✅ Running as user: $(whoami) (uid: $(id -u))"
fi

# Create audio group if it does not exist
if ! getent group audio > /dev/null 2>&1; then
    log "🔧 Creating audio group..."
    if [ "$(id -u)" -eq 0 ]; then
        addgroup -g 29 audio
        log "✅ Audio group created"
    else
        log "⚠️ Cannot create audio group (not root)"
    fi
else
    log "✅ Audio group exists"
fi

# Check if current user is in audio group
if groups $(whoami) | grep -q audio; then
    log "✅ User $(whoami) is in audio group"
else
    log "⚠️ User $(whoami) is NOT in audio group - this may cause audio issues"
    log "💡 On the host, run: sudo usermod -a -G audio $(whoami)"
fi

# Check audio device access
if [ "$BUILD_MODE" = "false" ]; then
    log "🔍 Checking audio device access..."
    if [ -d "/dev/snd" ]; then
        log "✅ /dev/snd directory exists"
        
        # List available ALSA devices
        log "📊 Available ALSA devices:"
        ls -la /dev/snd/ 2>/dev/null || log "❌ Cannot list /dev/snd contents"
        
        # Check for /proc/asound (may not be available in container)
        if [ -d "/proc/asound" ]; then
            log "✅ /proc/asound available"
            ls -la /proc/asound/ 2>/dev/null | head -5 || true
        else
            log "⚠️ /proc/asound not available (container limitation)"
            log "💡 Will use /dev/snd devices directly"
        fi
        
        # Check device permissions
        if [ -c "/dev/snd/controlC0" ]; then
            log "✅ Found audio control device: /dev/snd/controlC0"
            ls -la /dev/snd/controlC* 2>/dev/null || true
        else
            log "⚠️ No audio control devices found"
        fi
        
        # Check for playback devices
        if ls /dev/snd/pcmC*p* >/dev/null 2>&1; then
            log "✅ Found audio playback devices:"
            ls -la /dev/snd/pcmC*p* 2>/dev/null || true
        else
            log "⚠️ No audio playback devices found"
        fi
        
        # Check for capture devices
        if ls /dev/snd/pcmC*c* >/dev/null 2>&1; then
            log "✅ Found audio capture devices:"
            ls -la /dev/snd/pcmC*c* 2>/dev/null || true
        else
            log "⚠️ No audio capture devices found"
        fi
        
    else
        log "❌ /dev/snd directory not found - audio devices not accessible"
    fi
else
    log "⏭️ Skipping audio device checks (build mode)"
fi

# Test ALSA functionality
if [ "$BUILD_MODE" = "false" ]; then
    log "🧪 Testing ALSA functionality..."
    if command -v aplay >/dev/null; then
        log "✅ aplay command available"
        
        # List playback devices
        if aplay -l >/dev/null 2>&1; then
            log "📢 Available playback devices:"
            aplay -l 2>/dev/null | head -10
        else
            log "⚠️ aplay -l failed - no playback devices or permission issues"
        fi
    else
        log "❌ aplay command not available"
    fi

    if command -v arecord >/dev/null; then
        log "✅ arecord command available"
        
        # List capture devices
        if arecord -l >/dev/null 2>&1; then
            log "🎤 Available capture devices:"
            arecord -l 2>/dev/null | head -10
        else
            log "⚠️ arecord -l failed - no capture devices or permission issues"
        fi
    else
        log "❌ arecord command not available"
    fi
else
    log "⏭️ Skipping ALSA functionality tests (build mode)"
fi

# Check PulseAudio setup
log "🔊 Checking PulseAudio configuration..."
if [ -f "/etc/pulse/client.conf" ]; then
    log "✅ PulseAudio client configuration exists"
    log "📄 PulseAudio client config:"
    cat /etc/pulse/client.conf 2>/dev/null || log "❌ Cannot read client.conf"
else
    log "⚠️ PulseAudio client configuration not found"
fi

# Check ALSA configuration
log "🎵 Checking ALSA configuration..."
if [ -f "/etc/asound.conf" ]; then
    log "✅ ALSA configuration exists"
    log "📄 ALSA config:"
    cat /etc/asound.conf 2>/dev/null || log "❌ Cannot read asound.conf"
else
    log "⚠️ ALSA configuration not found"
fi

# Set up environment variables for audio
log "🌍 Setting up audio environment variables..."
export PULSE_SERVER="${PULSE_SERVER:-unix:/tmp/pulse-socket}"
export ALSA_DEVICE="${ALSA_DEVICE:-default}"
export AUDIO_DEVICE="${AUDIO_DEVICE:-default}"

log "📋 Audio environment:"
log "   PULSE_SERVER: $PULSE_SERVER"
log "   ALSA_DEVICE: $ALSA_DEVICE"
log "   AUDIO_DEVICE: $AUDIO_DEVICE"

# Create runtime directories
log "📁 Creating runtime directories..."
mkdir -p /tmp/pulse ~/.config/pulse ~/.cache/pulse
log "✅ Runtime directories created"

# Test basic audio access (without actually playing sound)
if [ "$BUILD_MODE" = "false" ]; then
    log "🔍 Testing basic audio access..."
    if [ -c "/dev/snd/controlC0" ]; then
        if timeout 1 cat /dev/snd/controlC0 >/dev/null 2>&1 & 
        then
            sleep 0.1
            kill $! 2>/dev/null || true
            log "✅ Basic audio device access test passed"
        else
            log "⚠️ Basic audio device access test failed"
        fi
    else
        log "⚠️ Cannot test audio access - no control device"
    fi
else
    log "⏭️ Skipping audio access tests (build mode)"
fi

# Final status
log "🎯 Audio setup completed"

if [ "$BUILD_MODE" = "true" ]; then
    log "📦 Build mode - audio will be configured at runtime"
else
    log "🎵 Runtime mode - audio configuration active"
fi

log "🚀 Starting application with arguments: $@"

# Start the application with all passed arguments
exec "$@"
