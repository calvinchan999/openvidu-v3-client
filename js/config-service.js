/**
 * Configuration Service for Robot Audio Recorder (OpenVidu v3)
 * Simplified vanilla JS configuration management
 */
class ConfigService {
    constructor() {
        console.log('ConfigService Init');
        
        // Default app configuration
        this.appConfig = {
            production: false,
            robotId: 'robot-001',
            server: {
                endpoint: 'http://localhost:3000'
            },
            speaker: true,
            microphone: true,
            audioDevice: '',
            maxConnectionAttempts: 3,
            reconnectDelay: 5000,
            connectionTimeout: 10000,
            openviduVersion: 'v3',
            api: {
                token: '/application-server/api/token',
                health: '/application-server/health'
            }
        };

        console.log('Default configuration:', this.appConfig);
    }

    /**
     * Load configuration from dashboard-config.json
     * @returns {Promise<void>}
     */
    async loadAppConfig() {
        try {
            // Try Docker-specific config first, then fallback to default
            let configPath = 'assets/config/dashboard-config.json';
            
            // Check if we're in Docker environment by trying Docker config
            try {
                const dockerResponse = await fetch('assets/config/dashboard-config-docker.json');
                if (dockerResponse.ok) {
                    configPath = 'assets/config/dashboard-config-docker.json';
                    console.log('Using Docker configuration');
                }
            } catch (dockerError) {
                console.log('Docker config not found, using default config');
            }
            
            console.log('Loading configuration from:', configPath);
            
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const remoteConfig = await response.json();
            console.log('### ConfigService loaded dashboard config:', remoteConfig);
            
            // Merge remote config with defaults (remote config takes priority)
            this.appConfig = { 
                ...this.appConfig,
                ...remoteConfig 
            };
            
            console.log('Final merged configuration:', this.appConfig);
            
        } catch (error) {
            console.log('ConfigService loadAppConfig error:', error);
            console.log('Using default configuration');
        }
    }

    /**
     * Load configuration from local storage if available
     */
    loadLocalConfig() {
        try {
            const localConfig = localStorage.getItem('robotAudioRecorderConfig');
            if (localConfig) {
                const parsedConfig = JSON.parse(localConfig);
                console.log('Loading local configuration:', parsedConfig);
                
                // Merge with existing config (local config overrides for user preferences)
                this.appConfig = {
                    ...this.appConfig,
                    ...parsedConfig
                };
            }
        } catch (error) {
            console.log('Error loading local configuration:', error);
        }
    }

    /**
     * Save current configuration to local storage
     */
    saveLocalConfig() {
        try {
            // Only save user preferences, not the entire config
            const userPrefs = {
                speaker: this.appConfig.speaker,
                microphone: this.appConfig.microphone,
                audioDevice: this.appConfig.audioDevice
            };
            localStorage.setItem('robotAudioRecorderConfig', JSON.stringify(userPrefs));
            console.log('User preferences saved to local storage');
        } catch (error) {
            console.log('Error saving configuration to local storage:', error);
        }
    }

    /**
     * Get the current configuration
     * @returns {Object} Current configuration object
     */
    getConfig() {
        return this.appConfig;
    }

    /**
     * Update user preferences
     * @param {Object} updates - Configuration updates
     */
    updateConfig(updates) {
        this.appConfig = {
            ...this.appConfig,
            ...updates
        };
        this.saveLocalConfig();
        console.log('Configuration updated:', updates);
    }

    /**
     * Get server endpoint URL
     * @returns {string} Server endpoint
     */
    getServerEndpoint() {
        return this.appConfig.server?.endpoint || 'http://localhost:3000';
    }

    /**
     * Get robot ID
     * @returns {string} Robot ID
     */
    getRobotId() {
        return this.appConfig.robotId || 'robot-001';
    }

    /**
     * Get speaker initial state
     * @returns {boolean} Speaker state
     */
    getSpeakerState() {
        return this.appConfig.speaker !== undefined ? this.appConfig.speaker : true;
    }

    /**
     * Get microphone initial state
     * @returns {boolean} Microphone state
     */
    getMicrophoneState() {
        return this.appConfig.microphone !== undefined ? this.appConfig.microphone : true;
    }

    /**
     * Get maximum connection attempts
     * @returns {number} Max connection attempts
     */
    getMaxConnectionAttempts() {
        return this.appConfig.maxConnectionAttempts || 3;
    }

    /**
     * Get reconnection delay in milliseconds
     * @returns {number} Reconnection delay
     */
    getReconnectDelay() {
        return this.appConfig.reconnectDelay || 5000;
    }

    /**
     * Get API endpoints configuration
     * @returns {Object} API endpoints
     */
    getApiConfig() {
        return this.appConfig.api || {
            token: '/api/token',
            health: '/health'
        };
    }

    /**
     * Get preferred audio device ID
     * @returns {string} Audio device ID
     */
    getAudioDevice() {
        return this.appConfig.audioDevice || '';
    }

    /**
     * Set preferred audio device ID
     * @param {string} deviceId - Audio device ID
     */
    setAudioDevice(deviceId) {
        this.appConfig.audioDevice = deviceId;
        this.saveLocalConfig();
        console.log('Audio input device updated:', deviceId);
    }

    /**
     * Get preferred audio output device ID
     * @returns {string} Audio output device ID
     */
    getAudioOutputDevice() {
        return this.appConfig.audioOutputDevice || '';
    }

    /**
     * Set preferred audio output device ID
     * @param {string} deviceId - Audio output device ID
     */
    setAudioOutputDevice(deviceId) {
        this.appConfig.audioOutputDevice = deviceId;
        this.saveLocalConfig();
        console.log('Audio output device updated:', deviceId);
    }
}

// Export for use in other modules
window.ConfigService = ConfigService;