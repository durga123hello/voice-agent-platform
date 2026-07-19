# Voice AI Agent Platform — Technical Spec & Build Workflow

## 1. What this actually is

Not an "interview tool" — a **generic real-time voice agent platform**. The behavior (interviewer, teacher, sales rep, therapist, whatever) is entirely defined by one mandatory system prompt. Optional structured context (JD, resume, skills, duration, questions) is just extra data you *may* inject into that prompt when the use case calls for it — the engine doesn't care what it's building.

This keeps the core system reusable: one voice pipeline, one config schema, N behaviors.

**Stack:** Next.js (frontend) · Express.js (backend + WebSocket) · PostgreSQL (state) · Deepgram (STT + TTS) · OpenAI (gpt-4o / gpt-4o-mini)

---

## 2. Core concept: Agent Config

Everything the user sets up on page 1 becomes one row: an **Agent Config**.

| Field | Required | Notes |
|---|---|---|
| `system_prompt` | ✅ | The only thing that actually defines behavior |
| `llm_model` | ✅ | `gpt-4o` \| `gpt-4o-mini` |
| `deepgram_api_key` | ✅ | Encrypted at rest |
| `openai_api_key` | ✅ | Encrypted at rest |
| `voice_preference` | optional | Deepgram Aura voice id |
| `job_description` | optional | Only relevant for interview-style agents |
| `candidate_resume` | optional | Free text or parsed |
| `interview_preferences` | optional | Skills + weightage array |
| `interview_duration_minutes` | optional | |
| `uploaded_questions` | optional | Array of fixed questions, if the agent should ask specific ones |

**Rule:** if none of the optional fields are filled, the agent runs on `system_prompt` alone (teacher, coach, generic assistant, etc.). If any are filled, they get appended to the prompt as a structured context block. The backend doesn't branch logic based on "is this an interview" — it just conditionally appends whatever context exists.

### Prompt assembly (pseudocode)

```
finalSystemPrompt = system_prompt

if any optional field is set:
  finalSystemPrompt += """

  --- CONTEXT ---
  Job Description: {job_description or "N/A"}
  Candidate Resume: {candidate_resume or "N/A"}
  Interview Preferences: {interview_preferences or "N/A"}
  Interview Duration: {interview_duration_minutes or "N/A"} minutes
  Predefined Questions (ask these if provided, otherwise generate your own): {uploaded_questions or "N/A"}
  ---

  Use the above context only where relevant to the instructions above.
  """
```

This is the entire "special casing" the system needs. Everything else — whether it behaves like an HR interviewer or a teacher — is just prompt-following.

---

## 3. High-level architecture

```
Browser (Next.js)
  mic audio (WebRTC/MediaRecorder)
        │
        ▼
  WebSocket ──────────────► Express Server
        │                        │
        │                        ▼
        │              Deepgram STT (streaming, with endpointing)
        │                        │
        │                        ▼
        │              Orchestration Engine
        │              ├── silence/pause detection
        │              ├── interruption (barge-in) handling
        │              ├── conversation history buffer
        │              └── prompt assembly (system_prompt + context)
        │                        │
        │                        ▼
        │                OpenAI (gpt-4o / gpt-4o-mini, streamed)
        │                        │
        │                        ▼
        │              Deepgram TTS (streaming, Aura voice)
        │                        │
        ◄────────────────────────┘
  audio playback
```

No custom orchestration "AI model" is needed — Deepgram's streaming STT already gives you interim + final transcripts and endpointing (utterance-end) events, which covers most of what Vapi's proprietary layer does for pause/turn detection. You just need to wire the state machine around it.

---

## 4. Orchestration engine — the part that makes it feel real

This is a state machine per session, not a separate AI call.

**States:** `listening → thinking → speaking → listening ...`

- **Listening:** streaming audio → Deepgram STT. Deepgram sends interim transcripts continuously and a final transcript + `UtteranceEnd` event when the user pauses long enough.
- **Silence handling:** start a timer when in `listening` state with no interim transcripts coming in. If it crosses ~15–20s, inject a system-level nudge turn ("prompt the candidate to continue") — capped at 2–3 times, per whatever the system prompt says, before the agent decides to move on. This is just a timer + a synthetic user-turn injected into the LLM call, not new infrastructure.
- **Thinking → speaking:** once `UtteranceEnd` fires, take the final transcript, append it to conversation history, call OpenAI with `stream: true`. As sentence-boundary chunks arrive, forward them to Deepgram TTS streaming and pipe audio back over the WebSocket as it's generated (don't wait for the full LLM response).
- **Interruption (barge-in):** while in `speaking` state, if new interim transcripts start arriving from the user, immediately cancel the in-flight TTS stream, stop audio playback client-side, and transition back to `listening`. This is the single most important thing for it to "feel real" — without it, it feels like a phone tree.

Everything about "asking intelligent follow-ups" is just the LLM doing its job with full conversation history + the system prompt — you don't need separate follow-up logic. The system prompt (like the ones in your Vapi doc) is what tells it to dig into "we used Helm" → "how did you handle rollbacks."

---

## 5. Database schema (PostgreSQL)

```sql
-- Users (keep minimal if this is single-tenant to start)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Encrypted API credentials, one row per provider per user
CREATE TABLE api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('deepgram', 'openai')),
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- The core config object created on page 1
CREATE TABLE agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  system_prompt TEXT NOT NULL,
  llm_model TEXT NOT NULL CHECK (llm_model IN ('gpt-4o', 'gpt-4o-mini')),
  voice_preference TEXT,

  -- optional, interview-style context — nullable by design
  job_description TEXT,
  candidate_resume TEXT,
  interview_preferences JSONB,     -- [{ "name": "Kubernetes", "weightage": 40, "subKeywords": [...] }]
  interview_duration_minutes INT,
  uploaded_questions JSONB,        -- ["Question 1", "Question 2", ...]

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One conversation instance
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_config_id UUID REFERENCES agent_configs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  summary TEXT
);

-- Full transcript, turn by turn
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system_event')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: log silence prompts / interruptions for debugging & tuning
CREATE TABLE session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('silence_prompt', 'interruption', 'utterance_end')),
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);
```

---

## 6. API surface (Express)

**REST**
- `POST /api/auth/login` / `/register` — if multi-user; skip entirely if this is just for you
- `POST /api/credentials` — save/update encrypted Deepgram + OpenAI keys
- `POST /api/agent-configs` — create config (page 1 submit)
- `GET /api/agent-configs/:id`
- `POST /api/sessions` — create a session against a config, returns a session id + WS token
- `GET /api/sessions/:id/transcript` — pull messages for a completed session
- `PATCH /api/sessions/:id` — mark completed/aborted

**WebSocket**
- `WS /ws/sessions/:id` — bidirectional: client streams mic audio in, server streams TTS audio + state events (`listening`, `speaking`, `interrupted`) out.

---

## 7. Build order

1. **Postgres + Express skeleton** — schema above, migrations, CRUD for `agent_configs` and `api_credentials` (encrypt keys with AES-256 before insert, using a server-side secret, never expose them back to the client after save).
2. **Next.js setup page** — form for API keys, model dropdown, mandatory prompt textarea, and a collapsible "Interview context (optional)" section with JD/resume/skills+weightage/duration/voice/uploaded questions. On submit → `POST /api/agent-configs`.
3. **Deepgram STT streaming** — wire a WebSocket relay: browser mic → Express → Deepgram live transcription. Get interim + final transcripts + `UtteranceEnd` flowing end to end before touching the LLM.
4. **OpenAI streaming turn** — on `UtteranceEnd`, assemble prompt (system_prompt + context block + history), call OpenAI with streaming, log to `messages`.
5. **Deepgram TTS streaming** — pipe LLM output sentence-by-sentence into Deepgram TTS, stream audio back over the same WebSocket, play in browser as chunks arrive.
6. **Orchestration state machine** — add the `listening/thinking/speaking` states, the silence timer with capped nudges, and barge-in cancellation. This is the step that makes it feel like Vapi instead of a walkie-talkie.
7. **Session logging + transcript view** — persist every turn to `messages`, simple page to review past sessions.
8. **Polish** — reconnect handling on WS drop, key validation on save, basic rate limiting.

Steps 1–5 get you a working (if clunky) voice loop. Step 6 is what actually makes it good — worth not skipping even though it's tempting to treat it as polish.
