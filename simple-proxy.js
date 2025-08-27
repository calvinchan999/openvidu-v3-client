/**
 * Simple CORS proxy server without Express.js
 * Uses only native Node.js modules to avoid dependency conflicts
 * Now includes WebSocket proxy support for OpenVidu RTC connections
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const TARGET_SERVER = process.env.TARGET_SERVER || 'https://arcs-openvidu-vm.eastasia.cloudapp.azure.com';
const targetUrl = new URL(TARGET_SERVER);

// Log configuration on startup
console.log(`🚀 Starting proxy server on port ${PORT}`);
console.log(`🎯 Target server: ${TARGET_SERVER}`);
console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 WebSocket proxy enabled for RTC connections`);

// MIME types for static files
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
}

function proxyRequest(req, res, targetPath) {
    console.log('Proxying request:', req.method, req.url, '->', TARGET_SERVER + targetPath);
    
    // Get configuration from environment variables
    const timeout = parseInt(process.env.PROXY_TIMEOUT) || 30000;
    const maxRedirects = parseInt(process.env.PROXY_MAX_REDIRECTS) || 5;
    const verifySSL = process.env.PROXY_VERIFY_SSL !== 'false';
    
    const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: targetPath,
        method: req.method,
        timeout: timeout,
        rejectUnauthorized: verifySSL,
        headers: {
            ...req.headers,
            host: targetUrl.hostname
        }
    };

    const proxy = https.request(options, (proxyRes) => {
        setCorsHeaders(res);
        
        // Copy status code and other headers
        res.statusCode = proxyRes.statusCode;
        Object.keys(proxyRes.headers).forEach(key => {
            if (key.toLowerCase() !== 'access-control-allow-origin') {
                res.setHeader(key, proxyRes.headers[key]);
            }
        });
        
        proxyRes.pipe(res);
    });

    proxy.on('error', (err) => {
        console.error('Proxy error:', err);
        setCorsHeaders(res);
        res.statusCode = 500;
        res.end(JSON.stringify({
            error: 'Proxy error',
            message: err.message,
            target: TARGET_SERVER + targetPath
        }));
    });

    // Set timeout for the proxy request
    proxy.setTimeout(timeout);
    
    req.pipe(proxy);
}

function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 404;
            res.end('File not found');
            return;
        }
        
        setCorsHeaders(res);
        res.setHeader('Content-Type', mimeType);
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    console.log(`${req.method} ${pathname}`);
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.statusCode = 200;
        res.end();
        return;
    }
    
    // Proxy API requests (handle both /api and /application-server/api paths)
    if (pathname.startsWith('/api')) {
        proxyRequest(req, res, '/application-server' + pathname + (parsedUrl.search || ''));
        return;
    }
    
    if (pathname.startsWith('/application-server/api')) {
        proxyRequest(req, res, pathname + (parsedUrl.search || ''));
        return;
    }
    
    // Proxy health check (handle both /health and /application-server/health paths)
    if (pathname.startsWith('/health')) {
        proxyRequest(req, res, '/application-server/health');
        return;
    }
    
    if (pathname.startsWith('/application-server/health')) {
        proxyRequest(req, res, pathname);
        return;
    }
    
    // Local health check endpoint to show configuration
    if (pathname === '/local-health') {
        setCorsHeaders(res);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            status: 'healthy',
            service: 'simple-proxy',
            timestamp: new Date().toISOString(),
            configuration: {
                port: PORT,
                targetServer: TARGET_SERVER,
                nodeEnv: process.env.NODE_ENV || 'development',
                proxyTimeout: process.env.PROXY_TIMEOUT || 30000,
                proxyMaxRedirects: process.env.PROXY_MAX_REDIRECTS || 5,
                proxyVerifySSL: process.env.PROXY_VERIFY_SSL !== 'false'
            }
        }));
        return;
    }
    
    // Serve static files
    let filePath = path.join(__dirname, pathname);
    
    // If it's a directory or doesn't exist, serve index.html
    if (pathname === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
    }
    
    serveStaticFile(req, res, filePath);
});

// Create WebSocket server for proxying RTC connections
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connections
wss.on('connection', (ws, request) => {
    console.log(`🔌 WebSocket connection established for: ${request.url}`);
    
    // Parse the target WebSocket URL
    const targetWsUrl = TARGET_SERVER.replace('https://', 'wss://').replace('http://', 'ws://');
    const targetPath = request.url;
    const fullTargetUrl = `${targetWsUrl}${targetPath}`;
    
    console.log(`📡 Proxying WebSocket to: ${fullTargetUrl}`);
    
    // Create WebSocket connection to target server
    const targetWs = new WebSocket(fullTargetUrl);
    
    // Forward messages from client to target
    ws.on('message', (message) => {
        if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(message);
        }
    });
    
    // Forward messages from target to client
    targetWs.on('message', (message) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
    
    // Handle connection close
    ws.on('close', () => {
        console.log(`🔌 Client WebSocket closed`);
        if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.close();
        }
    });
    
    targetWs.on('close', () => {
        console.log(`🔌 Target WebSocket closed`);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error(`🔌 Client WebSocket error:`, error);
        if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.close();
        }
    });
    
    targetWs.on('error', (error) => {
        console.error(`🔌 Target WebSocket error:`, error);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
    
    // Handle target connection open
    targetWs.on('open', () => {
        console.log(`✅ WebSocket proxy connection established to target`);
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Simple CORS proxy server running on http://localhost:${PORT}`);
    console.log(`📡 Proxying API requests to: ${TARGET_SERVER}`);
    console.log(`🔌 WebSocket proxy enabled for RTC connections`);
    console.log(`\n💡 To use this proxy, update your configuration to use:`);
    console.log(`   "endpoint": "http://localhost:${PORT}"`);
    console.log(`\n✅ Using only native Node.js modules - no dependencies!`);
});

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    
    console.log(`🔄 WebSocket upgrade request for: ${pathname}`);
    
    // Check if this is an RTC WebSocket connection
    if (pathname.startsWith('/rtc')) {
        console.log(`🔌 Upgrading to WebSocket for RTC connection: ${pathname}`);
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        console.log(`❌ Unknown WebSocket path: ${pathname}, closing connection`);
        socket.destroy();
    }
});
