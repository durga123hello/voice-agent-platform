import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
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
import projectsRouter from './routes/projects';
import membersRouter from './routes/members';
import usersRouter from './routes/users';
import prisma from './db/client';

import { rateLimiter } from './utils/rateLimiter';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);
app.use('/public', express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/agent-configs', agentConfigsRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/auth', authRouter);
app.use('/api/members', membersRouter);
app.use('/api/users', usersRouter);
app.use('/api/v1/assistants', assistantsRouter);
app.use('/v1/assistants', assistantsRouter); // Standard v1 spec alias
app.use('/api/calls', callsRouter);
app.use('/api/telephony', telephonyWebhooksRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', apiKeysRouter);
app.use('/v1/api-keys', apiKeysRouter); // Standard v1 spec alias

// XML Answer Endpoint for Plivo
app.post('/api/telephony/plivo/answer/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  console.log(`[Telephony Webhook] Answer URL requested for Session ID: ${sessionId}`);
  console.log(`[Telephony Webhook] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[Telephony Webhook] Body:`, JSON.stringify(req.body, null, 2));

  const payload = req.body || {};
  if (payload.Event === 'Hangup' || payload.CallStatus === 'completed') {
    console.log(`[Telephony Webhook] Received Hangup/Completed event on Answer URL for Session ID: ${sessionId}. Returning empty response.`);
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`);
    return;
  }

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

  // Check if recording is enabled for this session
  let recordingEnabled = false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });
    if (session?.recordingEnabled) {
      recordingEnabled = true;
      console.log(`[Telephony Webhook] Call recording is enabled for session ${sessionId}`);
    }
  } catch (dbErr) {
    console.error('[Answer Webhook DB Error] Failed to query recordingEnabled preference:', dbErr);
  }

  const wsBase = process.env.PLIVO_ANSWER_URL_BASE || 'http://localhost:3000';
  const wsUrl = `${wsBase.replace(/^http/, 'ws')}/ws/telephony/plivo/${sessionId}`;
  console.log(`[Telephony Webhook] Returning WebSocket Stream URL: ${wsUrl}`);

  res.set('Content-Type', 'text/xml');
  if (recordingEnabled) {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Record action="${wsBase}/api/telephony/plivo/recordings/${sessionId}" redirect="false" recordSession="true" maxLength="3600" />
    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${wsUrl}</Stream>
</Response>`);
  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${wsUrl}</Stream>
</Response>`);
  }
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

// TunnelReloader: 1787138509232