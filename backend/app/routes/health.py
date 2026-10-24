"""
Health and language endpoints.
"""
from fastapi import APIRouter
from ..languages import LANGUAGES
from .transcribe import model_status

router = APIRouter()


@router.get("/api/health")
def health():
    return {"status": "ok", "flight": "JL-DEMO", "version": "1.0.0", "asr_model": model_status()}


@router.get("/api/languages")
def get_languages():
    return {"languages": LANGUAGES}
