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

# Check if running as root for initial setup
INITIAL_USER=$(whoami)
if [ "$INITIAL_USER" = "root" ]; then
    log "🔧 Running initial setup as root for device permissions"
    
    # Fix audio device permissions as root
    if [ "$BUILD_MODE" = "false" ]; then
        log "🔧 Setting up audio device permissions as root..."
        
        # Set proper permissions for all audio devices
        for device in /dev/snd/control* /dev/snd/pcm* /dev/snd/hw* /dev/snd/seq /dev/snd/timer; do
            if [ -e "$device" ]; then
                chown root:29 "$device" 2>/dev/null || true
                chmod 664 "$device" 2>/dev/null || true
                log "🔧 Set permissions for $(basename $device): $(ls -la $device 2>/dev/null | awk '{print $1,$3,$4}')"
            fi
        done
        
        log "✅ Audio device permissions configured"
    fi
    
    # Switch to target user if arguments provided
    if [ $# -gt 0 ]; then
        TARGET_USER="${DOCKER_USER_ID:-1000}"
        TARGET_GROUP="${DOCKER_GROUP_ID:-1000}"
        
        log "🔄 Switching to user $TARGET_USER:$TARGET_GROUP and executing: $@"
        exec su-exec "$TARGET_USER:$TARGET_GROUP" "$0" "$@"
    fi
else
    log "✅ Running as user: $INITIAL_USER (uid: $(id -u))"
fi

# Create audio group and user with correct group ID for host compatibility
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

# Ensure current user is in audio group
if groups $(whoami) | grep -q "29\|audio"; then
    log "✅ User $(whoami) is in audio group"
else
    log "⚠️ User $(whoami) is NOT in audio group - this may cause audio issues"
    log "💡 Current groups: $(groups $(whoami))"
fi

# Fix audio device permissions if needed
if [ "$BUILD_MODE" = "false" ]; then
    log "🔧 Checking and fixing audio device permissions..."
    
    # Check if we have write access to audio devices
    if [ -w "/dev/snd/controlC0" ]; then
        log "✅ Audio device permissions OK"
    else
        log "⚠️ No write access to audio devices - attempting to fix permissions"
        
        # Try to fix permissions for all audio devices
        log "🔧 Setting audio device permissions..."
        
        # Make audio devices accessible to group (if we have permission)
        for device in /dev/snd/control* /dev/snd/pcm* /dev/snd/hw* /dev/snd/seq /dev/snd/timer; do
            if [ -e "$device" ]; then
                # Try to change group to 29 and set group permissions
                chgrp 29 "$device" 2>/dev/null || true
                chmod g+rw "$device" 2>/dev/null || true
                log "🔧 Updated permissions for $(basename $device): $(ls -la $device 2>/dev/null | awk '{print $1,$3,$4}')"
            fi
        done
        
        # Test again after permission changes
        if [ -w "/dev/snd/controlC0" ]; then
            log "✅ Audio device permissions fixed successfully"
        else
            log "❌ Still no write access to audio devices"
            log "   Device permissions: $(ls -la /dev/snd/controlC0)"
            log "   Current user: $(id)"
            log "   💡 May need privileged mode or proper host audio group setup"
        fi
    fi
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
export ALSA_DEVICE="${ALSA_DEVICE:-hw:1,0}"
export AUDIO_DEVICE="${AUDIO_DEVICE:-hw:1,0}"
export ALSA_PCM_CARD="${ALSA_PCM_CARD:-1}"
export ALSA_PCM_DEVICE="${ALSA_PCM_DEVICE:-0}"

# Disable PulseAudio to force ALSA direct access
unset PULSE_SERVER
export PULSE_RUNTIME_PATH=""

log "📋 Audio environment:"
log "   ALSA_DEVICE: $ALSA_DEVICE"
log "   AUDIO_DEVICE: $AUDIO_DEVICE"
log "   ALSA_PCM_CARD: $ALSA_PCM_CARD"
log "   ALSA_PCM_DEVICE: $ALSA_PCM_DEVICE"
log "   PULSE_SERVER: (disabled for direct ALSA access)"

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
    
    # Test specific ALSA device access
    log "🎵 Testing ALSA device access..."
    
    # Test control device access
    for card in 0 1 2; do
        if [ -c "/dev/snd/controlC${card}" ]; then
            if [ -r "/dev/snd/controlC${card}" ] && [ -w "/dev/snd/controlC${card}" ]; then
                log "✅ Control device controlC${card} accessible"
            else
                log "⚠️ Control device controlC${card} not accessible ($(ls -la /dev/snd/controlC${card}))"
            fi
        fi
    done
    
    # Test PCM device access  
    for device in /dev/snd/pcmC*; do
        if [ -c "$device" ]; then
            if [ -r "$device" ] && [ -w "$device" ]; then
                log "✅ PCM device $(basename $device) accessible"
            else
                log "⚠️ PCM device $(basename $device) not accessible ($(ls -la $device))"
            fi
        fi
    done
    
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
