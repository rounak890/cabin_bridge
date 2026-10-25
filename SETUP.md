# Local setup

The core app runs without cloud services. The crew triage summary works offline
with a built-in classifier; setting `JEV_API_KEY` upgrades it to Jev
classification (optional). Whisper/Argos data are expected to be preconfigured.
The frontend dependencies are missing from this checkout; if they are still
absent when you run the app, install the declared dependencies once with:

```sh
cd frontend
npm install
```

Terminal 1 — backend:

```sh
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — frontend:

```sh
cd frontend
npm run dev
```

Open the local Vite address printed by the frontend command (normally `http://localhost:5173`). The Vite configuration proxies `/api` and `/ws` to `localhost:8000`.

## Voice recognition setup

Voice recognition uses Faster Whisper's multilingual `small` model. The backend now checks the local cache and will not download a model while handling a passenger recording. If the model is not cached, run this once yourself while online:

```sh
cd backend
source .venv/bin/activate
python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
```

The command downloads the model into the Hugging Face cache. Start the backend and confirm `asr_model.cached` is `true` at `http://127.0.0.1:8000/api/health`. Open CabinBridge on `localhost` or `127.0.0.1`, allow microphone access, then use Passenger → Voice. The recording stays in memory and is posted to the local backend.

Argos packages for `en↔ja` and `en↔hi` are expected in `backend/.venv`. Other languages can be transcribed by Whisper, while free-text translation falls back to the original and approved phrase cards.

## Crew triage summaries (Jev)

Every passenger request is shown to the crew as a short decision first:
`intent`, `urgency`, a one-line summary, the next action, and 2–4 important
words. The full original/translation stays available behind **Show full
message**, with the important words highlighted.

By default the backend uses a deterministic multilingual keyword classifier, so
the demo works offline with no key. To classify with Jev, set the key on the
backend process (never in the frontend):

```sh
cd backend
source .venv/bin/activate
export JEV_API_KEY="your-key"
# optional:
# export JEV_MODEL="jev-latest"
# export JEV_API_URL="https://thejevai.com/v1/systemone"
# export JEV_TIMEOUT_SECONDS="2.5"
uvicorn app.main:app --reload --port 8000
```

The endpoint is `POST /api/classify`; the matching words are highlighted in the
crew's message view. If Jev is unavailable, slow, or returns an invalid choice,
the request falls back to the local classifier and the card still renders. The
crew card shows a small **Jev** badge when Jev produced the result.

## Japanese translation (local Ollama)

Argos's `ja→en` package produces unusable cabine phrases ("お水をください" became
"Contact Us"). Japanese pairs now use a local Qwen 2.5 model through Ollama;
Hindi/English still use Argos directly. Start Ollama before the backend:

```sh
ollama serve            # or keep the Ollama app running
ollama pull qwen2.5:7b  # already present on this machine
```

The backend warms the model at startup. If Ollama is unavailable, translation
falls back to Argos (which is why keeping Ollama running matters for Japanese).
Optional overrides: `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS`.

Japanese voice recognition uses a wider beam, Japanese context prompt, and a
small cabin-homophone correction (`モーフ` → `毛布`). It automatically upgrades
to Whisper `large-v3-turbo` when that model is present under
`backend/.models/hub` (no code change or restart needed; the next Japanese
request loads it). To fetch it:

```sh
cd backend
HF_HOME="$PWD/.models" .venv/bin/python -c "from huggingface_hub import snapshot_download; snapshot_download('mobiuslabsgmbh/faster-whisper-large-v3-turbo')"
```

Check `http://127.0.0.1:8000/api/health`: `asr_model.ja_large_cached` becomes
`true` when the download is complete. The regular `small` model remains in use
for the other six languages.
