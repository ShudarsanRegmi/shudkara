const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from local.settings.json
try {
  const localSettingsPath = path.join(__dirname, 'local.settings.json');
  if (fs.existsSync(localSettingsPath)) {
    const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
    if (settings.Values) {
      for (const [key, value] of Object.entries(settings.Values)) {
        process.env[key] = value;
      }
      console.log('Loaded local.settings.json values into process.env');
    }
  }
} catch (err) {
  console.error('Failed to load local.settings.json:', err);
}

// Load handlers
const { roomsHandler } = require('./dist/src/functions/rooms');
const { syncHandler } = require('./dist/src/functions/sync');
const { authHandler } = require('./dist/src/functions/auth');
const { linksHandler } = require('./dist/src/functions/links');
const { keyValHandler } = require('./dist/src/functions/keyval');
const { imgDropHandler } = require('./dist/src/functions/imgdrop');

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL parameters
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  
  const parts = pathname.split('/').filter(Boolean);
  const isApi = parts[0] === 'api';
  const baseIndex = isApi ? 1 : 0;
  const resource = parts[baseIndex];

  let handlerToUse = null;
  let params = {};

  if (resource === 'rooms') {
    handlerToUse = roomsHandler;
    params = { roomId: parts[baseIndex + 1] || null };
  } else if (resource === 'sync') {
    handlerToUse = syncHandler;
  } else if (resource === 'auth') {
    handlerToUse = authHandler;
  } else if (resource === 'links') {
    handlerToUse = linksHandler;
    params = { id: parts[baseIndex + 1] || null };
  } else if (resource === 'keyval') {
    handlerToUse = keyValHandler;
    params = { key: parts[baseIndex + 1] || null };
  } else if (resource === 'imgdrop') {
    handlerToUse = imgDropHandler;
    params = { id: parts[baseIndex + 1] || null };
  }

  if (!handlerToUse) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found.' }));
    return;
  }

  // Read body
  let bodyBuffer = '';
  req.on('data', chunk => {
    bodyBuffer += chunk;
  });

  req.on('end', async () => {
    // Mock Azure Functions InvocationContext
    const mockContext = {
      log: (...args) => console.log('[API Dev Log]', ...args),
      error: (...args) => console.error('[API Dev Error]', ...args),
    };

    // Use native Node Headers class (ensures case-insensitive header lookups)
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    try {
      const mockRequest = {
        method: req.method,
        url: req.url,
        params,
        query: parsedUrl.searchParams,
        headers,
        json: async () => {
          return bodyBuffer ? JSON.parse(bodyBuffer) : {};
        }
      };

      const response = await handlerToUse(mockRequest, mockContext);
      
      const status = response.status || 200;
      const headers = response.headers || { 'Content-Type': 'application/json' };
      const body = response.jsonBody ? JSON.stringify(response.jsonBody) : '';

      res.writeHead(status, headers);
      res.end(body);
    } catch (err) {
      console.error('Local Dev API Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Dev API error', details: err.message }));
    }
  });
});

const PORT = 7071;
server.listen(PORT, () => {
  console.log(`Local dev API server running on http://localhost:${PORT}`);
});
