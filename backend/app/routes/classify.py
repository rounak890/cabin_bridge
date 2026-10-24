"""Classification endpoint: short crew-facing summary for translated text."""
from fastapi import APIRouter
from pydantic import BaseModel

from ..classifier import classify

router = APIRouter()


class ClassifyRequest(BaseModel):
    text: str
    source_text: str = ""
    source_lang: str = "en"
    target_lang: str = "en"
    kind: str = "text"


@router.post("/api/classify")
def classify_text(req: ClassifyRequest):
    text = (req.text or "").strip()[:2000]
    source_text = (req.source_text or "").strip()[:2000]
    if not text and not source_text:
        return {"error": "empty_text"}
    return classify(text, source_text, req.kind or "text")
