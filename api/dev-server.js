const http = require('http');
const { roomsHandler } = require('./dist/src/functions/rooms');

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL parameters
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  
  // Extract roomId from /api/rooms/{roomId} or /rooms/{roomId}
  const parts = pathname.split('/').filter(Boolean);
  let roomId = null;
  if (parts[0] === 'api' && parts[1] === 'rooms' && parts[2]) {
    roomId = parts[2];
  } else if (parts[0] === 'rooms' && parts[1]) {
    roomId = parts[1];
  }

  // Read body
  let bodyBuffer = '';
  req.on('data', chunk => {
    bodyBuffer += chunk;
  });

  req.on('end', async () => {
    // Mock Azure Functions HttpRequest
    const mockRequest = {
      method: req.method,
      params: { roomId },
      json: async () => {
        return bodyBuffer ? JSON.parse(bodyBuffer) : {};
      }
    };

    // Mock Azure Functions InvocationContext
    const mockContext = {
      log: (...args) => console.log('[API Dev Log]', ...args),
      error: (...args) => console.error('[API Dev Error]', ...args),
    };

    try {
      const response = await roomsHandler(mockRequest, mockContext);
      
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
