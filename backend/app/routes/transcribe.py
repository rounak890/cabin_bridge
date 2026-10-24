"""
ASR transcription endpoint.
POST /api/transcribe (multipart: audio file + lang)

Confidence thresholds:
  - high:   avg_logprob >= -0.3 AND no_speech_prob < 0.3 AND len(text) >= 3
  - medium: avg_logprob >= -0.6 AND no_speech_prob < 0.5 AND len(text) >= 2
  - low:    any other non-empty transcription
  - empty:  text is blank, too short (<2 chars), or no_speech_prob >= 0.8
"""
import time
import io
import logging
import os
import gc
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form
from faster_whisper import WhisperModel
from faster_whisper.audio import _group_frames, _ignore_invalid_frames, _resample_frames
import av
import numpy as np
from starlette.concurrency import run_in_threadpool

router = APIRouter()
logger = logging.getLogger(__name__)

# Load model once at module import — uses cached small model
_model: WhisperModel | None = None


def _local_model_path() -> Path | None:
    """Find a complete local model snapshot without triggering a download."""
    configured = os.environ.get("CABINBRIDGE_WHISPER_MODEL_PATH")
    if configured:
        path = Path(configured).expanduser()
        return path if (path / "model.bin").is_file() else None

    hf_home = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))
    hub = Path(os.environ.get("HF_HUB_CACHE", hf_home / "hub"))
    snapshots = hub / "models--Systran--faster-whisper-small" / "snapshots"
    if not snapshots.is_dir():
        return None
    for snapshot in sorted(snapshots.iterdir(), reverse=True):
        if all((snapshot / name).is_file() for name in ("model.bin", "config.json", "tokenizer.json")):
            return snapshot
    return None


def model_status() -> dict:
    return {"cached": _local_model_path() is not None, "loaded": _model is not None}


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        path = _local_model_path()
        if path is None:
            raise RuntimeError("whisper_model_not_cached")
        _model = WhisperModel(str(path), device="cpu", compute_type="int8")
    return _model


def _derive_confidence(text: str, avg_logprob: float, no_speech_prob: float) -> str:
    """
    Derive confidence level from transcription quality metrics.
    See module docstring for threshold documentation.
    """
    stripped = text.strip()
    if not stripped or len(stripped) < 2 or no_speech_prob >= 0.8:
        return "empty"
    if avg_logprob >= -0.3 and no_speech_prob < 0.3 and len(stripped) >= 3:
        return "high"
    if avg_logprob >= -0.6 and no_speech_prob < 0.5 and len(stripped) >= 2:
        return "medium"
    return "low"


@router.post("/api/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    lang: str = Form(default="en"),
):
    t0 = time.time()
    audio_bytes = await audio.read()
    # Audio is processed in memory and never persisted
    if len(audio_bytes) < 512:
        return {"text": "", "language": lang, "confidence_level": "empty", "avg_logprob": -1.0, "no_speech_prob": 1.0, "duration": 0, "processing_ms": int((time.time() - t0) * 1000), "error": "audio_too_short"}
    try:
        result = await run_in_threadpool(_transcribe_bytes, audio_bytes, lang)
        processing_ms = int((time.time() - t0) * 1000)
        return {**result, "processing_ms": processing_ms}
    except RuntimeError as exc:
        code = "model_not_available" if str(exc) == "whisper_model_not_cached" else "transcription_failed"
        if code != "model_not_available":
            logger.exception("Local transcription failed")
        return _empty_response(lang, t0, code)
    except Exception:
        # Return a safe empty result; audio bytes remain in memory and are discarded.
        logger.exception("Local transcription failed")
        return _empty_response(lang, t0, "transcription_failed")


def _empty_response(lang: str, started: float, error: str) -> dict:
    return {"text": "", "language": lang, "confidence_level": "empty", "avg_logprob": -1.0,
            "no_speech_prob": 1.0, "duration": 0,
            "processing_ms": int((time.time() - started) * 1000), "error": error}


def _transcribe_bytes(audio_bytes: bytes, lang: str) -> dict:
    model = get_model()
    # Faster Whisper currently calls av.open(..., metadata_errors="ignore").
    # Some packaged PyAV versions (including PyAV 19 in the project venv)
    # reject that keyword, so decode here with the same pipeline minus that
    # optional argument and give transcribe its documented float32 waveform.
    audio = _decode_audio_compatible(io.BytesIO(audio_bytes), model.feature_extractor.sampling_rate)
    segments, info = model.transcribe(audio, language=lang, vad_filter=True,
                                      beam_size=1, condition_on_previous_text=False)
    text_parts, logprobs = [], []
    no_speech_prob = 0.0
    for segment in segments:
        text_parts.append(segment.text)
        logprobs.append(segment.avg_logprob)
        if len(logprobs) == 1:
            no_speech_prob = segment.no_speech_prob
    text = "".join(text_parts).strip()
    avg_logprob = sum(logprobs) / len(logprobs) if logprobs else -1.0
    return {"text": text, "language": info.language,
            "confidence_level": _derive_confidence(text, avg_logprob, no_speech_prob),
            "avg_logprob": round(avg_logprob, 4), "no_speech_prob": round(no_speech_prob, 4),
            "duration": round(info.duration, 2) if hasattr(info, "duration") else 0}


def _decode_audio_compatible(input_file: io.BytesIO, sampling_rate: int) -> np.ndarray:
    resampler = av.audio.resampler.AudioResampler(
        format="s16", layout="mono", rate=sampling_rate
    )
    raw_buffer = io.BytesIO()
    dtype = None
    with av.open(input_file, mode="r") as container:
        frames = _ignore_invalid_frames(container.decode(audio=0))
        frames = _group_frames(frames, 500000)
        frames = _resample_frames(frames, resampler)
        for frame in frames:
            array = frame.to_ndarray()
            dtype = array.dtype
            raw_buffer.write(array)
    del resampler
    gc.collect()
    if dtype is None:
        return np.empty(0, dtype=np.float32)
    return np.frombuffer(raw_buffer.getbuffer(), dtype=dtype).astype(np.float32) / 32768.0
