#!/usr/bin/env node

/**
 * Robot Audio Recorder Launcher
 * Automatically launches the Robot Audio Recorder application in a headless browser
 */

require("dotenv").config();
const puppeteer = require("puppeteer");
const http = require("http");
const { spawn } = require("child_process");

// Configuration from environment variables
const config = {
  websiteUrl: process.env.WEBSITE_URL || "http://localhost:8080",
  chromePath: process.env.CHROME_PATH,
  robotId: process.env.ROBOT_ID || "robot-001",
  serverEndpoint: process.env.SERVER_ENDPOINT,
  headless: process.env.HEADLESS !== "false",
  autoRestart: process.env.AUTO_RESTART !== "false",
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 300000, // 5 minutes
  maxRetries: parseInt(process.env.MAX_RETRIES) || 20,
  retryDelay: parseInt(process.env.RETRY_DELAY) || 60000, // 1 minute
  debug: process.env.DEBUG === "true",
  consoleLogging: process.env.CONSOLE_LOGGING !== "false"
};

class RobotAudioRecorderLauncher {
  constructor() {
    this.browser = null;
    this.page = null;
    this.httpServer = null;
    this.isRunning = false;
    this.restartCount = 0;
    
    console.log("🤖 Robot Audio Recorder Launcher initialized");
    console.log("📋 Configuration:", {
      websiteUrl: config.websiteUrl,
      robotId: config.robotId,
      headless: config.headless,
      autoRestart: config.autoRestart
    });
    console.log(config);
  }

  /**
   * Start the HTTP server to serve the application
   */
  async startHttpServer() {
    return new Promise((resolve, reject) => {
      try {
        // Extract port from URL
        const url = new URL(config.websiteUrl);
        const port = parseInt(url.port) || 8080;
        
        console.log(`🌐 Starting HTTP server on port ${port}...`);
        
        // Use http-server via spawn
        const serverProcess = spawn("npx", ["http-server", ".", "-p", port.toString(), "-c-1", "--cors"], {
          stdio: config.debug ? "inherit" : "pipe",
          cwd: __dirname
        });

        serverProcess.on("error", (error) => {
          console.error("❌ Failed to start HTTP server:", error.message);
          reject(error);
        });

        // Wait a moment for server to start
        setTimeout(() => {
          console.log(`✅ HTTP server started on ${config.websiteUrl}`);
          this.httpServer = serverProcess;
          resolve();
        }, 3000);

      } catch (error) {
        console.error("❌ Error starting HTTP server:", error.message);
        reject(error);
      }
    });
  }

  /**
   * Check if the website is accessible
   */
  async checkWebsiteAccessibility() {
    return new Promise((resolve) => {
      const url = new URL(config.websiteUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Launch browser with optimized settings for audio recording
   */
  async launchBrowser() {
    console.log("🚀 Launching browser...");
    
    const browserArgs = [
      "--use-fake-ui-for-media-stream",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--allow-running-insecure-content",
      "--unsafely-treat-insecure-origin-as-secure",
      "--autoplay-policy=no-user-gesture-required",
      "--hide-scrollbars",
      "--incognito",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection"
    ];

    if (!config.headless) {
      browserArgs.push("--start-maximized");
    }

    const launchOptions = {
      headless: config.headless ? "new" : false,
      ignoreDefaultArgs: ['--mute-audio'],
      args: browserArgs
    };

    if (config.chromePath) {
      launchOptions.executablePath = config.chromePath;
    }

    this.browser = await puppeteer.launch(launchOptions);
    console.log("✅ Browser launched successfully");
    
    return this.browser;
  }

  /**
   * Navigate to the website with retry logic
   */
  async navigateWithRetry(retries = 0) {
    try {
      console.log(`🌐 Navigating to ${config.websiteUrl} (attempt ${retries + 1})`);
      
      await this.page.goto(config.websiteUrl, { 
        waitUntil: "networkidle2", 
        timeout: 60000 
      });
      
      console.log("✅ Successfully navigated to the page");
      
      // Wait for the application to initialize
      await this.page.waitForSelector('.container', { timeout: 30000 });
      console.log("✅ Application container loaded");
      
      // Check if the app initialized properly
      await this.page.waitForFunction(
        () => window.app && window.app.configService,
        { timeout: 30000 }
      );
      console.log("✅ Application initialized successfully");
      
    } catch (error) {
      console.error(`❌ Navigation attempt ${retries + 1} failed:`, error.message);
      
      if (retries < config.maxRetries) {
        console.log(`⏳ Retrying in ${config.retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        return this.navigateWithRetry(retries + 1);
      } else {
        throw new Error(`Failed to navigate after ${config.maxRetries} attempts`);
      }
    }
  }

  /**
   * Set up page monitoring and event handlers
   */
  async setupPageMonitoring() {
    // Console logging from the browser
    if (config.consoleLogging) {
      this.page.on("console", (msg) => {
        const type = msg.type();
        const text = msg.text();
        
        // Filter out noise but keep important logs
        if (text.includes("ConfigService") || 
            text.includes("OpenViduV3Service") || 
            text.includes("Connected") || 
            text.includes("Disconnected") ||
            text.includes("ERROR") ||
            text.includes("Failed") ||
            type === "error") {
          console.log(`🌐 Browser [${type}]:`, text);
        }
      });
    }

    // Handle page errors
    this.page.on("pageerror", (error) => {
      console.error("🚨 Page error:", error.message);
    });

    // Handle request failures
    this.page.on("requestfailed", (request) => {
      console.warn("⚠️ Request failed:", request.url(), request.failure()?.errorText);
    });

    // Monitor for crashes
    this.page.on("error", (error) => {
      console.error("💥 Page crashed:", error.message);
      if (config.autoRestart) {
        this.restart("Page crashed");
      }
    });
  }

  /**
   * Set up health monitoring
   */
  setupHealthCheck() {
    if (config.healthCheckInterval > 0) {
      console.log(`❤️ Setting up health check (every ${config.healthCheckInterval / 1000}s)`);
      
      setInterval(async () => {
        try {
          if (!this.page || this.page.isClosed()) {
            throw new Error("Page is closed");
          }

          // Check if page is responsive
          await this.page.evaluate(() => document.title);
          
          // Check if app is still running
          const appStatus = await this.page.evaluate(() => {
            if (window.app) {
              return {
                isConnected: window.app.isConnected,
                roomName: window.app.roomName,
                hasRoom: !!window.app.room
              };
            }
            return null;
          });

          if (appStatus) {
            console.log(`❤️ Health check passed - Connected: ${appStatus.isConnected}, Room: ${appStatus.roomName}`);
          } else {
            console.log("❤️ Health check passed - App loading");
          }
          
        } catch (error) {
          console.error("💔 Health check failed:", error.message);
          if (config.autoRestart) {
            this.restart("Health check failed");
          }
        }
      }, config.healthCheckInterval);
    }
  }

  /**
   * Inject custom configuration if provided
   */
  async injectConfiguration() {
    if (config.robotId || config.serverEndpoint) {
      console.log("⚙️ Injecting custom configuration...");
      
      await this.page.evaluate((robotId, serverEndpoint) => {
        // Wait for config service to be available
        const waitForConfig = () => {
          if (window.app && window.app.configService) {
            const updates = {};
            if (robotId) updates.robotId = robotId;
            if (serverEndpoint) updates.server = { endpoint: serverEndpoint };
            
            window.app.configService.updateConfig(updates);
            console.log("Custom configuration injected:", updates);
          } else {
            setTimeout(waitForConfig, 1000);
          }
        };
        waitForConfig();
      }, config.robotId, config.serverEndpoint);
    }
  }

  /**
   * Start the launcher
   */
  async start() {
    try {
      console.log("🚀 Starting Robot Audio Recorder Launcher...");
      this.isRunning = true;

      // Start HTTP server
      await this.startHttpServer();

      // Check if website is accessible
      const isAccessible = await this.checkWebsiteAccessibility();
      if (!isAccessible) {
        throw new Error("Website is not accessible");
      }

      // Launch browser
      await this.launchBrowser();
      this.page = await this.browser.newPage();

      // Set up monitoring
      await this.setupPageMonitoring();

      // Navigate to the application
      await this.navigateWithRetry();

      // Inject custom configuration
      await this.injectConfiguration();

      // Set up health monitoring
      this.setupHealthCheck();

      console.log("🎉 Robot Audio Recorder is running successfully!");
      console.log("📊 Monitoring status...");

    } catch (error) {
      console.error("❌ Failed to start launcher:", error.message);
      await this.cleanup();
      
      if (config.autoRestart) {
        this.restart("Startup failed");
      } else {
        process.exit(1);
      }
    }
  }

  /**
   * Restart the launcher
   */
  async restart(reason = "Manual restart") {
    this.restartCount++;
    console.log(`🔄 Restarting launcher (${reason}) - Attempt ${this.restartCount}`);
    
    await this.cleanup();
    
    console.log("⏳ Waiting 60 seconds before restart...");
    setTimeout(() => {
      this.start();
    }, 60000);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    console.log("🧹 Cleaning up resources...");
    this.isRunning = false;

    if (this.browser) {
      try {
        await this.browser.close();
        console.log("✅ Browser closed");
      } catch (error) {
        console.warn("⚠️ Error closing browser:", error.message);
      }
      this.browser = null;
    }

    if (this.httpServer) {
      try {
        this.httpServer.kill();
        console.log("✅ HTTP server stopped");
      } catch (error) {
        console.warn("⚠️ Error stopping HTTP server:", error.message);
      }
      this.httpServer = null;
    }
  }

  /**
   * Handle graceful shutdown
   */
  async shutdown() {
    console.log("🛑 Shutting down launcher...");
    await this.cleanup();
    process.exit(0);
  }
}

// Create and start the launcher
const launcher = new RobotAudioRecorderLauncher();

// Handle process events
process.on('SIGINT', () => launcher.shutdown());
process.on('SIGTERM', () => launcher.shutdown());
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  if (config.autoRestart) {
    launcher.restart("Unhandled rejection");
  }
});

// Start the launcher
launcher.start();
