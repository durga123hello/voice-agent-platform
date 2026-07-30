import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import agentConfigsRouter from './routes/agentConfigs';
import credentialsRouter from './routes/credentials';
import sessionsRouter from './routes/sessions';
import analyticsRouter from './routes/analytics';
import apiKeysRouter from './routes/apiKeys';
import authRouter from './routes/auth';

import { rateLimiter } from './utils/rateLimiter';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(rateLimiter);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/agent-configs', agentConfigsRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/auth', authRouter);
app.use('/api', apiKeysRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: {
      message,
      status
    }
  });
});

export default app;
