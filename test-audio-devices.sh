#!/bin/bash

# test-audio-devices.sh - Test different audio devices in container
echo "🎵 Testing audio devices in container..."

echo "📊 Available playback devices:"
aplay -l

echo ""
echo "📊 Available capture devices:"
arecord -l

echo ""
echo "🔍 Testing device access permissions:"

# Test card 0 (Intel PCH)
echo "Testing card 0 (Intel PCH):"
ls -la /dev/snd/controlC0 || echo "❌ No access to controlC0"

# Test card 1 (USB Audio Device)
echo "Testing card 1 (USB Audio Device):"
ls -la /dev/snd/controlC1 || echo "❌ No access to controlC1"

# Test card 2 (QCC5125)
echo "Testing card 2 (QCC5125):"
ls -la /dev/snd/controlC2 || echo "❌ No access to controlC2"

echo ""
echo "🎤 Testing capture device access:"
echo "Card 0 capture: $(ls -la /dev/snd/pcmC0D0c 2>/dev/null || echo 'Not accessible')"
echo "Card 0 alt capture: $(ls -la /dev/snd/pcmC0D2c 2>/dev/null || echo 'Not accessible')"
echo "Card 1 capture: $(ls -la /dev/snd/pcmC1D0c 2>/dev/null || echo 'Not accessible')"

echo ""
echo "🔊 Testing playback device access:"
echo "Card 0 playback: $(ls -la /dev/snd/pcmC0D0p 2>/dev/null || echo 'Not accessible')"
echo "Card 1 playback: $(ls -la /dev/snd/pcmC1D0p 2>/dev/null || echo 'Not accessible')"
echo "Card 2 playback: $(ls -la /dev/snd/pcmC2D0p 2>/dev/null || echo 'Not accessible')"

echo ""
echo "🎯 Current ALSA configuration:"
cat /etc/asound.conf

echo ""
echo "🌍 Audio environment variables:"
echo "ALSA_DEVICE: $ALSA_DEVICE"
echo "AUDIO_DEVICE: $AUDIO_DEVICE"
echo "ALSA_PCM_CARD: $ALSA_PCM_CARD"
echo "ALSA_PCM_DEVICE: $ALSA_PCM_DEVICE"

echo ""
echo "🧪 Testing ALSA default device:"
aplay -D default /dev/null 2>&1 | head -3 || echo "❌ Default device test failed"

echo ""
echo "✅ Audio device test completed!"
