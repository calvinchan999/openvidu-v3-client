#!/bin/bash

echo "🎤 Testing audio device configurations..."

echo "📊 Testing card 0 (Intel PCH):"
aplay -D hw:0,0 /dev/zero 2>&1 | head -3 &
PID1=$!
sleep 1
kill $PID1 2>/dev/null || true
echo "✅ Card 0 test completed"

echo "📊 Testing card 1 (USB Audio Device):"
aplay -D hw:1,0 /dev/zero 2>&1 | head -3 &
PID2=$!
sleep 1  
kill $PID2 2>/dev/null || true
echo "✅ Card 1 test completed"

echo "📊 Testing card 2 (QCC5125):"
aplay -D hw:2,0 /dev/zero 2>&1 | head -3 &
PID3=$!
sleep 1
kill $PID3 2>/dev/null || true
echo "✅ Card 2 test completed"

echo "🎤 Testing recording capabilities:"
echo "Card 0 capture:"
arecord -D hw:0,0 -f cd -t raw /dev/null 2>&1 | head -2 &
RPID1=$!
sleep 1
kill $RPID1 2>/dev/null || true

echo "Card 1 capture:"
arecord -D hw:1,0 -f cd -t raw /dev/null 2>&1 | head -2 &
RPID2=$!
sleep 1
kill $RPID2 2>/dev/null || true

echo "✅ Audio device testing completed"
