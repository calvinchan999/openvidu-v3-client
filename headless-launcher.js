require("dotenv").config();
const puppeteer = require("puppeteer");
const path = require("path");

// Configuration
const config = {
    websiteUrl: process.env.WEBSITE_URL || "http://localhost:8080",
    robotId: process.env.ROBOT_ID || "robot-headless-001",
    sessionName: process.env.SESSION_NAME || "HeadlessSession",
    enableLogging: process.env.ENABLE_LOGGING !== "false",
    keepAlive: process.env.KEEP_ALIVE !== "false",
    reconnectDelay: parseInt(process.env.RECONNECT_DELAY) || 5000,
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10
};

let browser = null;
let page = null;
let reconnectAttempts = 0;

async function setupAudioDevices(page) {
    // Override getUserMedia to provide fake audio stream
    await page.evaluateOnNewDocument(() => {
        // Mock audio context for fake audio
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        
        navigator.mediaDevices.getUserMedia = async function(constraints) {
            console.log('getUserMedia called with constraints:', constraints);
            
            if (constraints.audio) {
                // Create a fake audio stream using Web Audio API
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                const destination = audioContext.createMediaStreamDestination();
                
                // Create a subtle tone (optional - can be silent)
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
                gainNode.gain.setValueAtTime(0.01, audioContext.currentTime); // Very low volume
                
                oscillator.connect(gainNode);
                gainNode.connect(destination);
                oscillator.start();
                
                console.log('Created fake audio stream');
                return destination.stream;
            }
            
            return originalGetUserMedia.call(this, constraints);
        };
        
        // Override enumerateDevices to provide fake devices
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = async function() {
            const devices = await originalEnumerateDevices.call(this);
            
            // Add fake audio devices if none exist
            const hasAudioInput = devices.some(d => d.kind === 'audioinput');
            const hasAudioOutput = devices.some(d => d.kind === 'audiooutput');
            
            if (!hasAudioInput) {
                devices.push({
                    deviceId: 'fake-audio-input',
                    kind: 'audioinput',
                    label: 'Fake Microphone',
                    groupId: 'fake-group-input'
                });
            }
            
            if (!hasAudioOutput) {
                devices.push({
                    deviceId: 'fake-audio-output',
                    kind: 'audiooutput',
                    label: 'Fake Speaker',
                    groupId: 'fake-group-output'
                });
            }
            
            console.log('Available devices:', devices);
            return devices;
        };
    });
}

async function setupPageLogging(page) {
    if (!config.enableLogging) return;
    
    // Console logging
    page.on("console", (msg) => {
        const type = msg.type();
        const text = msg.text();
        console.log(`[BROWSER ${type.toUpperCase()}]:`, text);
    });
    
    // Error logging
    page.on("pageerror", (error) => {
        console.error("[BROWSER ERROR]:", error.message);
    });
    
    // Request/Response logging (optional)
    page.on("request", (request) => {
        if (request.url().includes('/api/') || request.url().includes('/health')) {
            console.log(`[REQUEST]: ${request.method()} ${request.url()}`);
        }
    });
    
    page.on("response", (response) => {
        if (response.url().includes('/api/') || response.url().includes('/health')) {
            console.log(`[RESPONSE]: ${response.status()} ${response.url()}`);
        }
    });
}

async function launchBrowser() {
    console.log("🚀 Launching headless browser...");
    
    browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome-stable",
        ignoreDefaultArgs: ['--mute-audio'],
        args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--allow-file-access-from-files",
            "--autoplay-policy=no-user-gesture-required",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--disable-web-security",
            "--allow-running-insecure-content",
            "--unsafely-treat-insecure-origin-as-secure=http://localhost:8080",
            "--disable-features=VizDisplayCompositor",
            "--hide-scrollbars",
            "--incognito",
            // Audio-specific flags
            "--enable-audio-service-sandbox=false",
            "--disable-audio-sandbox",
            "--allow-loopback-in-peer-connection",
            // Memory optimizations
            "--max_old_space_size=4096",
            "--memory-pressure-off"
        ]
    });
    
    console.log("✅ Browser launched successfully");
    return browser;
}

async function setupPage() {
    const [firstPage] = await browser.pages();
    page = firstPage;
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Setup audio device mocking
    await setupAudioDevices(page);
    
    // Setup logging
    await setupPageLogging(page);
    
    // Set extra HTTP headers if needed
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Robot-Audio-Recorder-Headless/1.0'
    });
    
    console.log("✅ Page setup complete");
    return page;
}

async function navigateToApp() {
    console.log(`🌐 Navigating to: ${config.websiteUrl}`);
    
    try {
        const response = await page.goto(config.websiteUrl, {
            waitUntil: "networkidle0",
            timeout: 30000
        });
        
        if (!response.ok()) {
            throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
        }
        
        console.log("✅ Successfully loaded the application");
        
        // Wait for the app to initialize
        await page.waitForSelector('.container', { timeout: 10000 });
        console.log("✅ Application container found");
        
        // Wait for device selection to appear (it should be visible)
        await page.waitForSelector('#device-selection', { timeout: 5000 });
        console.log("✅ Device selection panel found");
        
        return true;
    } catch (error) {
        console.error("❌ Failed to navigate to application:", error.message);
        return false;
    }
}

async function waitForConnection() {
    console.log("⏳ Waiting for connection...");
    
    try {
        // Wait for connection status to change from "Disconnected"
        await page.waitForFunction(() => {
            const statusElement = document.getElementById('connection-status');
            return statusElement && statusElement.textContent !== 'Disconnected';
        }, { timeout: 30000 });
        
        console.log("✅ Connection established!");
        
        // Log the final connection status
        const connectionStatus = await page.$eval('#connection-status', el => el.textContent);
        const sessionId = await page.$eval('#session-id', el => el.textContent);
        const robotName = await page.$eval('#robot-name', el => el.textContent);
        
        console.log(`📊 Connection Status: ${connectionStatus}`);
        console.log(`🔗 Session ID: ${sessionId}`);
        console.log(`🤖 Robot Name: ${robotName}`);
        
        return true;
    } catch (error) {
        console.error("❌ Connection timeout:", error.message);
        return false;
    }
}

async function monitorConnection() {
    console.log("👁️ Starting connection monitoring...");
    
    setInterval(async () => {
        try {
            if (!page || page.isClosed()) {
                console.log("⚠️ Page is closed, attempting to reconnect...");
                await reconnect();
                return;
            }
            
            const connectionStatus = await page.$eval('#connection-status', el => el.textContent);
            
            if (connectionStatus === 'Disconnected') {
                console.log("⚠️ Connection lost, attempting to reconnect...");
                await reconnect();
            } else {
                // Reset reconnect attempts on successful connection
                reconnectAttempts = 0;
            }
        } catch (error) {
            console.error("❌ Error during monitoring:", error.message);
            await reconnect();
        }
    }, 10000); // Check every 10 seconds
}

async function reconnect() {
    if (reconnectAttempts >= config.maxReconnectAttempts) {
        console.error(`❌ Max reconnection attempts (${config.maxReconnectAttempts}) reached. Exiting.`);
        process.exit(1);
    }
    
    reconnectAttempts++;
    console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${config.maxReconnectAttempts}`);
    
    try {
        // Close existing browser if it exists
        if (browser) {
            await browser.close();
        }
        
        // Wait before reconnecting
        await new Promise(resolve => setTimeout(resolve, config.reconnectDelay));
        
        // Restart the entire process
        await startApp();
    } catch (error) {
        console.error("❌ Reconnection failed:", error.message);
        // Try again after delay
        setTimeout(reconnect, config.reconnectDelay);
    }
}

async function startApp() {
    try {
        console.log("🎯 Starting Robot Audio Recorder Headless...");
        console.log("⚙️ Configuration:", config);
        
        // Launch browser
        await launchBrowser();
        
        // Setup page
        await setupPage();
        
        // Navigate to application
        const navigationSuccess = await navigateToApp();
        if (!navigationSuccess) {
            throw new Error("Failed to navigate to application");
        }
        
        // Wait for connection
        const connectionSuccess = await waitForConnection();
        if (!connectionSuccess) {
            throw new Error("Failed to establish connection");
        }
        
        console.log("🎉 Robot Audio Recorder is running in headless mode!");
        
        // Start monitoring if keep alive is enabled
        if (config.keepAlive) {
            await monitorConnection();
        }
        
    } catch (error) {
        console.error("❌ Application startup failed:", error.message);
        
        if (config.keepAlive && reconnectAttempts < config.maxReconnectAttempts) {
            console.log("🔄 Attempting to restart...");
            await reconnect();
        } else {
            process.exit(1);
        }
    }
}

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n🛑 Received SIGINT, shutting down gracefully...");
    
    if (browser) {
        await browser.close();
    }
    
    console.log("✅ Shutdown complete");
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
    
    if (browser) {
        await browser.close();
    }
    
    console.log("✅ Shutdown complete");
    process.exit(0);
});

// Start the application
startApp();
