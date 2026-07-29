import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl, {
  connectTimeout: 5000,
  maxRetriesPerRequest: null
});

redis.on('error', (err) => {
  console.error('[Redis Client Error]', err);
});

export default redis;
