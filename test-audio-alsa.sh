#!/bin/bash

echo "🔊 Testing Docker Audio Setup (ALSA Direct)"
echo "============================================="

# Check current user and groups
echo "Current user: $(whoami)"
echo "Current user ID: $(id -u)"
echo "Current groups: $(groups)"

# Check audio device permissions
echo ""
echo "Audio device permissions:"
ls -la /dev/snd/ 2>/dev/null || echo "No /dev/snd directory found"

echo ""
echo "1. Testing ALSA audio devices..."
echo "Available ALSA devices:"
aplay -l

echo ""
echo "2. Testing audio with aplay to different devices..."

# Test with default device
echo "Testing default device:"
aplay /usr/share/sounds/alsa/Noise.wav

echo ""
echo "Testing USB Audio Device (card 1):"
aplay -D plughw:1,0 /usr/share/sounds/alsa/Noise.wav

echo ""
echo "Testing QCC5125 device (card 2):"
aplay -D plughw:2,0 /usr/share/sounds/alsa/Noise.wav

echo ""
echo "3. Testing with different sample rates..."
echo "Testing 44.1kHz:"
aplay -D plughw:2,0 -r 44100 /usr/share/sounds/alsa/Noise.wav

echo ""
echo "Testing 48kHz:"
aplay -D plughw:2,0 -r 48000 /usr/share/sounds/alsa/Noise.wav

echo ""
echo "4. Checking ALSA mixer controls..."
echo "Available mixer controls for card 2 (QCC5125):"
amixer -c 2 controls 2>/dev/null || echo "No mixer controls found for card 2"

echo ""
echo "Available mixer controls for card 1 (USB Audio):"
amixer -c 1 controls 2>/dev/null || echo "No mixer controls found for card 1"

echo ""
echo "5. Setting volume levels..."
echo "Setting QCC5125 volume to 80%:"
amixer -c 2 set Master 80% 2>/dev/null || echo "Could not set volume for card 2"

echo "Setting USB Audio volume to 80%:"
amixer -c 1 set Master 80% 2>/dev/null || echo "Could not set volume for card 1"

echo ""
echo "6. Final test with volume set..."
echo "Testing QCC5125 with 80% volume:"
aplay -D plughw:2,0 /usr/share/sounds/alsa/Noise.wav

echo ""
echo "✅ ALSA audio test completed!"
echo ""
echo "If you can hear the audio now, the issue is with PulseAudio configuration."
echo "For OpenVidu, we can configure Chrome to use ALSA directly instead of PulseAudio."
