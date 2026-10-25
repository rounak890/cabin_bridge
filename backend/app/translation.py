"""
Translation module for CabinBridge.
Uses argostranslate for en<->hi.
Uses a local Qwen 2.5 model through Ollama for Japanese pairs.
Pivots ja<->hi via English (Qwen for the Japanese side, Argos for Hindi).
Checks approved_phrases.json for exact matches before calling the model.

Japanese pairs first try a local Ollama model (Qwen 2.5) because the Argos
ja->en package produces unusable output for cabin sentences. If Ollama is not
running, the old Argos path is still used as a fallback.
"""
import json
import re
import time
import os
from pathlib import Path
from typing import Optional, Tuple

import httpx

from .languages import SUPPORTED_PAIRS, PIVOT_PAIRS

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT_SECONDS", "20"))
OLLAMA_KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "24h")
_OLLAMA_CACHE: dict[tuple[str, str, str], str] = {}
_OLLAMA_CACHE_PATH = Path(__file__).resolve().parent.parent / ".translation_cache.json"


def _load_ollama_cache() -> None:
    try:
        data = json.loads(_OLLAMA_CACHE_PATH.read_text(encoding="utf-8"))
        for key, value in data.items():
            source, target, text = key.split("\u0001", 2)
            if value:
                _OLLAMA_CACHE[(source, target, text)] = value
    except Exception:
        pass


def _save_ollama_cache() -> None:
    try:
        data = {
            f"{source}\u0001{target}\u0001{text}": value
            for (source, target, text), value in list(_OLLAMA_CACHE.items())[-500:]
        }
        _OLLAMA_CACHE_PATH.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


_load_ollama_cache()

LANGUAGE_NAMES = {
    "en": "English", "ja": "Japanese", "hi": "Hindi", "th": "Thai",
    "vi": "Vietnamese", "id": "Indonesian", "tl": "Filipino",
}

# Load phrases for exact-match bypass
PHRASES_PATH = Path(__file__).parent.parent.parent / "shared" / "approved_phrases.json"
_phrases_data: dict = {}
_phrase_lookup: dict = {}  # (source_lang, text_lower) -> {lang: text}


def _normalize_phrase(text: str) -> str:
    """Ignore trailing punctuation so "お水をください" matches the catalog."""
    return text.strip().lower().rstrip("。．.!?！？、,， \t\n")


def _load_phrases():
    global _phrases_data, _phrase_lookup
    try:
        with open(PHRASES_PATH, "r", encoding="utf-8") as f:
            _phrases_data = json.load(f)
        for phrase in _phrases_data.get("phrases", []):
            if phrase.get("category") == "safety" and not phrase.get("approved"):
                continue
            texts = phrase.get("text", {})
            for lang, text in texts.items():
                key = (lang, _normalize_phrase(text))
                _phrase_lookup[key] = texts
    except Exception as e:
        print(f"Warning: Could not load phrases: {e}")


_load_phrases()


def _lookup_phrase(source: str, text: str, target: str) -> Optional[str]:
    """Check if text is an exact phrase match; return pre-translated text."""
    key = (source, _normalize_phrase(text))
    translations = _phrase_lookup.get(key)
    if translations and target in translations:
        return translations[target]
    return None


def _argos_translate(text: str, source: str, target: str) -> str:
    """Call argostranslate to translate text from source to target."""
    from argostranslate import translate as argos
    installed_languages = argos.get_installed_languages()
    src_lang = next((l for l in installed_languages if l.code == source), None)
    tgt_lang = next((l for l in installed_languages if l.code == target), None)
    if src_lang is None or tgt_lang is None:
        raise ValueError(f"Language pair {source}->{target} not installed")
    translation = src_lang.get_translation(tgt_lang)
    if translation is None:
        raise ValueError(f"No translation for {source}->{target}")
    return translation.translate(text)


def _clean_llm_translation(value: str) -> str:
    result = (value or "").strip().strip("`").strip()
    result = result.strip('"').strip("'").strip()
    result = re.sub(r"^(?:translation|english|japanese|hindi|output)\s*[:：]\s*", "", result, flags=re.IGNORECASE)
    return result.strip()


def _valid_llm_translation(result: str, source: str, target: str, source_text: str) -> bool:
    if not result:
        return False
    if target == "en" and re.search(r"[\u3040-\u30ff]", result):
        return False  # kana left untranslated
    if target == "ja" and not re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", result):
        return False
    if len(result) > max(80, len(source_text) * 8):
        return False
    return True


def _ollama_translate(text: str, source: str, target: str) -> str:
    """Local Qwen translation for Japanese pairs; raises on any problem."""
    cache_key = (source, target, text)
    if cache_key in _OLLAMA_CACHE:
        return _OLLAMA_CACHE[cache_key]

    source_name = LANGUAGE_NAMES.get(source, source)
    target_name = LANGUAGE_NAMES.get(target, target)
    system = (
        f"You are a professional {source_name}-to-{target_name} translator for airline cabin communication. "
        f"Translate the passenger's message into natural {target_name}. "
        "Output only the translation: no quotes, labels, explanation, or romanization. "
        "Preserve numbers, negations, names, times, and medical terms exactly. "
        f"If the text is already in {target_name}, return it unchanged."
    )
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "keep_alive": OLLAMA_KEEP_ALIVE,
        "options": {"temperature": 0, "top_p": 0.1, "repeat_penalty": 1.05,
                    "num_predict": max(64, min(256, len(text) * 3 + 32))},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
    }
    response = httpx.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=OLLAMA_TIMEOUT)
    response.raise_for_status()
    content = (response.json().get("message") or {}).get("content", "")
    result = _clean_llm_translation(content)
    if not _valid_llm_translation(result, source, target, text):
        raise ValueError("ollama_invalid_translation")
    if len(_OLLAMA_CACHE) >= 500:
        _OLLAMA_CACHE.pop(next(iter(_OLLAMA_CACHE)))
    _OLLAMA_CACHE[cache_key] = result
    _save_ollama_cache()
    return result


def warm_ollama() -> None:
    """Load the local model in the background so the first preview is fast."""
    try:
        _ollama_translate("こんにちは", "ja", "en")
    except Exception:
        pass


def warm_argos() -> None:
    """Load Argos packages in the background so the first Hindi call is fast."""
    try:
        _argos_translate("Hello", "en", "hi")
    except Exception:
        pass


def translate(text: str, source: str, target: str) -> Tuple[str, str, int]:
    """
    Translate text from source to target language.
    Returns (translated_text, engine, processing_ms).
    engine is one of: 'phrase_match', 'argostranslate', 'pivot_argostranslate'
    Raises ValueError with message 'unsupported_pair' if pair not supported.
    """
    if source == target:
        return text, "passthrough", 0

    # Exact phrase match bypass
    phrase_result = _lookup_phrase(source, text, target)
    if phrase_result:
        return phrase_result, "phrase_match", 0

    t0 = time.time()
    pair = (source, target)

    # Japanese is the weak point of the bundled Argos package ("お水をください"
    # became "Contact Us"). Prefer the local Qwen model for Japanese, but pivot
    # Hindi through English because Qwen's direct Hindi output is unreliable.
    if pair in {("ja", "en"), ("en", "ja")}:
        try:
            result = _ollama_translate(text, source, target)
            return result, "ollama_qwen", int((time.time() - t0) * 1000)
        except Exception as exc:
            raise ValueError("translation_model_unavailable") from exc
    elif pair == ("ja", "hi"):
        try:
            english = _ollama_translate(text, "ja", "en")
            result = _argos_translate(english, "en", "hi")
            return result, "ollama_qwen_pivot", int((time.time() - t0) * 1000)
        except Exception as exc:
            raise ValueError("translation_model_unavailable") from exc
    elif pair == ("hi", "ja"):
        try:
            english = _argos_translate(text, "hi", "en")
            result = _ollama_translate(english, "en", "ja")
            return result, "argos_pivot_ollama_qwen", int((time.time() - t0) * 1000)
        except Exception as exc:
            raise ValueError("translation_model_unavailable") from exc

    if pair in SUPPORTED_PAIRS:
        try:
            result = _argos_translate(text, source, target)
            ms = int((time.time() - t0) * 1000)
            return result, "argostranslate", ms
        except Exception as exc:
            raise ValueError("unsupported_pair") from exc

    elif pair in PIVOT_PAIRS:
        # Pivot through English
        try:
            en_text = _argos_translate(text, source, "en")
            result = _argos_translate(en_text, "en", target)
            ms = int((time.time() - t0) * 1000)
            return result, "pivot_argostranslate", ms
        except Exception as exc:
            raise ValueError("unsupported_pair") from exc

    else:
        raise ValueError("unsupported_pair")
