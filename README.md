# YTutor

**Watch. Ask. Understand.**

YTutor is a distraction-free, dark-mode AI learning companion for YouTube videos. Paste any YouTube link, watch the video on a single-screen workspace, and ask questions at any moment. YTutor captures your exact playback timestamp, pulls the surrounding transcript context, and delivers short, direct, filler-free explanations right beneath the player.

---

## Highlights

- **Single-Screen Dark UI** — Locked `100vh` layout over a live Perlin-noise fluid particle field (`ParticlesBackground`), keeping the video and AI tutor in view with zero page scrolling.
- **3D Atom Intro & Thinking State** — Opens with a 3D multi-orbit `AtomLogo` splash (`IntroSplash`) that transitions into the app. Asking a question morphs the aurora input bar into a 3D rotating atom animation (`MorphOrb`) before unfolding a borderless, word-animated answer beside the follow-up bar.
- **Exact Timestamp Context** — Captures `player.getCurrentTime()` at the moment you press send and retrieves a `±60s` transcript window around what is currently being discussed—while gracefully answering general or conversational questions even when captions are unavailable.
- **Concise, Filler-Free Answers** — Prompted to skip fluff and give clear, direct explanations with inline formatting and short-term conversation memory.
- **Flexible LLM Backend** — Switch seamlessly between **Google Gemini** (`google-genai` SDK) and **OpenAI-compatible APIs** (Groq, OpenRouter, Together, Ollama) via environment variables. API keys stay strictly on the FastAPI server.

---

## Architecture

```text
Browser
  │
  ▼
React Frontend (Vite + TypeScript + Tailwind CSS)
  ├── IntroSplash & AtomLogo       (3D multi-orbit canvas intro)
  ├── ParticlesBackground          (Perlin-noise flow-field canvas)
  ├── VideoPlayer                  (Official YouTube IFrame Player API)
  └── MorphOrb                     (Aurora pill input → 3D Atom thinking → borderless answer)
  │
  │ REST API (/api/video/analyze, /api/chat, /api/health)
  ▼
FastAPI Backend
  ├── Transcript Service           (youtube-transcript-api, in-memory cache)
  ├── Transcript Context Service   (±60s window around playback timestamp)
  └── LLM / Gemini Service         (Google Gemini SDK or OpenAI-compatible HTTP client)
```

> **Local Dev Note:** During `npm run dev`, `vite-transcript-plugin.ts` fetches YouTube captions directly from your local machine (`/local-api/analyze`) so local development works even when YouTube rate-limits cloud datacenter IPs.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide React, HTML5 Canvas (Perlin flow field & 3D Atom projection), YouTube IFrame Player API
- **Backend:** Python 3.12, FastAPI, Pydantic Settings, Uvicorn, HTTPX
- **AI Providers:** Google Gemini (`google-genai`) and OpenAI-compatible chat completions (Groq, OpenRouter, etc.)
- **Transcripts:** `youtube-transcript-api` + local Vite Innertube caption middleware for dev

---

## Project Structure

```text
YTutor/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/          # health.py, video.py, chat.py
│   │   ├── core/                # config.py, logging_config.py
│   │   ├── schemas/             # video.py, chat.py
│   │   └── services/
│   │       ├── gemini_service.py
│   │       ├── transcript_service.py
│   │       ├── transcript_context_service.py
│   │       └── youtube_utils.py
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AtomLogo.tsx
│   │   │   ├── IntroSplash.tsx
│   │   │   ├── ParticlesBackground.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── YouTubeUrlInput.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── ErrorMessage.tsx
│   │   │   └── ui/
│   │   │       └── ai-thiking-orb-and-input.tsx
│   │   ├── hooks/               # useYouTubePlayer.ts, useChat.ts
│   │   ├── pages/               # HomePage.tsx, WorkspacePage.tsx
│   │   ├── services/            # api.ts, youtube.ts
│   │   └── types/               # video.ts, chat.ts, transcript.ts
│   ├── vite-transcript-plugin.ts
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Local Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Configure `backend/.env` for either **Gemini** or **Groq / OpenAI-compatible**:

```env
# Option A: Google Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest

# Option B: Groq / OpenAI-compatible
# LLM_PROVIDER=openai_compatible
# LLM_BASE_URL=https://api.groq.com/openai/v1
# LLM_MODEL=openai/gpt-oss-120b
# LLM_API_KEY=your_groq_api_key

FRONTEND_ORIGIN=http://localhost:5173
PORT=8000
```

Start the API server:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Set `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the Vite dev server:

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## Environment Variables

### `backend/.env`

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `openai_compatible` | `gemini` or `openai_compatible` |
| `GEMINI_API_KEY` | `""` | Google Gemini API key (when `LLM_PROVIDER=gemini`) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model ID (e.g. `gemini-flash-latest`, `gemini-3.8-flash`) |
| `LLM_API_KEY` | `""` | API key for Groq / OpenRouter / compatible provider |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | Base URL for OpenAI-compatible `/chat/completions` |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Model ID for OpenAI-compatible provider (e.g. `openai/gpt-oss-120b`) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `PORT` | `8000` | Server port |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `MAX_QUESTION_LENGTH` | `500` | Max characters per user question |
| `MAX_CONVERSATION_HISTORY_MESSAGES` | `8` | Max prior messages included for follow-up context |
| `TRANSCRIPT_CONTEXT_WINDOW_SECONDS` | `60` | Seconds before/after current timestamp included in prompt |

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (`http://localhost:8000` locally, or your Render backend URL in production) |

---

## Deployment

### Backend (Render / Railway / Docker)

1. Point the service to the `backend` root directory.
2. Start command:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
3. Add your LLM environment variables (`LLM_PROVIDER`, `GEMINI_API_KEY` / `GEMINI_MODEL` or `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`) and set `FRONTEND_ORIGIN` to your deployed frontend URL (comma-separated if allowing both localhost and production).

### Frontend (Vercel / Cloudflare Pages)

1. Import the repository and set **Root Directory** to `frontend`.
2. Build command: `npm run build` · Output directory: `dist`.
3. Set `VITE_API_BASE_URL` to your deployed backend URL (e.g. `https://ytutor-backend.onrender.com`).
4. Add SPA fallback routing (`/(.*) -> /index.html`) so direct `/watch/...` links resolve cleanly.

---

## Security

- API keys (`GEMINI_API_KEY`, `LLM_API_KEY`) live exclusively on the backend and are never bundled into frontend code or exposed to the browser.
- `.env` files are git-ignored across both `frontend/` and `backend/`.
- Strict Pydantic validation caps question length, conversation history depth, and CORS origins.
