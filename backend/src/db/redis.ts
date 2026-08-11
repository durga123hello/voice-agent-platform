import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Redis from 'ioredis';
import { EventEmitter } from 'events';

class MemoryRedis extends EventEmitter {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
    this.store.set(key, {
      value: String(value),
      expiresAt: Date.now() + ttlSeconds * 1000
    });
    return 'OK';
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, { value: String(value) });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const k of keys) {
      if (this.store.delete(k)) deleted++;
    }
    return deleted;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const num = (parseInt(current || '0', 10) || 0) + 1;
    this.store.set(key, { value: String(num) });
    return num;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + ttlSeconds * 1000;
    return 1;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  disconnect() {}
}

const redisUrl = process.env.REDIS_URL;
let redisClient: any;

if (redisUrl === 'memory') {
  console.log('[Redis] Using built-in In-Memory State Store.');
  redisClient = new MemoryRedis();
} else {
  const actualUrl = redisUrl || 'redis://127.0.0.1:6379';
  const memoryFallback = new MemoryRedis();
  let usingMemory = false;

  const client = new Redis(actualUrl, {
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (process.env.NODE_ENV !== 'production' && times > 1) {
        usingMemory = true;
        return null; // Stop retrying in dev mode
      }
      return Math.min(times * 100, 3000);
    }
  });

  client.on('error', (err) => {
    if (!usingMemory && process.env.NODE_ENV !== 'production') {
      usingMemory = true;
      console.warn('[Redis] Local Redis server not active. Seamlessly using built-in In-Memory store for development.');
    } else if (process.env.NODE_ENV === 'production') {
      console.error('[Redis Client Error]', err);
    }
  });

  redisClient = new Proxy(client, {
    get(target, prop, receiver) {
      if (usingMemory && prop in memoryFallback) {
        return (memoryFallback as any)[prop].bind(memoryFallback);
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });
}

export default redisClient;
