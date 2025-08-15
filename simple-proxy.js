/**
 * Simple CORS proxy server without Express.js
 * Uses only native Node.js modules to avoid dependency conflicts
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const TARGET_SERVER = 'https://arcs-openvidu-vm.eastasia.cloudapp.azure.com';
const targetUrl = new URL(TARGET_SERVER);

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
    
    const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: targetPath,
        method: req.method,
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
            message: err.message
        }));
    });

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
    
    // Serve static files
    let filePath = path.join(__dirname, pathname);
    
    // If it's a directory or doesn't exist, serve index.html
    if (pathname === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
    }
    
    serveStaticFile(req, res, filePath);
});

server.listen(PORT, () => {
    console.log(`\n🚀 Simple CORS proxy server running on http://localhost:${PORT}`);
    console.log(`📡 Proxying API requests to: ${TARGET_SERVER}`);
    console.log(`\n💡 To use this proxy, update your configuration to use:`);
    console.log(`   "endpoint": "http://localhost:${PORT}"`);
    console.log(`\n✅ Using only native Node.js modules - no dependencies!`);
});
