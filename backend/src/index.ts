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
import { handleSignaling } from './services/signaling';
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
      console.error('CRITICAL: FFmpeg is not found on the system PATH, and the local static binary is not available.');
      process.exit(1);
    }
  }

  return resolvedPath;
}

async function seedDefaultUser() {
  try {
    // Ensure default tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { id: DEFAULT_TENANT_ID }
    });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          id: DEFAULT_TENANT_ID,
          name: 'Default Tenant'
        }
      });
      console.log('Seeded default tenant:', DEFAULT_TENANT_ID);
    }

    const existing = await prisma.user.findUnique({
      where: { id: DEFAULT_USER_ID }
    });

    if (!existing) {
      const passwordHash = await bcrypt.hash('defaultpassword', 10);
      await prisma.user.create({
        data: {
          id: DEFAULT_USER_ID,
          email: 'default@voiceplatform.com',
          passwordHash: passwordHash,
          tenantId: DEFAULT_TENANT_ID
        }
      });
      console.log('Seeded default user:', DEFAULT_USER_ID);
    } else {
      console.log('Default user already exists.');
    }
  } catch (error) {
    console.error('Error seeding default user:', error);
    process.exit(1);
  }
}

async function startServer() {
  console.log('Starting backend server initialization...');

  // 1. Loud startup check for FFmpeg
  verifyFfmpegLoudCheck();

  // 2. Initialize Mediasoup worker and router
  try {
    await initMediasoup();
  } catch (err) {
    console.error('CRITICAL: Failed to initialize Mediasoup. Exiting...', err);
    process.exit(1);
  }

  // 3. Connect to database
  try {
    await prisma.$connect();
    console.log('Successfully connected to PostgreSQL database.');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }

  // 3b. Connect to Redis
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    console.log(`Connecting to Redis at: ${redisUrl}`);
    // Create a temporary client with 0 retries and a short timeout to check connection
    const tempRedis = new Redis(redisUrl, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 0
    });
    await tempRedis.ping();
    tempRedis.disconnect();
    console.log('Successfully connected to Redis.');
  } catch (error) {
    console.error('CRITICAL: Failed to connect to Redis on startup check. Exiting...', error);
    process.exit(1);
  }

  // 4. Seed default user
  await seedDefaultUser();

  // 5. Create HTTP Server around Express app
  const server = http.createServer(app);

  // 6. Set up WebSocket server for signaling path upgrade
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    const match = url.match(/^\/ws\/sessions\/([a-zA-Z0-9-]+)/);
    
    if (match) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        const sessionId = match[1];
        wss.emit('connection', ws, request, sessionId);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: any, request: any, sessionId: any) => {
    handleSignaling(ws, sessionId);
  });

  // 7. Start listening
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
