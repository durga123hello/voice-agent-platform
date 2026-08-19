import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import agentConfigsRouter from './routes/agentConfigs';
import credentialsRouter from './routes/credentials';
import sessionsRouter from './routes/sessions';
import analyticsRouter from './routes/analytics';
import apiKeysRouter from './routes/apiKeys';
import authRouter from './routes/auth';
import assistantsRouter from './routes/assistants';
import callsRouter from './routes/calls';
import telephonyWebhooksRouter from './routes/telephonyWebhooks';

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
app.use('/api/v1/assistants', assistantsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/telephony', telephonyWebhooksRouter);
app.use('/api', apiKeysRouter);

// XML Answer Endpoint for Plivo
app.post('/api/telephony/plivo/answer/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  console.log(`[Telephony Webhook] Answer URL requested for Session ID: ${sessionId}`);
  console.log(`[Telephony Webhook] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[Telephony Webhook] Body:`, JSON.stringify(req.body, null, 2));

  // Update session state & start answer guard
  try {
    const { updateSessionState } = require('./services/transports/lifecycle');
    const { startAnswerMediaGuard } = require('./services/telephony/orchestrator');
    updateSessionState(sessionId, {
      callState: 'connected',
      mediaState: 'connecting'
    }).catch((err: any) => console.error('[Answer Webhook State Error]', err));
    startAnswerMediaGuard(sessionId);
  } catch (err) {
    console.error('[Answer Webhook Error] Failed to load modules / update state:', err);
  }

  const wsBase = process.env.PLIVO_ANSWER_URL_BASE || 'http://localhost:3000';
  const wsUrl = `${wsBase.replace(/^http/, 'ws')}/ws/telephony/plivo/${sessionId}`;
  console.log(`[Telephony Webhook] Returning WebSocket Stream URL: ${wsUrl}`);

  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${wsUrl}</Stream>
</Response>`);
});

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
