# Voice AI Agent Platform

A state-of-the-art, multi-tenant conversational voice AI agent platform built with a high-performance WebRTC signaling engine, Mediasoup audio routing, Deepgram STT/TTS, and OpenAI LLM orchestration.

---

## 🚀 Key Features

* **WebRTC Live Media Pipeline**: Zero-latency full-duplex audio streaming powered by a Mediasoup SFU router.
* **Smart Conversational State Machine**: Audited state management (`listening` | `thinking` | `speaking`) preventing race conditions, double-triggering, or talkovers.
* **Client-to-Server Playback Handshake**: Zero-lag synchronization using `tts_done` and `playback_complete` events to ensure silence timers and barge-ins only trigger when appropriate.
* **Multi-Tenant Versioned Schema**: Multi-tenant isolation at the database level with isolated configuration version history (allows editing configuration prompts while preserving historical session context).
* **Robust Reconnection**: Seamless WebSocket reconnect-with-backoff handling that preserves active stream pipelines.
* **Rate Limiting & Security**: Express rate limit protections paired with secure AES key encryption for API credentials.

---

## 🛠 Tech Stack

* **Frontend**: Next.js (App Router), React, Web Audio API, Mediasoup Client
* **Backend**: Node.js, Express, TypeScript, WebSockets
* **Database**: PostgreSQL, Prisma ORM
* **APIs**: OpenAI (LLM), Deepgram (STT & TTS), Mediasoup (SFU WebRTC)

---

## 📦 Getting Started

### 1. Prerequisites
Ensure you have Node.js, npm, and PostgreSQL installed.

### 2. Database Setup
Configure your database URL in `backend/.env`, then run migrations:
```bash
cd backend
npx prisma migrate dev
```

### 3. Start Backend
Install dependencies and run the development server:
```bash
cd backend
npm install
npm run dev
```

### 4. Start Frontend
Install dependencies and run the client:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser to view the Setup Page.
