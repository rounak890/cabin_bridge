# Local setup

No cloud services or API keys are used. The backend virtual environment and Whisper/Argos data are expected to be preconfigured. The frontend dependencies are missing from this checkout; if they are still absent when you run the app, install the declared dependencies once with:

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
