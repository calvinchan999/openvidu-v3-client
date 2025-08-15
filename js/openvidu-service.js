/**
 * OpenVidu v3 Service for Robot Audio Recorder
 * Simplified service for OpenVidu v3 (LiveKit) token-based API
 */
class OpenViduV3Service {
    constructor(configService) {
        this.configService = configService;
        this.baseUrl = this.configService.getServerEndpoint();
        
        console.log('OpenViduV3Service initialized with baseUrl:', this.baseUrl);
    }

    /**
     * Get a token from the OpenVidu v3 API server
     * @param {string} roomName - Room name to join
     * @param {string} participantName - Participant name
     * @returns {Promise<Object>} Token and LiveKit URL
     */
    async getToken(roomName, participantName) {
        try {
            const apiConfig = this.configService.getApiConfig();
            const url = `${this.baseUrl}${apiConfig.token}`;
            const data = { 
                roomName: roomName,
                participantName: participantName
            };

            console.log('Requesting token:', { url, data });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`Token generation failed: ${result.error || 'Unknown error'}`);
            }

            const { token, livekitUrl } = result.data;
            
            if (!token || typeof token !== 'string') {
                throw new Error(`Invalid token received: ${typeof token}`);
            }

            console.log('Token received successfully');
            return { token, livekitUrl };

        } catch (error) {
            console.error('Error getting token:', error);
            
            // Check for specific CORS error
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error(`CORS Error: Unable to connect to server. Please check if the server allows requests from this origin.`);
            }
            
            throw new Error(`Failed to get token: ${error.message}`);
        }
    }

    /**
     * Check server health/status
     * @returns {Promise<Object>} Server status
     */
    async checkServerStatus() {
        try {
            const apiConfig = this.configService.getApiConfig();
            const url = `${this.baseUrl}${apiConfig.health}`;

            console.log('Checking server status:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Server status:', result);
            return result;

        } catch (error) {
            console.error('Error checking server status:', error);
            throw new Error(`Failed to check server status: ${error.message}`);
        }
    }

    /**
     * Update the base URL if configuration changes
     * @param {string} newBaseUrl - New base URL
     */
    updateBaseUrl(newBaseUrl) {
        this.baseUrl = newBaseUrl;
        console.log('OpenViduV3Service baseUrl updated to:', this.baseUrl);
    }

    /**
     * Get current base URL
     * @returns {string} Current base URL
     */
    getBaseUrl() {
        return this.baseUrl;
    }

    /**
     * Handle network errors with retry logic
     * @param {Function} operation - The operation to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} delay - Delay between retries in ms
     * @returns {Promise<any>} Operation result
     */
    async retryOperation(operation, maxRetries = 3, delay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${maxRetries}`);
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt} failed:`, error.message);

                if (attempt < maxRetries) {
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 1.5; // Exponential backoff
                }
            }
        }

        throw lastError;
    }
}

// Export for use in other modules
window.OpenViduV3Service = OpenViduV3Service;

// Maintain backward compatibility
window.OpenViduService = OpenViduV3Service;