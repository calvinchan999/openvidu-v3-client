/**
 * Audio Stream Manager for Robot Audio Recorder (OpenVidu v3/LiveKit)
 * Simplified audio track management for LiveKit
 */
class AudioStreamManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.streams = new Map(); // streamId -> streamInfo
        
        if (!this.container) {
            throw new Error(`Container with id '${containerId}' not found`);
        }

        console.log('AudioStreamManager (v3) initialized');
    }

    /**
     * Add a new audio track to the display
     * @param {Object} streamManager - Compatibility object containing track info
     * @param {string} participantName - Name of the participant
     */
    addStream(streamManager, participantName = 'Unknown') {
        const streamId = streamManager.stream.streamId;
        
        if (this.streams.has(streamId)) {
            console.warn('Stream already exists:', streamId);
            return;
        }

        console.log('Adding audio track:', { streamId, participantName });

        const streamElement = this.createStreamElement(streamManager, participantName);
        this.container.appendChild(streamElement);

        // Store stream info
        this.streams.set(streamId, {
            streamManager,
            participantName,
            element: streamElement,
            isMuted: false,
            publication: streamManager.publication
        });

        // Setup simple visual indicator
        this.setupAudioIndicator(streamId);

        // Update empty state
        this.updateEmptyState();

        console.log('Audio track added successfully');
    }

    /**
     * Remove a track from the display
     * @param {string} streamId - Stream ID to remove
     */
    removeStream(streamId) {
        const streamInfo = this.streams.get(streamId);
        
        if (!streamInfo) {
            console.warn('Stream not found for removal:', streamId);
            return;
        }

        console.log('Removing audio track:', streamId);

        // Remove DOM element
        if (streamInfo.element && streamInfo.element.parentNode) {
            streamInfo.element.parentNode.removeChild(streamInfo.element);
        }

        // Remove from map
        this.streams.delete(streamId);

        // Update empty state
        this.updateEmptyState();

        console.log('Audio track removed successfully');
    }

    /**
     * Create HTML element for a track
     * @param {Object} streamManager - Compatibility object containing track info
     * @param {string} participantName - Participant name
     * @returns {HTMLElement} Stream element
     */
    createStreamElement(streamManager, participantName) {
        const streamElement = document.createElement('div');
        streamElement.className = 'stream-item';
        streamElement.id = `stream-${streamManager.stream.streamId}`;

        streamElement.innerHTML = `
            <div class="audio-indicator" id="indicator-${streamManager.stream.streamId}">
                🎤
            </div>
            <div class="stream-info">
                <div class="stream-name">${this.escapeHtml(participantName)}</div>
                <div class="stream-status">Connected</div>
            </div>
            <div class="stream-controls">
                <button class="control-btn small" onclick="audioStreamManager.toggleStreamMute('${streamManager.stream.streamId}')" 
                        id="mute-btn-${streamManager.stream.streamId}">
                    <span class="icon">🔊</span>
                </button>
            </div>
        `;

        return streamElement;
    }

    /**
     * Setup simple audio indicator animation
     * @param {string} streamId - Stream ID
     */
    setupAudioIndicator(streamId) {
        const indicator = document.getElementById(`indicator-${streamId}`);
        if (indicator) {
            // Simple animation to show audio activity
            let isActive = false;
            const interval = setInterval(() => {
                // Check if the stream still exists
                if (!this.streams.has(streamId)) {
                    clearInterval(interval);
                    return;
                }
                
                isActive = !isActive;
                indicator.classList.toggle('active', isActive);
            }, 1500);
        }
    }

    /**
     * Toggle mute state for a specific track
     * @param {string} streamId - Stream ID to toggle
     */
    toggleStreamMute(streamId) {
        const streamInfo = this.streams.get(streamId);
        
        if (!streamInfo) {
            console.warn('Stream not found for mute toggle:', streamId);
            return;
        }

        try {
            const isMuted = streamInfo.isMuted;
            const newMutedState = !isMuted;
            
            // Toggle track enabled state via publication
            if (streamInfo.publication && streamInfo.publication.setEnabled) {
                streamInfo.publication.setEnabled(!newMutedState);
                streamInfo.isMuted = newMutedState;
            } else if (streamInfo.streamManager && streamInfo.streamManager.subscribeToAudio) {
                // Fallback to old API for compatibility
                streamInfo.streamManager.subscribeToAudio(!newMutedState);
                streamInfo.isMuted = newMutedState;
            } else {
                console.warn('No method available to toggle track mute');
                return;
            }

            // Also control the HTML audio element directly
            if (streamInfo.streamManager && streamInfo.streamManager.audioElement) {
                streamInfo.streamManager.audioElement.muted = newMutedState;
                console.log(`Audio element muted state set to: ${newMutedState}`);
            }

            // Update UI
            this.updateMuteButton(streamId, newMutedState);
            this.updateAudioIndicator(streamId, newMutedState);

            console.log(`Track ${streamId} ${newMutedState ? 'muted' : 'unmuted'}`);

        } catch (error) {
            console.error('Error toggling track mute:', error);
        }
    }

    /**
     * Update mute button appearance
     * @param {string} streamId - Stream ID
     * @param {boolean} isMuted - Whether track is muted
     */
    updateMuteButton(streamId, isMuted) {
        const button = document.getElementById(`mute-btn-${streamId}`);
        if (button) {
            const icon = button.querySelector('.icon');
            if (icon) {
                icon.textContent = isMuted ? '🔇' : '🔊';
            }
            button.classList.toggle('active', isMuted);
            button.title = isMuted ? 'Unmute' : 'Mute';
        }
    }

    /**
     * Update audio indicator appearance
     * @param {string} streamId - Stream ID
     * @param {boolean} isMuted - Whether track is muted
     */
    updateAudioIndicator(streamId, isMuted) {
        const indicator = document.getElementById(`indicator-${streamId}`);
        if (indicator) {
            indicator.classList.toggle('muted', isMuted);
            indicator.textContent = isMuted ? '🔇' : '🎤';
        }
    }

    /**
     * Mute/unmute all tracks
     * @param {boolean} mute - True to mute all, false to unmute all
     */
    muteAllStreams(mute) {
        console.log(`${mute ? 'Muting' : 'Unmuting'} all tracks`);
        
        this.streams.forEach((streamInfo, streamId) => {
            try {
                // Use LiveKit publication API if available
                if (streamInfo.publication && streamInfo.publication.setEnabled) {
                    streamInfo.publication.setEnabled(!mute);
                } else if (streamInfo.streamManager && streamInfo.streamManager.subscribeToAudio) {
                    // Fallback to old API
                    streamInfo.streamManager.subscribeToAudio(!mute);
                }
                
                // Also control the HTML audio element directly
                if (streamInfo.streamManager && streamInfo.streamManager.audioElement) {
                    streamInfo.streamManager.audioElement.muted = mute;
                }
                
                streamInfo.isMuted = mute;
                
                this.updateMuteButton(streamId, mute);
                this.updateAudioIndicator(streamId, mute);
            } catch (error) {
                console.error(`Error ${mute ? 'muting' : 'unmuting'} track ${streamId}:`, error);
            }
        });
    }

    /**
     * Clear all tracks
     */
    clearAllStreams() {
        console.log('Clearing all tracks');
        
        // Get all stream IDs to avoid modifying map during iteration
        const streamIds = Array.from(this.streams.keys());
        
        streamIds.forEach(streamId => {
            this.removeStream(streamId);
        });
    }

    /**
     * Update empty state display
     */
    updateEmptyState() {
        const hasStreams = this.streams.size > 0;
        
        // Remove existing empty state
        const existingEmptyState = this.container.querySelector('.empty-state');
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        // Add empty state if no streams
        if (!hasStreams) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <h3>No Audio Tracks</h3>
                <p>Waiting for participants to join the room...</p>
            `;
            this.container.appendChild(emptyState);
        }
    }

    /**
     * Get track count
     * @returns {number} Number of active tracks
     */
    getStreamCount() {
        return this.streams.size;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} unsafe - Unsafe string
     * @returns {string} Safe HTML string
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Export for use in other modules
window.AudioStreamManager = AudioStreamManager;