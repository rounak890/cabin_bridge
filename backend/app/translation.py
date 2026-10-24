"""
Translation module for CabinBridge.
Uses argostranslate for en<->ja and en<->hi.
Pivots via English for ja<->hi.
Checks approved_phrases.json for exact matches before calling the model.
"""
import json
import time
import os
from pathlib import Path
from typing import Optional, Tuple

from .languages import SUPPORTED_PAIRS, PIVOT_PAIRS

# Load phrases for exact-match bypass
PHRASES_PATH = Path(__file__).parent.parent.parent / "shared" / "approved_phrases.json"
_phrases_data: dict = {}
_phrase_lookup: dict = {}  # (source_lang, text_lower) -> {lang: text}


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
                key = (lang, text.strip().lower())
                _phrase_lookup[key] = texts
    except Exception as e:
        print(f"Warning: Could not load phrases: {e}")


_load_phrases()


def _lookup_phrase(source: str, text: str, target: str) -> Optional[str]:
    """Check if text is an exact phrase match; return pre-translated text."""
    key = (source, text.strip().lower())
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
