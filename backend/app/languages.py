"""
Language support definitions for CabinBridge.
Defines which features are available per language.
"""
from typing import TypedDict, List


class LanguageInfo(TypedDict):
    code: str
    name: str
    nativeName: str
    asr: bool          # Faster-Whisper supports transcription
    translate: bool    # argostranslate en<->X pair available
    tts: bool          # Browser TTS likely available
    phrasebook: bool   # Phrase cards available
    pivot: bool        # Translation via English pivot (ja<->hi)


LANGUAGES: List[LanguageInfo] = [
    {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "asr": True,
        "translate": True,
        "tts": True,
        "phrasebook": True,
        "pivot": False,
    },
    {
        "code": "ja",
        "name": "Japanese",
        "nativeName": "日本語",
        "asr": True,
        "translate": True,
        "tts": True,
        "phrasebook": True,
        "pivot": False,
    },
    {
        "code": "hi",
        "name": "Hindi",
        "nativeName": "हिन्दी",
        "asr": True,
        "translate": True,
        "tts": True,
        "phrasebook": True,
        "pivot": False,
    },
    {
        "code": "th",
        "name": "Thai",
        "nativeName": "ภาษาไทย",
        "asr": True,
        "translate": False,
        "tts": True,
        "phrasebook": True,
        "pivot": False,
    },
    {
        "code": "vi",
        "name": "Vietnamese",
        "nativeName": "Tiếng Việt",
        "asr": True,
        "translate": False,
        "tts": True,
        "phrasebook": True,
        "pivot": False,
    },
    {
        "code": "id",
        "name": "Indonesian",
        "nativeName": "Bahasa Indonesia",
        "asr": True,
        "translate": False,
        "tts": True,
        "phrasebook": True,
        "pivot": False,
    },
    {
        "code": "tl",
        "name": "Tagalog",
        "nativeName": "Filipino",
        "asr": True,
        "translate": False,
        "tts": True,
        "phrasebook": True,
        "pivot": False,
    },
]

LANGUAGE_MAP = {lang["code"]: lang for lang in LANGUAGES}

# Pairs supported directly by argostranslate (en<->X)
SUPPORTED_PAIRS = {
    ("en", "ja"), ("ja", "en"),
    ("en", "hi"), ("hi", "en"),
}

# Pivot pairs: translate X->en->Y
PIVOT_PAIRS = {
    ("ja", "hi"), ("hi", "ja"),
}
