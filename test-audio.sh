#!/bin/bash

echo "🔊 Testing Docker Audio Setup"
echo "=============================="

# Check current user and groups
echo "Current user: $(whoami)"
echo "Current user ID: $(id -u)"
echo "Current groups: $(groups)"
echo "Audio group members: $(getent group audio 2>/dev/null || echo 'Audio group not found')"

# Check audio device permissions
echo ""
echo "Audio device permissions:"
ls -la /dev/snd/ 2>/dev/null || echo "No /dev/snd directory found"

# Kill any existing audio processes and start fresh
echo ""
echo "1. Cleaning up existing audio processes..."
pkill -f pulseaudio 2>/dev/null || true
pkill -f aplay 2>/dev/null || true
pkill -f paplay 2>/dev/null || true
sleep 2

echo ""
echo "2. Starting PulseAudio daemon..."
/app/start-pulseaudio.sh

echo ""
echo "3. Testing audio with aplay..."
echo "Playing test sound to default device..."

# Test with aplay (ALSA)
aplay /usr/share/sounds/alsa/Noise.wav

echo ""
echo "4. Testing audio with paplay (PulseAudio)..."
echo "Playing test sound through PulseAudio..."

# Test with paplay (PulseAudio)
paplay /usr/share/sounds/alsa/Noise.wav

echo ""
echo "5. Audio device information:"
echo "Available ALSA devices:"
aplay -l

echo ""
echo "Available PulseAudio sinks:"
pactl list short sinks

echo ""
echo "Available PulseAudio sources:"
pactl list short sources

echo ""
echo "6. Setting default sink to first available device..."
# Get the first sink and set it as default
FIRST_SINK=$(pactl list short sinks | head -n1 | cut -f2)
if [ ! -z "$FIRST_SINK" ]; then
    echo "Setting default sink to: $FIRST_SINK"
    pactl set-default-sink "$FIRST_SINK"
    echo "Testing with default sink..."
    paplay /usr/share/sounds/alsa/Noise.wav
else
    echo "No PulseAudio sinks found!"
fi

echo ""
echo "7. Additional troubleshooting:"
echo "Checking if audio is actually playing..."
pactl list sink-inputs

echo ""
echo "Checking volume levels:"
pactl list sinks | grep -A 5 -B 5 "alsa_output.usb-QTIL_QCC5125"

echo ""
echo "Setting volume to 100% and unmuting..."
pactl set-sink-volume alsa_output.usb-QTIL_QCC5125_ABCDEF0123456789-00.analog-stereo 100%
pactl set-sink-mute alsa_output.usb-QTIL_QCC5125_ABCDEF0123456789-00.analog-stereo 0

echo ""
echo "Testing with maximum volume..."
paplay /usr/share/sounds/alsa/Noise.wav

echo ""
echo "8. Alternative test with aplay to specific device:"
aplay -D plughw:2,0 /usr/share/sounds/alsa/Noise.wav

echo ""
echo "✅ Audio test completed!"
