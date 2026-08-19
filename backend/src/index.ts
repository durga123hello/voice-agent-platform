import dotenv from 'dotenv';
// Load environment variables before importing routes or client
dotenv.config();

import http from 'http';
import { WebSocketServer } from 'ws';
import { execSync } from 'child_process';
import app from './app';
import prisma from './db/client';
import bcrypt from 'bcryptjs';
import ffmpegPath from 'ffmpeg-static';
import { initMediasoup } from './services/mediasoup';
import { handleSignaling, sessionPipelines } from './services/signaling';
import { handleTelephony } from './services/telephony/orchestrator';
import { MSG91Transport } from './services/transports/MSG91Transport';
import { startZombieReaper } from './services/transports/lifecycle';
import redis from './db/redis';
import Redis from 'ioredis';

const PORT = process.env.PORT || 3000;
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Loud startup check verifying that FFmpeg is available and runnable either
 * on the system PATH or via the bundled ffmpeg-static package.
 */
function verifyFfmpegLoudCheck(): string {
  let resolvedPath = '';

  // 1. Try system PATH
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    resolvedPath = 'ffmpeg';
    console.log('FFmpeg check: Found "ffmpeg" on system PATH.');
  } catch (pathErr) {
    // 2. Fall back to ffmpeg-static package binary
    if (ffmpegPath) {
      resolvedPath = ffmpegPath;
      try {
        execSync(`"${resolvedPath}" -version`, { stdio: 'ignore' });
        console.log(`FFmpeg check: Found static binary at ${resolvedPath}`);
      } catch (staticErr) {
        console.error('CRITICAL: Bundled ffmpeg-static binary failed to execute.');
        process.exit(1);
      }
    } else {
      console.error('CRITICAL: FFmpeg is not installed on system PATH and ffmpeg-static could not load.');
      process.exit(1);
    }
  }
  return resolvedPath;
}

/**
 * Verify default Seed User database records for local development.
 */
async function seedDefaultUser() {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: DEFAULT_USER_ID }
    });

    if (!existing) {
      const hashed = await bcrypt.hash('secret-password', 10);
      
      const user = await prisma.user.create({
        data: {
          id: DEFAULT_USER_ID,
          email: 'support@swarmx.ai',
          passwordHash: hashed,
          tenant: {
            create: {
              id: DEFAULT_TENANT_ID,
              name: 'Developer Workspace Tenant',
              contactEmail: 'support@swarmx.ai',
              emailVerified: true
            }
          }
        }
      });
      console.log(`Successfully seeded default user ${user.email} (Tenant ID: ${DEFAULT_TENANT_ID})`);
    } else {
      console.log('Default user already exists.');
    }
  } catch (err) {
    console.error('Error during database seed checklist:', err);
  }
}

async function startServer() {
  console.log('Starting backend server initialization...');
  
  // 1. Verify FFmpeg
  verifyFfmpegLoudCheck();

  // 2. Initialize Mediasoup Worker
  try {
    await initMediasoup();
    console.log('Mediasoup Worker and Router initialized successfully.');
  } catch (err) {
    console.error('CRITICAL: Mediasoup initialization failed. Exiting...', err);
    process.exit(1);
  }

  // 3. Verify Redis connection on boot
  try {
    if (process.env.REDIS_URL !== 'memory') {
      const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000
      });
      await client.ping();
      client.disconnect();
      console.log('Successfully connected to Redis.');
    } else {
      console.log('Redis is configured to run in MEMORY mode.');
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('ℹ️ [Redis] No local Redis server found. Using built-in In-Memory store for local development.');
    } else {
      console.error('CRITICAL: Failed to connect to Redis on startup check. Exiting...', error);
      process.exit(1);
    }
  }

  // 4. Seed default user
  await seedDefaultUser();

  // 5. Create HTTP Server around Express app
  const server = http.createServer(app);

  // 6. Set up WebSocket servers for signaling, telephony, and MSG91 media streams
  const wss = new WebSocketServer({ noServer: true });
  const wssMsg91 = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    console.log(`[WS Upgrade Request] Path: ${url}`);
    
    const sessionMatch = url.match(/^\/ws\/sessions\/([a-zA-Z0-9-]+)/);
    const msg91Match = url.match(/^\/ws\/msg91\/media\/([a-zA-Z0-9-]+)/);
    const matchTelephony = url.match(/^\/ws\/telephony\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)/);

    if (sessionMatch) {
      console.log(`[WS Upgrade Match] Signaling WebRTC session matched. Session ID: ${sessionMatch[1]}`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        const sessionId = sessionMatch[1];
        wss.emit('connection', ws, request, sessionId);
      });
    } else if (matchTelephony) {
      console.log(`[WS Upgrade Match] Telephony session matched. Provider: ${matchTelephony[1]}, Session ID: ${matchTelephony[2]}`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        const provider = matchTelephony[1];
        const sessionId = matchTelephony[2];
        wss.emit('telephony_connection', ws, provider, sessionId);
      });
    } else if (msg91Match) {
      console.log(`[WS Upgrade Match] MSG91 media stream matched. Session ID: ${msg91Match[1]}`);
      wssMsg91.handleUpgrade(request, socket, head, (ws) => {
        const sessionId = msg91Match[1];
        wssMsg91.emit('connection', ws, request, sessionId);
      });
    } else {
      console.log(`[WS Upgrade Rejection] Path ${url} did not match any routes. Destroying socket.`);
      socket.destroy();
    }
  });

  wss.on('connection', (ws: any, request: any, sessionId: any) => {
    handleSignaling(ws, sessionId);
  });

  wss.on('telephony_connection', (ws: any, provider: string, sessionId: string) => {
    handleTelephony(ws, provider, sessionId);
  });

  wssMsg91.on('connection', (ws: any, request: any, sessionId: any) => {
    console.log(`[WebSocket Upgrade] Received MSG91 media stream connection for session ${sessionId}`);
    const pipeline = sessionPipelines.get(sessionId);
    if (pipeline && pipeline.transport && pipeline.transport.type === 'msg91') {
      (pipeline.transport as MSG91Transport).handleMediaStream(ws);
    } else {
      console.warn(`[WebSocket Error] No active MSG91 transport found for session ${sessionId}. Closing socket.`);
      ws.close();
    }
  });

  // 7. Start listening
  startZombieReaper();

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
