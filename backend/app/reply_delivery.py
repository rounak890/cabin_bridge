"""Persist and route crew replies to connected passenger seats."""
import time
import uuid
from fastapi import WebSocket
from .state import state
from .safety import is_approved_safety


async def broadcast_to_seat(seat: str, payload: dict) -> int:
    sent = 0
    for session in state.get_passenger_sessions(seat):
        try:
            await session.ws.send_json(payload)
            sent += 1
        except Exception:
            continue
    return sent


async def handle_crew_reply(ws: WebSocket, data: dict, broadcast_to_crew):
    source = data.get("source_lang", "en")
    target = data.get("target_lang", "en")
    if data.get("kind") == "safety" and not is_approved_safety(source, target, data.get("source_text", ""), data.get("translated_text", "")):
        await ws.send_json({"type": "error", "id": data.get("id"), "message": "safety_phrase_not_approved"})
        return
    reply = {
        "id": data.get("id") or str(uuid.uuid4())[:8],
        "seat": "".join(data.get("target_seat", "").split()).upper(),
        "source_lang": source,
        "source_text": data.get("source_text", ""),
        "translated_text": data.get("translated_text", ""),
        "target_lang": target,
        "kind": data.get("kind", "text"),
        "ts": time.time(),
        "status": "sent",
    }
    if not reply["seat"]:
        await ws.send_json({"type": "delivery", "id": reply["id"], "status": "not_delivered"})
        return
    state.add_reply(reply)
    delivered = await broadcast_to_seat(reply["seat"], {"type": "crew_reply", **reply})
    reply["status"] = "delivered" if delivered else "not_delivered"
    await broadcast_to_crew({"type": "crew_reply_sent", **reply, "is_outgoing": True})
    await ws.send_json({"type": "delivery", "id": reply["id"], "status": reply["status"]})

    # A reply from a request card completes that exact request. Replies composed
    # from the general Reply tab complete the newest still-open request for seat.
    request_id = data.get("request_id")
    request = state.requests.get(request_id) if request_id else None
    if request and request.seat != reply["seat"]:
        request = None
    if request is None and not request_id:
        request = next((item for item in state.get_recent_requests(200)
                        if item.seat == reply["seat"] and item.status != "resolved"), None)
    if request and request.status != "resolved":
        request.status = "resolved"
        request.resolved_at = time.time()
        status_event = {"type": "delivery", "id": request.id, "status": "resolved"}
        await broadcast_to_seat(request.seat, status_event)
        await broadcast_to_crew(status_event)
