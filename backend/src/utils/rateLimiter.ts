import { Request, Response, NextFunction } from 'express';

const ipCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // 100 requests per 15 minutes

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = (req.ip || 
             req.headers['x-forwarded-for'] || 
             req.socket.remoteAddress || 
             'unknown') as string;
             
  const now = Date.now();
  
  let record = ipCache.get(ip);
  if (!record || record.resetTime < now) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
  }
  
  record.count++;
  ipCache.set(ip, record);
  
  // Set standard RateLimit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - record.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
  
  if (record.count > MAX_REQUESTS) {
    res.status(429).json({
      error: {
        message: 'Too many requests from this IP, please try again after 15 minutes.',
        status: 429
      }
    });
    return;
  }
  
  next();
}
