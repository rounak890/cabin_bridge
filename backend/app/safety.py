"""Validation for exact, pre-approved safety phrases."""
from .translation import _phrases_data


def is_approved_safety(source_lang: str, target_lang: str, source_text: str, target_text: str) -> bool:
    return any(
        phrase.get("category") == "safety" and phrase.get("approved") is True
        and phrase.get("text", {}).get(source_lang, "").strip() == source_text.strip()
        and phrase.get("text", {}).get(target_lang, "").strip() == target_text.strip()
        for phrase in _phrases_data.get("phrases", [])
    )
