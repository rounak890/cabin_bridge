"""
CabinBridge FastAPI application entry point.
"""
from fastapi import FastAPI, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware

from .routes.health import router as health_router
from .routes.translate import router as translate_router
from .routes.transcribe import router as transcribe_router
from .routes.metrics import router as metrics_router
from .routes.classify import router as classify_router
from .ws import websocket_handler

app = FastAPI(title="CabinBridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(translate_router)
app.include_router(transcribe_router)
app.include_router(metrics_router)
app.include_router(classify_router)


@app.websocket("/ws")
async def ws_endpoint(
    websocket: WebSocket,
    role: str = Query(default="passenger"),
    seat: str = Query(default="unknown"),
    lang: str = Query(default="en"),
):
    await websocket_handler(websocket, role, seat, lang)
