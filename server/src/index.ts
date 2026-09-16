import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
const port = Number(process.env.PORT || 3000);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const clientIndex = path.join(clientDist, 'index.html');

// In development Vite serves the frontend on its own port, so the backend
// should still respond to `/` instead of returning Express' default 404.
if (!fs.existsSync(clientIndex)) {
  app.get('/', (_req, res) => {
    res.json({
      name: 'video-chat-room-server',
      status: 'ok',
      message: 'Backend is running. Start the Vite client on port 5173.',
      client: 'http://localhost:5173/',
      health: '/health',
    });
  });
}

if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/socket.io/')) return next();
    res.sendFile(clientIndex);
  });
}

registerSocketHandlers(io);

httpServer.listen(port, () => {
  console.log(`video-chat-room server listening on http://localhost:${port}`);
});
