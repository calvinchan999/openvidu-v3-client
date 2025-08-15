# Robot Audio Recorder (OpenVidu v3 - Vanilla JS)

A vanilla JavaScript implementation of the Robot Audio Recorder application for **OpenVidu v3 (LiveKit)**, converted from the original Angular version. This application provides real-time audio streaming capabilities using OpenVidu v3's LiveKit integration for robot-to-robot communication.

## 🆕 OpenVidu v3 Updates

This version has been updated to support **OpenVidu v3** which uses **LiveKit** under the hood. Key changes include:

- ✅ **LiveKit Integration**: Uses LiveKit client instead of OpenVidu browser SDK
- ✅ **Token-based Authentication**: Uses `/api/token` endpoint for room access
- ✅ **Room-based Architecture**: Participants join rooms instead of sessions
- ✅ **Enhanced Track Management**: Better audio track control and monitoring
- ✅ **Improved Reconnection**: More robust connection handling
- ✅ **Modern API**: Updated to latest WebRTC standards

## Features

- 🎤 **Real-time Audio Streaming**: Connect and stream audio between multiple robot participants using LiveKit
- 🔊 **Audio Controls**: Mute/unmute speaker and microphone with real-time feedback
- 🔄 **Auto-reconnection**: Automatic reconnection with exponential backoff on connection loss
- 📊 **Connection Status**: Real-time connection status monitoring and display
- 🎛️ **Track Management**: Visual display and individual control of audio tracks
- ⚙️ **Configurable**: Flexible configuration through JSON files and local storage
- 📱 **Responsive Design**: Mobile-friendly responsive user interface
- 🚀 **Performance**: Optimized for LiveKit's efficient streaming protocol

## Project Structure

```
robot-audio-recorder-vanilla/
├── index.html                    # Main HTML file (updated for LiveKit)
├── css/
│   └── styles.css               # Application styles
├── js/
│   ├── config-service.js        # Configuration management
│   ├── openvidu-service.js      # OpenVidu v3 API integration (token-based)
│   ├── audio-stream-manager.js  # Audio track display and control (LiveKit)
│   └── app.js                   # Main application logic (LiveKit room)
├── assets/
│   ├── config/
│   │   └── dashboard-config.json # Configuration file (v3 format)
│   └── images/
│       └── rv-icon.svg          # Application logo
└── README.md                    # This file
```

## Prerequisites

- Web server (for serving the application)
- **OpenVidu v3 server** (with LiveKit integration)
- Modern web browser with WebRTC support

## Configuration

### 1. Server Configuration

Edit `assets/config/dashboard-config.json`:

```json
{
  "robotId": "robot-001",
  "server": {
    "endpoint": "https://your-openvidu-v3-server.com/application-server"
  },
  "openviduVersion": "v3",
  "api": {
    "token": "/api/token",
    "rooms": "/api/rooms",
    "health": "/health"
  },
  "speaker": true,
  "microphone": true,
  "maxConnectionAttempts": 3,
  "reconnectDelay": 5000,
  "livekit": {
    "adaptiveStream": true,
    "dynacast": true
  }
}
```

### 2. OpenVidu v3 Server Setup

Ensure your OpenVidu v3 server is running and accessible. The v3 API endpoints are:
- `POST /api/token` - Get token for room access
- `POST /api/rooms` - Create room (optional)
- `GET /api/rooms/{roomName}` - Get room info
- `DELETE /api/rooms/{roomName}` - Delete room

### 3. LiveKit Configuration

The application automatically configures LiveKit based on the server response. No additional LiveKit setup is required on the client side.

## Installation & Usage

### Option 1: Simple HTTP Server

```bash
# Navigate to the project directory
cd robot-audio-recorder-vanilla

# Start a simple HTTP server (Python 3)
python -m http.server 8080

# Or using Node.js
npx http-server -p 8080

# Open browser and navigate to:
# http://localhost:8080
```

### Option 2: Using Live Server (VS Code)

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 3: Deploy to Web Server

Upload all files to your web server and access via your domain.

## Usage Instructions

1. **Start the Application**: Open the application in your web browser
2. **Check Configuration**: Verify the robot ID and server endpoint in the status panel
3. **Connection**: The application will automatically attempt to connect to the OpenVidu v3 room
4. **Audio Controls**: 
   - Use the speaker button to mute/unmute incoming audio from all participants
   - Use the microphone button to mute/unmute your outgoing audio
5. **Track Management**: View and control individual audio tracks from other participants

## API Integration (v3)

### Configuration Service (`config-service.js`)
- Manages application configuration from multiple sources
- Supports local storage persistence
- Loads remote configuration from JSON files
- **Unchanged** - maintains compatibility

### OpenVidu v3 Service (`openvidu-service.js`)
- **Updated** for OpenVidu v3 token-based API
- Creates tokens using `/api/token` endpoint
- Supports room management operations
- Includes retry logic for network resilience

### Audio Stream Manager (`audio-stream-manager.js`)
- **Updated** for LiveKit track system
- Manages visual representation of audio tracks
- Uses `publication.setEnabled()` for mute/unmute
- Handles LiveKit track lifecycle events

### Main Application (`app.js`)
- **Major update** to use LiveKit Room API
- Manages LiveKit room connection lifecycle
- Implements v3-compatible reconnection logic
- Handles LiveKit participant and track events

## Browser Compatibility

- Chrome 60+ ✅
- Firefox 55+ ✅
- Safari 12+ ✅
- Edge 79+ ✅

**Note**: OpenVidu v3 with LiveKit may have enhanced browser support compared to v2.

## Troubleshooting

### Connection Issues

1. **Check OpenVidu v3 Server**: Ensure the server is running and accessible
2. **API Endpoint**: Verify `/api/token` endpoint is available and working
3. **Token Generation**: Check server logs for token generation errors
4. **LiveKit URL**: Ensure the LiveKit server URL in the token response is correct
5. **Network Configuration**: Verify firewall settings allow WebRTC and LiveKit traffic

### Audio Issues

1. **Microphone Permissions**: Ensure browser has microphone permissions
2. **Audio Device**: Check if the specified audio device is available
3. **Browser Audio Policy**: Some browsers require user interaction before audio playback
4. **Track Subscription**: Verify tracks are being subscribed correctly in browser dev tools

### v3 Migration Issues

1. **API Compatibility**: Ensure your server supports OpenVidu v3 API endpoints
2. **Token Format**: Verify tokens are JWT format compatible with LiveKit
3. **Room Names**: Check that room names follow LiveKit naming conventions
4. **Publication Settings**: Verify track publications are enabled correctly

### Performance Issues

1. **Network Bandwidth**: Ensure sufficient bandwidth for audio streaming
2. **CPU Usage**: Monitor CPU usage, LiveKit is generally more efficient than v2
3. **Browser Resources**: Close unnecessary tabs and applications
4. **LiveKit Optimization**: Check LiveKit adaptive streaming settings

## Development

### Adding New Features

1. **Configuration Options**: Add new options to `dashboard-config.json`
2. **UI Components**: Add new elements to `index.html` and style them in `styles.css`
3. **LiveKit Features**: Extend room and track functionality using LiveKit APIs
4. **Event Handlers**: Add new LiveKit event handlers in `app.js`

### Debugging

- Open browser developer tools (F12)
- Check console for error messages and logs
- Use Network tab to monitor API calls to `/api/token`
- Monitor LiveKit connection states and events
- Use Application tab to inspect local storage

## Migration from v2 to v3

| Component | v2 Implementation | v3 Implementation |
|-----------|------------------|-------------------|
| **Client Library** | openvidu-browser | livekit-client |
| **Connection** | Session + Connection | Room + Token |
| **API Endpoint** | `/api/sessions` | `/api/token` |
| **Audio Control** | `subscribeToAudio()` | `publication.setEnabled()` |
| **Events** | OpenVidu events | LiveKit room events |
| **Participants** | Subscriber objects | Participant + Track |
| **Muting** | Stream-level | Publication-level |

## Differences from Angular Version

| Feature | Angular Version | Vanilla JS v3 |
|---------|----------------|---------------|
| Framework | Angular 14+ | Pure JavaScript |
| OpenVidu | v2 | v3 (LiveKit) |
| Build Process | Angular CLI | None required |
| Modules | TypeScript modules | Global objects |
| Services | Angular services | ES6 classes |
| State Management | Angular binding | Manual updates |
| API Integration | OpenVidu browser SDK | LiveKit client |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test with OpenVidu v3 server
4. Ensure LiveKit compatibility
5. Submit a pull request

## License

This project is licensed under the MIT License. See the original Angular project for license details.

## Support

For issues and questions:

### v3-Specific Issues
1. Verify OpenVidu v3 server configuration
2. Check LiveKit server connectivity
3. Validate token generation and format
4. Review LiveKit client logs in browser console

### General Issues
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify network connectivity and permissions
4. Test with different browsers

### Useful Resources
- [OpenVidu v3 Documentation](https://docs.openvidu.io/)
- [LiveKit Documentation](https://docs.livekit.io/)
- [LiveKit JavaScript SDK](https://github.com/livekit/client-sdk-js)