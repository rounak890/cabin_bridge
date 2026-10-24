"""Translate-then-classify step for the crew queue.

The crew should not have to read the full passenger message. This module turns
the translated text into a small, typed decision:

    intent, urgency, short summary, suggested action, keywords

Primary path: Jev (https://thejevai.com) when ``JEV_API_KEY`` is set.
Fallback path: a deterministic multilingual keyword classifier so the demo
still works fully offline and no message is ever hidden behind a failed API.

Jev is a decision API (Choice / Score / Noul), not a generative summarizer:
it selects an intent from a fixed set, and the short summary is derived from
that choice. That keeps the output stable and safe for crew workflows.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

JEV_URL = os.environ.get("JEV_API_URL", "https://thejevai.com/v1/systemone")
JEV_MODEL = os.environ.get("JEV_MODEL", "jev-latest")
JEV_TIMEOUT = float(os.environ.get("JEV_TIMEOUT_SECONDS", "2.5"))

# A small, complete answer space. The key is what Jev returns and what the UI
# uses; the label/summary/action are shown to the crew.
INTENTS: dict[str, dict[str, Any]] = {
    "medical": {
        "label": "Medical", "icon": "🏥", "priority": 100,
        "summary": "Medical assistance requested.",
        "action": "Check on the passenger now",
        "terms": ["medical", "doctor", "chest pain", "cannot breathe", "can't breathe", "pain",
                  "injury", "sick", "unwell", "nauseous", "nausea", "dizzy", "faint", "diabetic",
                  "अस्पताल", "डॉक्टर", "दर्द", "बीमार", "मतली", "चक्कर", "सांस",
                  "病院", "医者", "痛い", "気分が悪い", "吐き気", "めまい", "息"],
        "brief": "Medical help",
    },
    "allergy": {
        "label": "Allergy", "icon": "⚠️", "priority": 95,
        "summary": "Food allergy or safety concern.",
        "action": "Check the meal and allergy details",
        "terms": ["allergy", "allergic", "एलर्जी", "एलर्जी", "アレルギー", "แพ้", " dị ứng", "alergi", "alerdyi"],
        "brief": "Allergy",
    },
    "medicine": {
        "label": "Medicine", "icon": "💊", "priority": 90,
        "summary": "Medicine requested.",
        "action": "Ask what medicine is needed",
        "terms": ["medicine", "medication", "tablet", "pill", "दवा", "दवाई", "薬", "ยา", "thuốc", "obat", "gamot"],
        "brief": "Medicine",
    },
    "wheelchair": {
        "label": "Mobility", "icon": "♿", "priority": 85,
        "summary": "Wheelchair or mobility assistance requested.",
        "action": "Arrange mobility assistance",
        "terms": ["wheelchair", "mobility", "walk", "walking", "व्हीलचेयर", "चलने", "車椅子", "移動",
                  "xe lăn", "kursi roda", "gumalaw", "kailangan ng tulong"],
        "brief": "Mobility help",
    },
    "bag": {
        "label": "Baggage", "icon": "🧳", "priority": 60,
        "summary": "Help with a bag or luggage.",
        "action": "Help with the baggage",
        "terms": ["bag", "bags", "luggage", "suitcase", "बैग", "सामान", "荷物", "กระเป๋า", "túi", "tas", "bagahe"],
        "brief": "Bag help",
    },
    "seat": {
        "label": "Seat", "icon": "💺", "priority": 55,
        "summary": "Seat or seating assistance.",
        "action": "Help with the seat",
        "terms": ["seat", "seating", "सीट", "席", "ที่นั่ง", "ghế", "kursi", "upuan"],
        "brief": "Seat help",
    },
    "restroom": {
        "label": "Restroom", "icon": "🚻", "priority": 50,
        "summary": "Restroom location or access.",
        "action": "Show the way to the restroom",
        "terms": ["restroom", "toilet", "bathroom", "washroom", "शौचालय", "टॉयलेट", "トイレ", "手洗い",
                  "ห้องน้ำ", "nhà vệ sinh", "toilet", "banyo", "kubeta"],
        "brief": "Restroom",
    },
    "water": {
        "label": "Water", "icon": "💧", "priority": 40,
        "summary": "Passenger wants water.",
        "action": "Bring water",
        "terms": ["water", "drink", "पानी", "पीने", "水", "お水", "น้ำ", "nước", "air", "tubig"],
        "brief": "Water",
    },
    "blanket": {
        "label": "Blanket", "icon": "🛏️", "priority": 38,
        "summary": "Passenger wants a blanket.",
        "action": "Bring a blanket",
        "terms": ["blanket", "कंबल", "毛布", "ผ้าห่ม", "chăn", "selimut", "kumot"],
        "brief": "Blanket",
    },
    "meal": {
        "label": "Meal", "icon": "🍱", "priority": 35,
        "summary": "Meal or food requested.",
        "action": "Bring the meal",
        "terms": ["meal", "food", "eat", "hungry", "vegetarian", "खाना", "भोजन", "भूख", "शाकाहारी",
                  "食事", "食べ", "お腹", "ベジタリアン", "อาหาร", "กิน", "makanan", "lapar", "pagkain", "gutom"],
        "brief": "Meal",
    },
    "temperature": {
        "label": "Temperature", "icon": "🌡️", "priority": 30,
        "summary": "Cabin temperature request.",
        "action": "Adjust the cabin temperature or bring a blanket",
        "terms": ["cold", "hot", "warm", "temperature", "ठंड", "गर्मी", "寒い", "暑い", "หนาว", "ร้อน",
                  "lạnh", "nóng", "dingin", "panas", "malamig", "mainit"],
        "brief": "Temperature",
    },
    "headphones": {
        "label": "Headphones", "icon": "🎧", "priority": 25,
        "summary": "Headphones or earbuds requested.",
        "action": "Bring headphones",
        "terms": ["headphones", "headphone", "earbuds", "earphones", "हेडफोन", "हेडफ़ोन", "ヘッドホン",
                  "イヤホン", "หูฟัง", "tai nghe", "headphone", "earphone"],
        "brief": "Headphones",
    },
    "window": {
        "label": "Window", "icon": "🪟", "priority": 20,
        "summary": "Window shade assistance.",
        "action": "Help with the window shade",
        "terms": ["window", "shade", "blind", "खिड़की", "窓", "シェード", "หน้าต่าง", "cửa sổ", "jendela", "bintana"],
        "brief": "Window",
    },
    "repeat": {
        "label": "Understanding", "icon": "🔁", "priority": 22,
        "summary": "Passenger needs a repeat or slower speech.",
        "action": "Repeat slowly or write it down",
        "terms": ["repeat", "again", "understand", "didn't understand", "slow", "slowly", "write",
                  "दोबारा", "समझ", "धीरे", "लिख", "もう一度", "わかりません", "ゆっくり", "書いて",
                  "อีกครั้ง", "เข้าใจ", "ช้า", "lặp lại", "hiểu", "chậm", "ulangi", "pahami", "pelan",
                  "ulitin", "maintindihan", "dahan-dahan"],
        "brief": "Repeat",
    },
    "information": {
        "label": "Information", "icon": "ℹ️", "priority": 15,
        "summary": "Information requested.",
        "action": "Answer the passenger's question",
        "terms": ["information", "where", "when", "how long", "land", "landing", "time", "companion",
                  "कहाँ", "कब", "कितना", "उतर", "जानकारी", "どこ", "いつ", "着陸", "시간", "ที่ไหน",
                  "เมื่อไหร่", "ở đâu", "kapan", "dimana", "saan", "kailan"],
        "brief": "Information",
    },
    "thanks": {
        "label": "Thanks", "icon": "🙏", "priority": 10,
        "summary": "Passenger said thank you.",
        "action": "No action needed",
        "terms": ["thank", "thanks", "धन्यवाद", "ありがとう", "ขอบคุณ", "cảm ơn", "terima kasih", "salamat"],
        "brief": "Thanks",
    },
    "other": {
        "label": "Other", "icon": "💬", "priority": 0,
        "summary": "Assistance requested.",
        "action": "Check with the passenger",
        "terms": [],
        "brief": "Assistance",
    },
}

URGENT_TERMS = [
    "urgent", "emergency", "immediately", "right now", "asap", "help me", "help",
    "chest pain", "cannot breathe", "can't breathe", "bleeding", "faint",
    "तुरंत", "मदद", "इमरजेंसी", "अभी", "緊急", "助けて", "今すぐ", "至急",
    "เร่งด่วน", "ช่วย", "khẩn cấp", "giúp", "darurat", "tolong", "agaran", "tulong",
]

ACTION_FOR_INTENT = {
    "medical": "medical", "allergy": "medical", "medicine": "medical",
    "wheelchair": "assist", "bag": "assist", "seat": "assist", "window": "assist",
    "water": "bring", "blanket": "bring", "meal": "bring", "headphones": "bring",
    "restroom": "assist", "temperature": "assist",
    "repeat": "information", "information": "information", "thanks": "other", "other": "other",
}

URGENCY_LABEL = {"routine": "Routine", "attention": "Needs attention", "urgent": "Urgent"}
JEV_CACHE: dict[str, dict[str, Any]] = {}
CACHE_LIMIT = 500


def _is_ascii(value: str) -> bool:
    return all(ord(char) < 128 for char in value)


def _find_terms(text: str, terms: list[str]) -> list[str]:
    """Return the actual substrings found in the text, preserving script/case."""
    found: list[str] = []
    lowered = text.lower()
    for term in terms:
        if not term:
            continue
        if _is_ascii(term):
            match = re.search(rf"(?<![a-z]){re.escape(term.lower())}(?![a-z])", lowered)
            if match:
                original = text[match.start():match.end()]
                if original.strip() and original not in found:
                    found.append(original)
        elif term in text and term not in found:
            found.append(term)
    return found


def _dedupe_keywords(values: list[str]) -> list[str]:
    """Prefer longer phrases and drop substrings ("chest pain" over "pain")."""
    unique = {value.strip() for value in values if value and value.strip()}
    ordered = sorted(unique, key=len, reverse=True)
    result: list[str] = []
    for value in ordered:
        lowered = value.lower()
        if any(lowered in existing.lower() for existing in result):
            continue
        result.append(value)
    return result[:4]


def _local_classify(text: str, source_text: str, kind: str) -> dict[str, Any]:
    combined = f"{text}\n{source_text}".strip()
    lowered = combined.lower()

    scored: list[tuple[int, int, str, list[str]]] = []
    for key, intent in INTENTS.items():
        if not intent["terms"]:
            continue
        matches = _find_terms(combined, intent["terms"])
        if matches:
            scored.append((len(matches), intent["priority"], key, matches))
    scored.sort(reverse=True)

    critical = {"medical", "allergy"}
    critical_matches = [row for row in scored if row[2] in critical]
    if critical_matches:
        count, priority, intent_key, matches = critical_matches[0]
    elif scored:
        count, priority, intent_key, matches = scored[0]
    else:
        intent_key, matches = "other", []

    urgent_hits = _find_terms(combined, URGENT_TERMS)
    if kind == "urgent" or urgent_hits:
        urgency = "urgent"
    elif intent_key in {"medical", "allergy", "medicine", "wheelchair"} or re.search(r"\bhelp\b", lowered):
        urgency = "attention"
    else:
        urgency = "routine"

    intent = INTENTS[intent_key]
    keywords = _dedupe_keywords(matches + urgent_hits)
    # Language-independent fallback for the chips: use the intent brief.
    if not keywords:
        keywords = [intent["brief"]]

    confidence = min(0.94, 0.55 + 0.12 * len(matches)) if matches else 0.4
    return {
        "intent": intent_key,
        "label": intent["label"],
        "icon": intent["icon"],
        "summary": intent["summary"],
        "action": intent["action"],
        "urgency": urgency,
        "urgency_label": URGENCY_LABEL[urgency],
        "keywords": keywords,
        "confidence": round(confidence, 2),
        "source": "local",
    }


def _jev_questions() -> dict[str, Any]:
    criteria = {key: f"{intent['label']}: {intent['summary']}" for key, intent in INTENTS.items()}
    return {
        "intent": {
            "type": "choice",
            "instructions": "What does the passenger need? Choose the single best category.",
            "criteria": criteria,
        },
        "urgency": {
            "type": "choice",
            "instructions": "How urgent is this request for the cabin crew?",
            "criteria": {
                "routine": "Normal service request, no immediate risk.",
                "attention": "Needs a crew response soon, but no immediate danger.",
                "urgent": "Medical, safety, or emergency request that needs immediate action.",
            },
        },
    }


def _jev_classify(text: str, source_text: str) -> dict[str, Any] | None:
    api_key = os.environ.get("JEV_API_KEY", "").strip()
    if not api_key:
        return None
    payload = {
        "model": JEV_MODEL,
        "state": {
            "translated_message": text,
            "original_message": source_text,
            "context": "Passenger on a commercial flight speaking to cabin crew",
        },
        "questions": _jev_questions(),
    }
    try:
        response = httpx.post(
            JEV_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=JEV_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        answers = data.get("answers") or {}
        intent_answer = answers.get("intent") or {}
        intent_key = str(intent_answer.get("choice") or "").lower()
        if intent_key not in INTENTS:
            return None
        confidence = float(intent_answer.get("confidence") or 0)
        if confidence and confidence < 0.45:
            return None
        urgency_answer = answers.get("urgency") or {}
        urgency = str(urgency_answer.get("choice") or "").lower()
        if urgency not in URGENCY_LABEL:
            urgency = "attention" if intent_key in {"medical", "allergy", "wheelchair"} else "routine"
        intent = INTENTS[intent_key]
        keywords = _dedupe_keywords(_find_terms(f"{text}\n{source_text}", intent["terms"])) or [intent["brief"]]
        return {
            "intent": intent_key,
            "label": intent["label"],
            "icon": intent["icon"],
            "summary": intent["summary"],
            "action": intent["action"],
            "urgency": urgency,
            "urgency_label": URGENCY_LABEL[urgency],
            "keywords": keywords,
            "confidence": round(confidence, 3) if confidence else None,
            "source": "jev",
        }
    except Exception as exc:  # network, auth, schema, timeout
        logger.warning("Jev classification unavailable (%s); using local fallback", type(exc).__name__)
        return None


def classify(text: str, source_text: str = "", kind: str = "text") -> dict[str, Any]:
    """Classify the translated text into a short crew-facing decision."""
    cache_key = hashlib.sha256(f"{kind}\n{text}\n{source_text}".encode("utf-8")).hexdigest()
    cached = JEV_CACHE.get(cache_key)
    if cached:
        return cached

    result = _jev_classify(text, source_text)
    if result is None:
        result = _local_classify(text, source_text, kind)
    result["action_type"] = ACTION_FOR_INTENT.get(result["intent"], "other")

    if len(JEV_CACHE) >= CACHE_LIMIT:
        JEV_CACHE.pop(next(iter(JEV_CACHE)))
    JEV_CACHE[cache_key] = result
    return result
