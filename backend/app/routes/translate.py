"""
Translation endpoint.
POST /api/translate {text, source, target}
"""
import time
from fastapi import APIRouter
from pydantic import BaseModel

from ..translation import translate

router = APIRouter()


class TranslateRequest(BaseModel):
    text: str
    source: str
    target: str


@router.post("/api/translate")
def translate_text(req: TranslateRequest):
    if not req.text.strip():
        return {"error": "empty_text"}
    try:
        translated, engine, processing_ms = translate(req.text, req.source, req.target)
        return {
            "translated": translated,
            "processing_ms": processing_ms,
            "engine": engine,
            "source": req.source,
            "target": req.target,
        }
    except ValueError as e:
        msg = str(e)
        if "unsupported_pair" in msg:
            return {"error": "unsupported_pair"}
        return {"error": msg}
    except Exception as e:
        return {"error": f"translation_failed: {e}"}
