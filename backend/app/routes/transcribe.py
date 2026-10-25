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

# Load model once at module import — uses cached small model, plus a larger
# Japanese model when it is available.
_model: WhisperModel | None = None
_model_ja: WhisperModel | None = None
_WORKSPACE_HUB = Path(__file__).resolve().parents[2] / ".models" / "hub"


def _candidate_hubs() -> list[Path]:
    hubs: list[Path] = [_WORKSPACE_HUB]
    hf_home = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))
    hubs.append(Path(os.environ.get("HF_HUB_CACHE", hf_home / "hub")))
    return list(dict.fromkeys(hubs))


def _snapshot(hub: Path, repo: str) -> Path | None:
    snapshots = hub / f"models--{repo}" / "snapshots"
    if not snapshots.is_dir():
        return None
    for snapshot in sorted(snapshots.iterdir(), reverse=True):
        if all((snapshot / name).is_file() for name in ("model.bin", "config.json", "tokenizer.json")):
            return snapshot
    return None


def _find_model(*repos: str) -> Path | None:
    for hub in _candidate_hubs():
        for repo in repos:
            path = _snapshot(hub, repo)
            if path:
                return path
    return None


def _local_model_path() -> Path | None:
    """Find a complete local small-model snapshot without downloading."""
    configured = os.environ.get("CABINBRIDGE_WHISPER_MODEL_PATH")
    if configured:
        path = Path(configured).expanduser()
        return path if (path / "model.bin").is_file() else None
    return _find_model("Systran--faster-whisper-small")


def _japanese_model_path() -> Path | None:
    """Preferred higher-accuracy Japanese model, if it has been downloaded."""
    return _find_model(
        "mobiuslabsgmbh--faster-whisper-large-v3-turbo",
        "Systran--faster-whisper-large-v3-turbo",
        "deepdml--faster-whisper-large-v3-turbo-ct2",
    )


def model_status() -> dict:
    return {
        "cached": _local_model_path() is not None,
        "loaded": _model is not None,
        "ja_large_cached": _japanese_model_path() is not None,
        "ja_large_loaded": _model_ja is not None,
    }


def get_small_model() -> WhisperModel:
    global _model
    if _model is None:
        path = _local_model_path()
        if path is None:
            raise RuntimeError("whisper_model_not_cached")
        _model = WhisperModel(str(path), device="cpu", compute_type="int8")
    return _model


def get_model(lang: str = "en") -> WhisperModel:
    global _model_ja
    if lang == "ja":
        japanese_path = _japanese_model_path()
        if japanese_path is not None:
            if _model_ja is None:
                logger.info("Loading Japanese Whisper large-v3-turbo from %s", japanese_path)
                _model_ja = WhisperModel(str(japanese_path), device="cpu", compute_type="int8")
            return _model_ja
    return get_small_model()


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


def _run_transcription(model: WhisperModel, audio: np.ndarray, lang: str, beam_size: int,
                       temperature, turbo: bool = False) -> dict:
    japanese = lang == "ja"
    segments, info = model.transcribe(
        audio,
        language=lang,
        vad_filter=True,
        beam_size=beam_size,
        initial_prompt="以下は日本語の機内での会話です。お客様の希望を丁寧に書き起こしてください。" if japanese else None,
        condition_on_previous_text=False,
        temperature=temperature,
        compression_ratio_threshold=2.4,
        log_prob_threshold=-1.0,
        no_speech_threshold=0.6,
        without_timestamps=True,
    )
    text_parts, logprobs = [], []
    no_speech_prob = 0.0
    for segment in segments:
        text_parts.append(segment.text)
        logprobs.append(segment.avg_logprob)
        if len(logprobs) == 1:
            no_speech_prob = segment.no_speech_prob
    text = "".join(text_parts).strip()
    if japanese:
        # Whisper-small commonly hears "毛布" (blanket) as the katakana
        # "モーフ"; correct the cabin-critical homophone before translation.
        for wrong, right in (("モーフ", "毛布"), ("もうふ", "毛布"), ("モウフ", "毛布")):
            text = text.replace(wrong, right)
    avg_logprob = sum(logprobs) / len(logprobs) if logprobs else -1.0
    return {
        "text": text,
        "language": info.language,
        "confidence_level": _derive_confidence(text, avg_logprob, no_speech_prob),
        "avg_logprob": round(avg_logprob, 4),
        "no_speech_prob": round(no_speech_prob, 4),
        "duration": round(info.duration, 2) if hasattr(info, "duration") else 0,
        "model": "large-v3-turbo" if turbo else "small",
    }


def _transcribe_bytes(audio_bytes: bytes, lang: str) -> dict:
    small = get_small_model()
    audio = _decode_audio_compatible(io.BytesIO(audio_bytes), small.feature_extractor.sampling_rate)
    japanese = lang == "ja"

    # Fast path: the small model with Japanese-aware decoding (~1.2 s for a
    # 2-second clip). If it is not confident, escalate to the larger Japanese
    # model rather than making every recording slow (~5.5 s on this CPU).
    first = _run_transcription(
        small, audio, lang,
        beam_size=5 if japanese else 1,
        temperature=[0.0, 0.2, 0.4] if japanese else 0.0,
    )
    if japanese and _japanese_model_path() is not None and first["confidence_level"] != "high":
        try:
            turbo = get_model("ja")
            second = _run_transcription(turbo, audio, lang, beam_size=1, temperature=0.0, turbo=True)
            if second["text"] and second["avg_logprob"] > first["avg_logprob"] - 0.05:
                return second
        except Exception:
            logger.exception("Japanese turbo fallback failed; keeping the small-model transcript")
    return first


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
