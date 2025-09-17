require("dotenv").config();
const puppeteer = require("puppeteer");

(async () => {
  try {
    console.log("🚀 Launching improved headless browser for OpenVidu v3...");
    
    // Generate participant name with unique suffix
    const robotId = process.env.ROBOT_ID || 'robot-001';
    const participantNamePrefix = process.env.PARTICIPANT_NAME_PREFIX || robotId;
    const suffixLength = parseInt(process.env.PARTICIPANT_NAME_SUFFIX_LENGTH) || 8;
    const generationMethod = process.env.PARTICIPANT_NAME_GENERATION || 'timestamp';
    
    let participantName;
    if (generationMethod === 'random') {
      // Generate random suffix
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const suffix = Array.from({length: suffixLength}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      participantName = `${participantNamePrefix}_${suffix}`;
    } else {
      // Use timestamp-based suffix (default)
      const timestamp = Date.now().toString(36);
      participantName = `${participantNamePrefix}_${timestamp}`;
    }
    
    // Log environment variables for debugging
    console.log("🔧 Environment Configuration:");
    console.log(`   - ROBOT_ID: ${robotId}`);
    console.log(`   - PARTICIPANT_NAME: ${participantName}`);
    console.log(`   - WEBSITE_URL: ${process.env.WEBSITE_URL}`);
    console.log(`   - TARGET_SERVER: ${process.env.TARGET_SERVER}`);
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    
    // Get Chrome arguments from environment or use minimal headless-compatible config
    const chromeArgs = process.env.CHROME_ARGS ? 
      process.env.CHROME_ARGS.split(',') : [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required"
      ];
    
    // Launch the browser with retry logic
    let browser;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`🚀 Attempting to launch browser (attempt ${retryCount + 1}/${maxRetries})...`);
        
        browser = await puppeteer.launch({
          headless: "new",  // Use new headless mode for better compatibility
          executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome-stable",
          ignoreDefaultArgs: ['--mute-audio', '--disable-extensions'],  // Minimal ignores
          args: chromeArgs,
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
          timeout: 30000,
          protocolTimeout: 10000
        });
        
        console.log("✅ Browser launched successfully!");
        break;
        
      } catch (error) {
        retryCount++;
        console.log(`❌ Browser launch attempt ${retryCount} failed:`, error.message);
        
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to launch browser after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        console.log(`⏳ Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Get the default page like v2 config
    const [page] = await browser.pages();
    
    // Enhanced console logging with filtering based on environment
    const logLevel = process.env.LOG_LEVEL || 'info';
    const enableLogging = process.env.ENABLE_LOGGING === 'true';
    
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      
      if (!enableLogging) return;
      
      // Filter out verbose logs to focus on important ones
      if (text.includes('Token received') || 
          text.includes('Room connected') || 
          text.includes('Connected to room') ||
          text.includes('Application initialized') ||
          text.includes('Error') ||
          text.includes('Warning')) {
        console.log(`[BROWSER ${type.toUpperCase()}]:`, text);
      }
    });
    
    // Enhanced error logging
    page.on("pageerror", (error) => {
      console.error("[BROWSER ERROR]:", error.message);
      
      // Handle specific OpenVidu v3 errors
      if (error.message.includes('enableMicrophone is not a function')) {
        console.log("⚠️ OpenVidu v3 API change detected - enableMicrophone method not found");
        console.log("💡 This is expected in OpenVidu v3 - microphone handling is different");
      }
    });
    
    // Navigate to the OpenVidu v3 application
    const websiteUrl = process.env.WEBSITE_URL || "http://localhost:8080";
    const connectionTimeout = parseInt(process.env.CONNECTION_TIMEOUT) || 30000;
    console.log(`🌐 Navigating to: ${websiteUrl}`);
    
    await page.goto(websiteUrl, {
      waitUntil: "networkidle0",
      timeout: connectionTimeout
    });
    
    console.log("✅ Successfully loaded the OpenVidu v3 application");
    
    // Inject audio device access helpers
    await page.evaluate(() => {
      console.log("Injecting audio device access helpers...");
      
      // Override getUserMedia to provide fake devices if needed
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          console.log("getUserMedia called with constraints:", constraints);
          
          try {
            // Try to get real devices first
            const stream = await originalGetUserMedia(constraints);
            console.log("Successfully got real media stream");
            return stream;
          } catch (error) {
            console.log("Failed to get real media stream, using fake stream:", error.message);
            
            // Create a fake audio stream if real devices fail
            if (constraints.audio) {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
              
              // Create a MediaStream from the audio context
              const destination = audioContext.createMediaStreamDestination();
              gainNode.connect(destination);
              
              return destination.stream;
            }
            
            throw error;
          }
        };
      }
      
      // Override enumerateDevices to provide fake devices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        
        navigator.mediaDevices.enumerateDevices = async () => {
          try {
            const devices = await originalEnumerateDevices();
            console.log("Successfully enumerated real devices:", devices.length);
            return devices;
          } catch (error) {
            console.log("Failed to enumerate real devices, providing fake devices:", error.message);
            
            // Return fake devices
            return [
              {
                deviceId: "fake-audio-input",
                kind: "audioinput",
                label: "Fake Microphone",
                groupId: "fake-group"
              },
              {
                deviceId: "fake-audio-output",
                kind: "audiooutput", 
                label: "Fake Speaker",
                groupId: "fake-group"
              }
            ];
          }
        };
      }
      
      console.log("Audio device access helpers injected successfully");
    });
    
    // Inject participant name and robot ID into the page context
    console.log(`🎭 Setting participant name: ${participantName}`);
    await page.evaluate((robotId, participantName) => {
      // Set global variables for the OpenVidu application
      window.ROBOT_ID = robotId;
      window.PARTICIPANT_NAME = participantName;
      
      // Also set in localStorage and sessionStorage for persistence
      if (localStorage) {
        localStorage.setItem('robotId', robotId);
        localStorage.setItem('participantName', participantName);
        localStorage.setItem('defaultParticipantName', participantName);
        localStorage.setItem('openvidu_participant_name', participantName);
        localStorage.setItem('openvidu_room_name', robotId);
      }
      
      if (sessionStorage) {
        sessionStorage.setItem('robotId', robotId);
        sessionStorage.setItem('participantName', participantName);
        sessionStorage.setItem('defaultParticipantName', participantName);
        sessionStorage.setItem('openvidu_participant_name', participantName);
        sessionStorage.setItem('openvidu_room_name', robotId);
      }
      
      // Dispatch custom event for the application to listen to
      window.dispatchEvent(new CustomEvent('robotConfig', { 
        detail: { 
          robotId: robotId, 
          participantName: participantName 
        } 
      }));
      
      console.log(`Robot configured: ${robotId} as ${participantName}`);
      return { robotId, participantName };
    }, robotId, participantName);
    
    // Wait a bit for the page to fully load, then set participant name
    console.log("⏳ Waiting for OpenVidu application to initialize...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to set participant name in OpenVidu application
    console.log(`🎭 Attempting to set participant name in OpenVidu app: ${participantName}`);
    try {
      await page.evaluate((participantName) => {
        console.log(`Setting participant name to: ${participantName}`);
        
        // Method 1: Look for participant name input fields
        const participantInputs = [
          document.querySelector('input[name="participantName"]'),
          document.querySelector('input[placeholder*="participant"]'),
          document.querySelector('input[placeholder*="Participant"]'),
          document.querySelector('input[placeholder*="name"]'),
          document.querySelector('input[placeholder*="Name"]'),
          document.querySelector('#participantName'),
          document.querySelector('[data-testid="participant-name"]'),
          document.querySelector('.participant-name-input'),
          document.querySelector('[class*="participant-name"]'),
          document.querySelector('[class*="participantName"]'),
          // OpenVidu specific selectors
          document.querySelector('input[formcontrolname="participantName"]'),
          document.querySelector('input[ng-model="participantName"]'),
          document.querySelector('input[data-ng-model="participantName"]')
        ];
        
        participantInputs.forEach(input => {
          if (input) {
            input.value = participantName;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            console.log(`Set participant name input to: ${participantName}`);
          }
        });
        
        // Method 2: Try to set OpenVidu-specific configuration
        if (window.OV) {
          console.log('OpenVidu object found, setting participant name');
          if (window.OV.participantName !== undefined) {
            window.OV.participantName = participantName;
          }
        }
        
        // Method 3: Look for Angular/React components
        const angularElements = document.querySelectorAll('[ng-model], [data-ng-model], [formcontrolname]');
        angularElements.forEach(el => {
          const attr = el.getAttribute('ng-model') || el.getAttribute('data-ng-model') || el.getAttribute('formcontrolname');
          if (attr && attr.toLowerCase().includes('participant')) {
            el.value = participantName;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`Set Angular/React participant field: ${attr} = ${participantName}`);
          }
        });
        
        // Method 4: Try to find and fill any form with participant name
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          const inputs = form.querySelectorAll('input[type="text"], input[type="email"]');
          inputs.forEach(input => {
            const placeholder = input.placeholder || '';
            const name = input.name || '';
            if (placeholder.toLowerCase().includes('participant') || 
                placeholder.toLowerCase().includes('name') ||
                name.toLowerCase().includes('participant') ||
                name.toLowerCase().includes('name')) {
              input.value = participantName;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              console.log(`Set form participant field: ${name} = ${participantName}`);
            }
          });
        });
        
        return `Attempted to set participant name to: ${participantName}`;
      }, participantName);
      
      console.log("✅ Participant name setting script executed");
    } catch (error) {
      console.log("⚠️ Could not set participant name:", error.message);
    }
    
    // Try to set the room name using ROBOT_ID if available
    if (process.env.ROBOT_ID) {
      console.log(`🎯 Attempting to set room name to: ${process.env.ROBOT_ID}`);
      try {
        // Try to set room name by injecting script into the page
        await page.evaluate((robotId) => {
          console.log(`Setting room name to: ${robotId}`);
          
          // Try multiple ways to set the room name
          // Method 1: Look for room name input fields
          const roomInputs = [
            document.querySelector('input[name="roomName"]'),
            document.querySelector('input[placeholder*="room"]'),
            document.querySelector('input[placeholder*="Room"]'),
            document.querySelector('#roomName'),
            document.querySelector('[data-testid="room-name"]'),
            document.querySelector('.room-name-input')
          ];
          
          roomInputs.forEach(input => {
            if (input) {
              input.value = robotId;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              console.log(`Set room name input to: ${robotId}`);
            }
          });
          
          // Method 2: Try to set localStorage if the app uses it
          if (localStorage) {
            localStorage.setItem('roomName', robotId);
            localStorage.setItem('defaultRoom', robotId);
            console.log(`Set localStorage room name to: ${robotId}`);
          }
          
          // Method 3: Try to set sessionStorage
          if (sessionStorage) {
            sessionStorage.setItem('roomName', robotId);
            sessionStorage.setItem('defaultRoom', robotId);
            console.log(`Set sessionStorage room name to: ${robotId}`);
          }
          
          // Method 4: Dispatch custom event
          window.dispatchEvent(new CustomEvent('setRoomName', { 
            detail: { roomName: robotId } 
          }));
          
          return `Attempted to set room name to: ${robotId}`;
        }, process.env.ROBOT_ID);
        
        console.log("✅ Room name setting script executed");
      } catch (error) {
        console.log("⚠️ Could not set room name:", error.message);
      }
    }
    
    // Wait for the app to initialize with better selectors
    try {
      await page.waitForSelector('.container, #app, .openvidu-app, [data-testid="app"]', { timeout: 15000 });
      console.log("✅ Application loaded successfully");
    } catch (error) {
      console.log("⚠️ Could not find specific container, but page loaded");
    }
    
    // Monitor connection status
    console.log("🔍 Monitoring OpenVidu v3 connection status...");
    
    // Monitor room name usage
    console.log("🔍 Monitoring room name usage...");
    try {
      const roomNameInfo = await page.evaluate(() => {
        // Look for room name in various places
        const roomNameElements = [
          document.querySelector('input[name="roomName"]'),
          document.querySelector('input[placeholder*="room"]'),
          document.querySelector('#roomName'),
          document.querySelector('[data-testid="room-name"]'),
          document.querySelector('.room-name-input'),
          document.querySelector('[class*="room-name"]'),
          document.querySelector('[class*="roomName"]')
        ];
        
        const roomNames = roomNameElements
          .filter(el => el && el.value)
          .map(el => ({ element: el.tagName, value: el.value }));
        
        // Check localStorage and sessionStorage
        const storageInfo = {
          localStorage: {
            roomName: localStorage.getItem('roomName'),
            defaultRoom: localStorage.getItem('defaultRoom')
          },
          sessionStorage: {
            roomName: sessionStorage.getItem('roomName'),
            defaultRoom: sessionStorage.getItem('defaultRoom')
          }
        };
        
        return { roomNames, storageInfo };
      });
      
      console.log("📊 Room name information:", JSON.stringify(roomNameInfo, null, 2));
    } catch (error) {
      console.log("⚠️ Could not get room name info:", error.message);
    }
    
    // Monitor participant name usage
    console.log("🔍 Monitoring participant name usage...");
    try {
      const participantNameInfo = await page.evaluate(() => {
        // Look for participant name in various places
        const participantNameElements = [
          document.querySelector('input[name="participantName"]'),
          document.querySelector('input[placeholder*="participant"]'),
          document.querySelector('input[placeholder*="name"]'),
          document.querySelector('#participantName'),
          document.querySelector('[data-testid="participant-name"]'),
          document.querySelector('.participant-name-input'),
          document.querySelector('[class*="participant-name"]'),
          document.querySelector('[class*="participantName"]')
        ];
        
        const participantNames = participantNameElements
          .filter(el => el && el.value)
          .map(el => ({ element: el.tagName, value: el.value, placeholder: el.placeholder, name: el.name }));
        
        // Check localStorage and sessionStorage
        const storageInfo = {
          localStorage: {
            participantName: localStorage.getItem('participantName'),
            openvidu_participant_name: localStorage.getItem('openvidu_participant_name')
          },
          sessionStorage: {
            participantName: sessionStorage.getItem('participantName'),
            openvidu_participant_name: sessionStorage.getItem('openvidu_participant_name')
          }
        };
        
        return { participantNames, storageInfo };
      });
      
      console.log("📊 Participant name information:", JSON.stringify(participantNameInfo, null, 2));
    } catch (error) {
      console.log("⚠️ Could not get participant name info:", error.message);
    }
    
    // Wait for connection to be established
    try {
      await page.waitForFunction(() => {
        // Look for various connection status indicators
        const statusElements = [
          document.querySelector('[data-connection-status]'),
          document.querySelector('.connection-status'),
          document.querySelector('#connection-status'),
          document.querySelector('[class*="connected"]'),
          document.querySelector('[class*="Connected"]')
        ];
        
        return statusElements.some(el => el && el.textContent && 
          (el.textContent.includes('Connected') || 
           el.textContent.includes('connected') ||
           el.textContent.includes('Ready')));
      }, { timeout: connectionTimeout });
      
      console.log("✅ OpenVidu v3 connection established!");
    } catch (error) {
      console.log("⚠️ Connection timeout, but continuing to monitor...");
    }
    
    // Continuous monitoring
    console.log("👁️ Starting continuous monitoring...");
    
    const monitorInterval = setInterval(async () => {
      try {
        // Check if page is still active
        if (page.isClosed()) {
          console.log("❌ Page closed, stopping monitoring");
          clearInterval(monitorInterval);
          return;
        }
        
        // Get current connection status
        const status = await page.evaluate(() => {
          const statusElements = [
            document.querySelector('[data-connection-status]'),
            document.querySelector('.connection-status'),
            document.querySelector('#connection-status'),
            document.querySelector('[class*="connected"]'),
            document.querySelector('[class*="Connected"]')
          ];
          
          return statusElements.find(el => el && el.textContent)?.textContent || 'Unknown';
        });
        
        console.log(`📊 Current status: ${status}`);
        
        // Check for any error messages
        const errors = await page.evaluate(() => {
          const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], .error, .Error');
          return Array.from(errorElements).map(el => el.textContent).filter(text => text && text.trim());
        });
        
        if (errors.length > 0) {
          console.log("⚠️ Errors detected:", errors);
        }
        
      } catch (error) {
        console.log("⚠️ Monitoring error:", error.message);
      }
    }, 30000); // Check every 30 seconds
    
    // Keep the browser running
    console.log("🎉 Improved headless browser is running for OpenVidu v3!");
    console.log("📊 Monitoring connection status every 30 seconds");
    console.log("Press Ctrl+C to stop");
    
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down gracefully...");
      clearInterval(monitorInterval);
      await browser.close();
      console.log("✅ Browser closed");
      process.exit(0);
    });
    
    process.on("SIGTERM", async () => {
      console.log("\n🛑 Received SIGTERM, shutting down...");
      clearInterval(monitorInterval);
      await browser.close();
      console.log("✅ Browser closed");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("❌ An error occurred:", error);
    process.exit(1);
  }
})();
