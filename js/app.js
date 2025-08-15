/**
 * Main Application for Robot Audio Recorder (OpenVidu v3/LiveKit)
 * Vanilla JS implementation using OpenVidu v3 (LiveKit) API
 */
class RobotAudioRecorderApp {
    constructor() {
        // Initialize configuration service
        this.configService = new ConfigService();
        
        // Services will be initialized after config is loaded
        this.openViduService = null;
        this.audioStreamManager = new AudioStreamManager('streams-container');

        // LiveKit objects (v3)
        this.room = null;
        this.localParticipant = null;

        // Application state
        this.roomName = '';
        this.participantName = '';
        this.speaker = true;
        this.microphone = true;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.reconnectTimeout = null;

        // DOM elements
        this.elements = {};

        console.log('RobotAudioRecorderApp (v3) initialized');
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing Robot Audio Recorder App (v3)...');

            // Load configuration
            await this.loadConfiguration();

            // Initialize OpenVidu service AFTER config is loaded
            this.openViduService = new OpenViduV3Service(this.configService);
            console.log('OpenViduV3Service initialized with endpoint:', this.configService.getServerEndpoint());

            // Initialize DOM elements
            this.initializeElements();

            // Setup event listeners
            this.setupEventListeners();

            // Apply initial configuration
            this.applyConfiguration();

            // Auto-join room
            await this.joinRoom();

            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Error initializing application:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    /**
     * Load configuration from various sources
     */
    async loadConfiguration() {
        // Load local configuration first
        this.configService.loadLocalConfig();

        // Then try to load remote configuration
        await this.configService.loadAppConfig();

        // Apply configuration values
        const config = this.configService.getConfig();
        this.roomName = this.configService.getRobotId(); // Use robot ID as room name
        this.speaker = this.configService.getSpeakerState();
        this.microphone = this.configService.getMicrophoneState();
        this.maxConnectionAttempts = this.configService.getMaxConnectionAttempts();

        // Generate participant name
        this.generateParticipantInfo();

        console.log('Configuration loaded:', config);
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            connectionStatus: document.getElementById('connection-status'),
            sessionId: document.getElementById('session-id'),
            robotName: document.getElementById('robot-name'),
            speakerBtn: document.getElementById('speaker-btn'),
            speakerIcon: document.getElementById('speaker-icon'),
            speakerText: document.getElementById('speaker-text'),
            microphoneBtn: document.getElementById('microphone-btn'),
            microphoneIcon: document.getElementById('microphone-icon'),
            microphoneText: document.getElementById('microphone-text'),
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            errorText: document.getElementById('error-text'),
            retryBtn: document.getElementById('retry-btn')
        };

        // Validate all elements exist
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.warn(`Element not found: ${key}`);
            }
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Speaker control
        if (this.elements.speakerBtn) {
            this.elements.speakerBtn.addEventListener('click', () => {
                this.muteUnmuteSpeaker();
            });
        }

        // Microphone control
        if (this.elements.microphoneBtn) {
            this.elements.microphoneBtn.addEventListener('click', () => {
                this.muteUnmuteMic();
            });
        }

        // Retry button
        if (this.elements.retryBtn) {
            this.elements.retryBtn.addEventListener('click', () => {
                this.retryConnection();
            });
        }

        // Window beforeunload
        window.addEventListener('beforeunload', () => {
            this.leaveRoom();
        });

        // Page visibility change (handle tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden');
            } else {
                console.log('Page visible');
                this.checkConnectionStatus();
            }
        });

        console.log('Event listeners setup complete');
    }

    /**
     * Apply initial configuration to UI
     */
    applyConfiguration() {
        this.updateSessionInfo();
        this.updateSpeakerButton();
        this.updateMicrophoneButton();
        this.updateConnectionStatus(false);
    }

    /**
     * Generate participant information
     */
    generateParticipantInfo() {
        // Generate a unique participant name based on room name and timestamp
        const timestamp = Date.now().toString(36);
        this.participantName = `${this.roomName}_${timestamp}`;
        console.log('Generated participant info:', this.participantName);
    }

    /**
     * Join LiveKit room (OpenVidu v3)
     */
    async joinRoom() {
        try {
            this.showLoading(true);
            this.hideError();

            console.log('Joining room:', this.roomName);

            // Make sure OpenVidu service is initialized
            if (!this.openViduService) {
                throw new Error('OpenVidu service not initialized');
            }

            // Get token from OpenVidu v3 server
            const { token, livekitUrl } = await this.openViduService.getToken(this.roomName, this.participantName);

            console.log('Connecting to LiveKit:', livekitUrl);

            // Create LiveKit room
            this.room = new LivekitClient.Room();

            // Setup room event listeners
            this.setupRoomEvents();

            // Connect to room
            await this.room.connect(livekitUrl, token);

            console.log('Successfully connected to room');
            this.updateConnectionStatus(true);
            this.connectionAttempts = 0;

            // Enable microphone (audio only for robot)
            if (this.microphone) {
                await this.enableMicrophone();
            }

            this.showLoading(false);

        } catch (error) {
            console.error('Error joining room:', error);
            this.showLoading(false);
            this.handleConnectionError(error);
        }
    }

    /**
     * Setup LiveKit room event handlers
     */
    setupRoomEvents() {
        if (!this.room) return;

        // Connection state changes
        this.room.on(LivekitClient.RoomEvent.Connected, () => {
            console.log('Room connected');
            this.updateConnectionStatus(true);
            this.connectionAttempts = 0;
        });

        this.room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
            console.log('Room disconnected:', reason);
            this.handleDisconnection();
        });

        this.room.on(LivekitClient.RoomEvent.Reconnecting, () => {
            console.log('Room reconnecting...');
            this.updateConnectionStatus(false);
            this.showError('Reconnecting...');
        });

        this.room.on(LivekitClient.RoomEvent.Reconnected, () => {
            console.log('Room reconnected');
            this.updateConnectionStatus(true);
            this.hideError();
        });

        // Participant events
        this.room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
            console.log('Participant connected:', participant.identity);
            this.handleParticipantConnected(participant);
        });

        this.room.on(LivekitClient.RoomEvent.ParticipantDisconnected, (participant) => {
            console.log('Participant disconnected:', participant.identity);
            this.handleParticipantDisconnected(participant);
        });

        // Track events
        this.room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('Track subscribed:', track.kind, 'from', participant.identity);
            this.handleTrackSubscribed(track, publication, participant);
        });

        this.room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log('Track unsubscribed:', track.kind, 'from', participant.identity);
            this.handleTrackUnsubscribed(track, publication, participant);
        });

        this.room.on(LivekitClient.RoomEvent.LocalTrackPublished, (publication, participant) => {
            console.log('Local track published:', publication.kind);
            this.localParticipant = participant;
        });

        console.log('Room event handlers setup complete');
    }

    /**
     * Get available audio input devices
     */
    async getAudioInputDevices() {
        try {
            // Request permission to access media devices
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Get all available devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Filter for audio input devices
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            console.log('Available audio input devices:', audioInputs);
            return audioInputs;
        } catch (error) {
            console.error('Error getting audio input devices:', error);
            return [];
        }
    }

    /**
     * Get available audio output devices
     */
    async getAudioOutputDevices() {
        try {
            // Request permission to access media devices first
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Get all available devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Filter for audio output devices
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
            
            console.log('Available audio output devices:', audioOutputs);
            return audioOutputs;
        } catch (error) {
            console.error('Error getting audio output devices:', error);
            return [];
        }
    }

    /**
     * Enable microphone with specific device selection
     */
    async enableMicrophone() {
        try {
            if (this.room && this.room.localParticipant) {
                const config = this.configService.getConfig();
                const preferredDeviceId = config.audioDevice;
                
                if (preferredDeviceId) {
                    console.log('Enabling microphone with specific device:', preferredDeviceId);
                    
                    // Create audio track with specific device
                    const audioTrack = await LivekitClient.createLocalAudioTrack({
                        deviceId: preferredDeviceId,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    });
                    
                    // Publish the track
                    await this.room.localParticipant.publishTrack(audioTrack);
                    console.log('Microphone enabled with device:', preferredDeviceId);
                } else {
                    // Use default microphone
                    console.log('Enabling default microphone');
                    await this.room.localParticipant.enableMicrophone();
                }
                
                this.localParticipant = this.room.localParticipant;
                console.log('Microphone enabled and track published');
                
                // Also ensure microphone is enabled if tracks already exist
                await this.room.localParticipant.setMicrophoneEnabled(true);
            }
        } catch (error) {
            console.error('Error enabling microphone:', error);
            // Try fallback method
            try {
                if (this.room && this.room.localParticipant) {
                    await this.room.localParticipant.setMicrophoneEnabled(true);
                    console.log('Microphone enabled via fallback method');
                }
            } catch (fallbackError) {
                console.error('Fallback microphone enable also failed:', fallbackError);
            }
        }
    }

    /**
     * Switch to a different audio input device
     */
    async switchAudioDevice(deviceId) {
        try {
            console.log('Switching to audio input device:', deviceId);
            
            if (this.room && this.room.localParticipant) {
                // First, unpublish existing audio track
                console.log(this.room.localParticipant);
                const existingTrack = this.room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Microphone);
                if (existingTrack) {
                    await this.room.localParticipant.unpublishTrack(existingTrack.track);
                    console.log('Unpublished existing audio track');
                }
                
                // Create new audio track with the specified device
                const audioTrack = await LivekitClient.createLocalAudioTrack({
                    deviceId: deviceId,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                });
                
                // Publish the new track
                await this.room.localParticipant.publishTrack(audioTrack);
                
                // Update configuration
                this.configService.updateConfig({ audioDevice: deviceId });
                
                console.log('Successfully switched to audio input device:', deviceId);
                return true;
            }
        } catch (error) {
            console.error('Error switching audio input device:', error);
            return false;
        }
    }

    /**
     * Switch to a different audio output device
     */
    async switchAudioOutputDevice(deviceId) {
        try {
            console.log('Switching to audio output device:', deviceId);
            
            // Get all audio elements in the streams container
            const audioElements = document.querySelectorAll('audio');
            
            const promises = Array.from(audioElements).map(async (audioElement) => {
                if (typeof audioElement.setSinkId === 'function') {
                    try {
                        await audioElement.setSinkId(deviceId);
                        console.log('Audio element sink set to:', deviceId);
                    } catch (error) {
                        console.warn('Failed to set sink for audio element:', error);
                    }
                } else {
                    console.warn('setSinkId not supported on this audio element');
                }
            });
            
            await Promise.allSettled(promises);
            
            // Update configuration
            this.configService.updateConfig({ audioOutputDevice: deviceId });
            
            console.log('Successfully switched to audio output device:', deviceId);
            return true;
            
        } catch (error) {
            console.error('Error switching audio output device:', error);
            return false;
        }
    }

    /**
     * Setup audio device selection UI and handlers
     */
    async setupDeviceSelection() {
        try {
            console.log('Setting up device selection...');
            
            // Show device selection panel after connection
            const deviceSelection = document.getElementById('device-selection');
            if (deviceSelection) {
                deviceSelection.style.display = 'block';
            }
            
            // Setup event listeners for input devices
            const audioDeviceSelect = document.getElementById('audio-device-select');
            const audioOutputDeviceSelect = document.getElementById('audio-output-device-select');
            const refreshDevicesBtn = document.getElementById('refresh-devices-btn');
            
            if (audioDeviceSelect) {
                audioDeviceSelect.addEventListener('change', async (event) => {
                    const deviceId = event.target.value;
                    if (this.room && this.room.localParticipant) {
                        await this.switchAudioDevice(deviceId);
                    } else {
                        // Save selection for when we connect
                        this.configService.updateConfig({ audioDevice: deviceId });
                    }
                });
            }
            
            // Setup event listeners for output devices
            if (audioOutputDeviceSelect) {
                audioOutputDeviceSelect.addEventListener('change', async (event) => {
                    const deviceId = event.target.value;
                    await this.switchAudioOutputDevice(deviceId);
                });
            }
            
            if (refreshDevicesBtn) {
                refreshDevicesBtn.addEventListener('click', async () => {
                    await this.refreshAudioDevices();
                });
            }
            
            // Initial load of devices
            await this.refreshAudioDevices();
            
        } catch (error) {
            console.error('Error setting up device selection:', error);
        }
    }

    /**
     * Refresh the list of audio input and output devices
     */
    async refreshAudioDevices() {
        try {
            console.log('Refreshing audio devices...');
            
            // Get input devices
            const inputDevices = await this.getAudioInputDevices();
            const audioDeviceSelect = document.getElementById('audio-device-select');
            
            if (audioDeviceSelect) {
                // Clear existing options except default
                audioDeviceSelect.innerHTML = '<option value="">Default Microphone</option>';
                
                // Add available input devices
                inputDevices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Microphone ${device.deviceId.substring(0, 8)}...`;
                    audioDeviceSelect.appendChild(option);
                });
                
                // Set current selection from config
                const config = this.configService.getConfig();
                if (config.audioDevice) {
                    audioDeviceSelect.value = config.audioDevice;
                }
                
                console.log(`Found ${inputDevices.length} audio input devices`);
            }
            
            // Get output devices
            const outputDevices = await this.getAudioOutputDevices();
            const audioOutputDeviceSelect = document.getElementById('audio-output-device-select');
            
            if (audioOutputDeviceSelect) {
                // Clear existing options except default
                audioOutputDeviceSelect.innerHTML = '<option value="">Default Speaker</option>';
                
                // Add available output devices
                outputDevices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Speaker ${device.deviceId.substring(0, 8)}...`;
                    audioOutputDeviceSelect.appendChild(option);
                });
                
                // Set current selection from config
                const config = this.configService.getConfig();
                if (config.audioOutputDevice) {
                    audioOutputDeviceSelect.value = config.audioOutputDevice;
                }
                
                console.log(`Found ${outputDevices.length} audio output devices`);
            }
            
        } catch (error) {
            console.error('Error refreshing audio devices:', error);
        }
    }

    /**
     * Handle participant connected
     */
    handleParticipantConnected(participant) {
        console.log('Handling participant connected:', participant.identity);
        
        // Check if participant has audio tracks
        participant.tracks.forEach((publication) => {
            if (publication.track && publication.kind === LivekitClient.Track.Kind.Audio) {
                this.handleTrackSubscribed(publication.track, publication, participant);
            }
        });
    }

    /**
     * Handle participant disconnected
     */
    handleParticipantDisconnected(participant) {
        console.log('Handling participant disconnected:', participant.identity);
        
        // Remove all tracks from this participant
        participant.tracks.forEach((publication) => {
            if (publication.track) {
                this.handleTrackUnsubscribed(publication.track, publication, participant);
            }
        });
    }

    /**
     * Handle track subscribed (audio streams)
     */
    async handleTrackSubscribed(track, publication, participant) {
        try {
            if (track.kind === LivekitClient.Track.Kind.Audio) {
                console.log('Handling audio track subscribed from:', participant.identity);
                
                // CRITICAL: Attach the audio track to an HTML audio element for playback
                const audioElement = track.attach();
                audioElement.id = `audio-${participant.identity}-${track.sid}`;
                audioElement.autoplay = true;
                audioElement.controls = false; // Hide controls for clean UI
                
                // Set the audio output device if configured
                const config = this.configService.getConfig();
                if (config.audioOutputDevice && typeof audioElement.setSinkId === 'function') {
                    try {
                        await audioElement.setSinkId(config.audioOutputDevice);
                        console.log('Audio element sink set to configured output device:', config.audioOutputDevice);
                    } catch (error) {
                        console.warn('Failed to set audio output device for new element:', error);
                    }
                }
                
                // Add the audio element to the streams container
                const streamsContainer = document.getElementById('streams-container');
                if (streamsContainer) {
                    streamsContainer.appendChild(audioElement);
                    console.log('Audio element attached to DOM for playback');
                } else {
                    console.warn('Streams container not found, appending to body');
                    document.body.appendChild(audioElement);
                }
                
                // Create a dummy stream manager object for compatibility
                const streamManager = {
                    stream: {
                        streamId: `${participant.identity}_${track.sid}`,
                        hasAudio: true
                    },
                    subscribeToAudio: (enabled) => {
                        if (publication && publication.setEnabled) {
                            publication.setEnabled(enabled);
                        }
                        // Also control the audio element volume
                        if (audioElement) {
                            audioElement.muted = !enabled;
                        }
                    },
                    track: track,
                    publication: publication,
                    participant: participant,
                    audioElement: audioElement
                };

                // Add to stream manager
                this.audioStreamManager.addStream(streamManager, participant.identity);

                // Apply speaker setting
                if (publication && publication.setEnabled) {
                    publication.setEnabled(this.speaker);
                }
                
                // Also control audio element based on speaker setting
                if (audioElement) {
                    audioElement.muted = !this.speaker;
                }
            }
        } catch (error) {
            console.error('Error handling track subscribed:', error);
        }
    }

    /**
     * Handle track unsubscribed
     */
    handleTrackUnsubscribed(track, publication, participant) {
        try {
            if (track.kind === LivekitClient.Track.Kind.Audio) {
                console.log('Handling audio track unsubscribed from:', participant.identity);
                
                // Remove the audio element from DOM
                const audioElementId = `audio-${participant.identity}-${track.sid}`;
                const audioElement = document.getElementById(audioElementId);
                if (audioElement) {
                    audioElement.remove();
                    console.log('Audio element removed from DOM');
                }
                
                // Detach the track
                track.detach();
                
                const streamId = `${participant.identity}_${track.sid}`;
                this.audioStreamManager.removeStream(streamId);
            }
        } catch (error) {
            console.error('Error handling track unsubscribed:', error);
        }
    }

    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        console.error('Connection error:', error);
        this.updateConnectionStatus(false);
        
        // Provide specific error messages for common issues
        let errorMessage = error.message;
        
        if (error.message.includes('CORS Error')) {
            errorMessage = 'Network connection blocked by CORS policy. Please check server configuration or try using a different network.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to server. Please check your internet connection and server availability.';
        } else if (error.message.includes('HTTP error! status: 0')) {
            errorMessage = 'Network request blocked. This might be due to CORS policy or network connectivity issues.';
        }
        
        this.showError(`Connection failed: ${errorMessage}`);
    }

    /**
     * Handle disconnection with reconnection logic
     */
    handleDisconnection() {
        console.log('Handling disconnection');
        
        this.updateConnectionStatus(false);
        this.audioStreamManager.clearAllStreams();
        
        if (this.connectionAttempts < this.maxConnectionAttempts) {
            this.connectionAttempts++;
            console.log(`Attempting to reconnect (${this.connectionAttempts}/${this.maxConnectionAttempts})...`);
            
            // Clear any existing timeout
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }
            
            // Show reconnecting status
            this.showError(`Connection lost. Reconnecting... (${this.connectionAttempts}/${this.maxConnectionAttempts})`);
            
            // Attempt to reconnect after a delay
            this.reconnectTimeout = setTimeout(async () => {
                try {
                    this.leaveRoom();
                    await this.joinRoom();
                } catch (error) {
                    console.error('Reconnection failed:', error);
                    this.handleConnectionError(error);
                }
            }, this.configService.getReconnectDelay());
            
        } else {
            console.log('Max reconnection attempts reached');
            this.connectionAttempts = 0;
            this.showError('Connection lost. Please check your network and try again.');
        }
    }

    /**
     * Leave room and cleanup
     */
    async leaveRoom() {
        console.log('Leaving room');

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.room) {
            try {
                await this.room.disconnect();
            } catch (error) {
                console.warn('Error disconnecting from room:', error);
            }
        }

        this.updateConnectionStatus(false);
        this.connectionAttempts = 0;
        this.audioStreamManager.clearAllStreams();
        
        // Cleanup
        this.localParticipant = null;
        this.room = null;
        
        this.generateParticipantInfo();
    }

    /**
     * Retry connection
     */
    async retryConnection() {
        console.log('Retrying connection');
        this.hideError();
        this.connectionAttempts = 0;
        
        try {
            await this.leaveRoom();
            await this.joinRoom();
        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    /**
     * Check connection status
     */
    checkConnectionStatus() {
        const isConnected = this.room && this.room.state === LivekitClient.ConnectionState.Connected;
        if (isConnected) {
            console.log('Connection status: OK');
        } else {
            console.log('Connection status: Disconnected');
            // Optionally trigger reconnection
        }
    }

    /**
     * Toggle speaker mute/unmute (affects all incoming audio)
     */
    muteUnmuteSpeaker() {
        try {
            this.speaker = !this.speaker;
            console.log(`Speaker ${this.speaker ? 'unmuted' : 'muted'}`);
            
            // Apply to all current audio tracks
            if (this.room && this.room.participants) {
                this.room.participants.forEach((participant) => {
                    participant.tracks.forEach((publication) => {
                        if (publication.kind === LivekitClient.Track.Kind.Audio && publication.setEnabled) {
                            publication.setEnabled(this.speaker);
                        }
                    });
                });
            }
            
            // Also apply to stream manager for UI consistency
            this.audioStreamManager.muteAllStreams(!this.speaker);
            
            // Update UI
            this.updateSpeakerButton();
            
            // Save to configuration
            this.configService.updateConfig({ speaker: this.speaker });
            
        } catch (error) {
            console.error('Error toggling speaker:', error);
        }
    }

    /**
     * Toggle microphone mute/unmute
     */
    async muteUnmuteMic() {
        try {
            this.microphone = !this.microphone;
            console.log(`Microphone ${this.microphone ? 'unmuted' : 'muted'}`);
            
            // Apply to local participant if available
            if (this.room && this.room.localParticipant) {
                await this.room.localParticipant.setMicrophoneEnabled(this.microphone);
            }
            
            // Update UI
            this.updateMicrophoneButton();
            
            // Save to configuration
            this.configService.updateConfig({ microphone: this.microphone });
            
        } catch (error) {
            console.error('Error toggling microphone:', error);
        }
    }

    /**
     * Update session information display
     */
    updateSessionInfo() {
        if (this.elements.sessionId) {
            this.elements.sessionId.textContent = this.roomName;
        }
        if (this.elements.robotName) {
            this.elements.robotName.textContent = this.participantName || this.roomName;
        }
    }

    /**
     * Update connection status display
     */
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
            this.elements.connectionStatus.className = connected ? 'value connected' : 'value disconnected';
        }
        
        // Update robot name when connected
        if (connected) {
            this.updateSessionInfo();
        }
    }

    /**
     * Update speaker button appearance
     */
    updateSpeakerButton() {
        if (this.elements.speakerBtn) {
            this.elements.speakerBtn.classList.toggle('active', !this.speaker);
        }
        if (this.elements.speakerIcon) {
            this.elements.speakerIcon.textContent = this.speaker ? '🔊' : '🔇';
        }
        if (this.elements.speakerText) {
            this.elements.speakerText.textContent = this.speaker ? 'Mute Speaker' : 'Unmute Speaker';
        }
    }

    /**
     * Update microphone button appearance
     */
    updateMicrophoneButton() {
        if (this.elements.microphoneBtn) {
            this.elements.microphoneBtn.classList.toggle('active', !this.microphone);
        }
        if (this.elements.microphoneIcon) {
            this.elements.microphoneIcon.textContent = this.microphone ? '🎤' : '🔇';
        }
        if (this.elements.microphoneText) {
            this.elements.microphoneText.textContent = this.microphone ? 'Mute Microphone' : 'Unmute Microphone';
        }
    }

    /**
     * Show/hide loading indicator
     */
    showLoading(show) {
        if (this.elements.loading) {
            this.elements.loading.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 'block';
        }
        if (this.elements.errorText) {
            this.elements.errorText.textContent = message;
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.style.display = 'none';
        }
    }

    /**
     * Get room state (for debugging)
     */
    getRoomState() {
        if (!this.room) {
            return { connected: false, room: null };
        }

        return {
            connected: this.room.state === LivekitClient.ConnectionState.Connected,
            roomName: this.roomName,
            participantName: this.participantName,
            participantCount: this.room.participants ? this.room.participants.size + 1 : 1,
            localParticipant: this.localParticipant ? this.localParticipant.identity : null,
            isAudioEnabled: this.microphone,
            isSpeakerEnabled: this.speaker
        };
    }
}

// Global variables for easy access
let app;
let audioStreamManager;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM loaded, initializing application...');
        
        // Check if LiveKit is available
        if (typeof LivekitClient === 'undefined') {
            throw new Error('LiveKit client library not loaded. Please ensure livekit-client.umd.js is included.');
        }
        
        app = new RobotAudioRecorderApp();
        audioStreamManager = app.audioStreamManager; // For global access in onclick handlers
        
        await app.init();
        
        // Setup device selection
        await app.setupDeviceSelection();
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        
        // Show basic error message if app fails to initialize
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = `
            <span>Failed to initialize application: ${error.message}</span>
            <button onclick="location.reload()">Reload Page</button>
        `;
        document.body.appendChild(errorDiv);
    }
});

// Export for debugging
window.app = app;