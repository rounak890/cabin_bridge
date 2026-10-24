"""
In-memory state for CabinBridge demo flight JL-DEMO.
Tracks: WebSocket sessions, request queue, metrics.
"""
import uuid
import time
from typing import Dict, List, Optional, Any
from fastapi import WebSocket
from dataclasses import dataclass, field


FLIGHT_ID = "JL-DEMO"


@dataclass
class Session:
    ws: WebSocket
    session_id: str
    role: str          # 'passenger' | 'crew'
    seat: str
    lang: str
    connected_at: float = field(default_factory=time.time)


@dataclass
class Request:
    id: str
    flight_id: str
    seat: str
    source_lang: str
    target_lang: str
    source_text: str
    translated_text: str
    kind: str          # 'speech' | 'text' | 'card' | 'safety' | 'urgent'
    priority: str      # 'normal' | 'urgent'
    status: str        # 'sent' | 'delivered' | 'acknowledged' | 'resolved'
    asr_ms: int = 0
    translate_ms: int = 0
    total_ms: int = 0
    confidence_level: str = "high"
    created_at: float = field(default_factory=time.time)
    delivered_at: Optional[float] = None
    acknowledged_at: Optional[float] = None
    resolved_at: Optional[float] = None
    acknowledged_by: Optional[str] = None


class AppState:
    def __init__(self):
        # session_id -> Session
        self.sessions: Dict[str, Session] = {}
        # request_id -> Request
        self.requests: Dict[str, Request] = {}
        self.crew_replies: List[Dict[str, Any]] = []
        self.repeat_requests: List[Dict[str, Any]] = []
        # ordered list of request IDs (newest last)
        self.request_ids: List[str] = []
        # simulate crew link failure flag
        self.simulate_failure: bool = False
        self.fallback_count: int = 0

    def add_session(self, session: Session):
        self.sessions[session.session_id] = session

    def remove_session(self, session_id: str):
        self.sessions.pop(session_id, None)

    def get_crew_sessions(self) -> List[Session]:
        return [s for s in self.sessions.values() if s.role == "crew"]

    def get_passenger_sessions(self, seat: Optional[str] = None) -> List[Session]:
        sessions = [s for s in self.sessions.values() if s.role == "passenger"]
        if seat:
            sessions = [s for s in sessions if s.seat == seat]
        return sessions

    def crew_online(self) -> bool:
        return len(self.get_crew_sessions()) > 0

    def add_request(self, req: Request):
        self.requests[req.id] = req
        self.request_ids.append(req.id)
        # Keep last 200 requests
        if len(self.request_ids) > 200:
            old_id = self.request_ids.pop(0)
            self.requests.pop(old_id, None)

    def get_recent_requests(self, n: int = 50) -> List[Request]:
        ids = self.request_ids[-n:]
        return [self.requests[i] for i in reversed(ids) if i in self.requests]

    def add_reply(self, reply: Dict[str, Any]):
        self.crew_replies.append(reply)
        del self.crew_replies[:-200]

    def add_repeat_request(self, request: Dict[str, Any]):
        self.repeat_requests.append(request)
        del self.repeat_requests[:-100]

    def reply_snapshot(self, role: str, seat: str) -> Dict[str, Any]:
        changed = []
        replies = self.crew_replies if role == "crew" else [r for r in self.crew_replies if r["seat"] == seat]
        if role == "passenger":
            for reply in replies:
                if reply["status"] != "delivered":
                    reply["status"] = "delivered"
                    changed.append(reply["id"])
        items = [{**reply, "is_outgoing": role == "crew", "is_crew_reply": role == "passenger"} for reply in replies]
        redelivered_requests = []
        requests = []
        if role == "crew":
            for req in self.get_recent_requests(200):
                if req.status in {"sent", "not_delivered"} and not self.simulate_failure:
                    req.status = "delivered"
                    req.delivered_at = time.time()
                    redelivered_requests.append({"id": req.id, "seat": req.seat})
                if req.status != "not_delivered":
                    requests.append(vars(req))
        else:
            # Restore this passenger's request timeline (including crew
            # acknowledgements and resolution) after a reconnect or refresh.
            requests = [
                vars(req) for req in self.get_recent_requests(200)
                if req.seat == seat
            ]
        repeats = self.repeat_requests if role == "crew" else []
        return {"type": "snapshot", "requests": requests, "replies": items, "repeat_requests": repeats,
                "redelivered": changed, "redelivered_requests": redelivered_requests}

    def new_request_id(self) -> str:
        return str(uuid.uuid4())[:8]


# Global singleton
state = AppState()
