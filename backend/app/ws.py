"""WebSocket message relay for the in-memory JL-DEMO flight."""
import uuid
import time
from fastapi import WebSocket, WebSocketDisconnect
from .state import state, Session, Request
from .safety import is_approved_safety
from .reply_delivery import handle_crew_reply


async def _broadcast_to_crew(payload: dict) -> int:
    """Send JSON payload to all connected crew sessions."""
    crew = state.get_crew_sessions()
    delivered = 0
    for session in crew:
        try:
            await session.ws.send_json(payload)
            delivered += 1
        except Exception:
            pass
    return delivered


async def _broadcast_to_passenger(seat: str, payload: dict) -> int:
    """Send JSON payload to all passenger sessions for a seat."""
    passengers = state.get_passenger_sessions(seat)
    delivered = 0
    for session in passengers:
        try:
            await session.ws.send_json(payload)
            delivered += 1
        except Exception:
            pass
    return delivered


async def _broadcast_presence():
    """Broadcast crew_online status to all connected sessions."""
    crew_online = state.crew_online()
    payload = {"type": "presence", "crew_online": crew_online}
    for session in list(state.sessions.values()):
        try:
            await session.ws.send_json(payload)
        except Exception:
            pass


async def websocket_handler(ws: WebSocket, role: str, seat: str, lang: str):
    if role not in {"passenger", "crew"}:
        await ws.close(code=1008)
        return
    # Seat IDs must match even when one device enters "12 a" and another
    # enters "12A"; replies are routed by this canonical value.
    seat = "".join(seat.split()).upper()
    await ws.accept()
    session_id = str(uuid.uuid4())[:8]
    session = Session(ws=ws, session_id=session_id, role=role, seat=seat, lang=lang)
    state.add_session(session)

    # Announce presence change
    await _broadcast_presence()

    # Send initial presence to this client
    await ws.send_json({"type": "presence", "crew_online": state.crew_online()})
    await ws.send_json({"type": "simulate_failure", "on": state.simulate_failure})

    async def send_snapshot():
        snapshot = state.reply_snapshot(role, seat)
        await ws.send_json(snapshot)
        for reply_id in snapshot["redelivered"]:
            await _broadcast_to_crew({"type": "delivery", "id": reply_id, "status": "delivered"})
        for request in snapshot["redelivered_requests"]:
            await _broadcast_to_passenger(request["seat"], {
                "type": "delivery", "id": request["id"], "status": "delivered",
            })

    try:
        while True:
            data = await ws.receive_json()
            event_type = data.get("type")

            if event_type == "join":
                await ws.send_json({"type": "joined", "flight": "JL-DEMO", "role": role, "seat": seat, "lang": lang})
                await send_snapshot()

            elif event_type == "sync":
                await send_snapshot()

            elif event_type == "message":
                if role != "passenger":
                    await ws.send_json({"type": "error", "message": "passenger_role_required"})
                    continue
                msg_id = data.get("id", str(uuid.uuid4())[:8])
                kind = data.get("kind", "text")
                source_text = data.get("source_text", "")
                translated_text = data.get("translated_text", "")
                source_lang = data.get("source_lang", lang)
                target_lang = data.get("target_lang", "en")
                priority = data.get("priority", "normal")
                if data.get("edited"):
                    state.fallback_count += 1

                # Safety wording is accepted only from the approved catalog.
                if kind == "safety":
                    if not is_approved_safety(source_lang, target_lang, source_text, translated_text):
                        await ws.send_json({"type": "error", "message": "safety_phrase_not_approved"})
                        continue

                req = Request(
                    id=msg_id,
                    flight_id="JL-DEMO",
                    seat=seat,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    source_text=source_text,
                    translated_text=translated_text,
                    kind=kind,
                    priority=priority,
                    status="sent",
                    asr_ms=data.get("asr_ms", 0),
                    translate_ms=data.get("translate_ms", 0),
                    total_ms=data.get("total_ms", 0),
                    confidence_level=data.get("confidence_level", "high"),
                )
                state.add_request(req)

                # Relay to crew (if not simulating failure)
                if not state.simulate_failure and state.crew_online():
                    crew_payload = {
                        "type": "message",
                        "id": msg_id,
                        "from": seat,
                        "seat": seat,
                        "source_lang": source_lang,
                        "source_text": source_text,
                        "translated_text": translated_text,
                        "target_lang": target_lang,
                        "kind": kind,
                        "priority": priority,
                        "status": "delivered",
                        "ts": time.time(),
                    }
                    delivered = await _broadcast_to_crew(crew_payload)
                    if not delivered:
                        await ws.send_json({"type": "delivery", "id": msg_id, "status": "not_delivered"})
                        continue
                    req.status = "delivered"
                    req.delivered_at = time.time()
                    # Notify sender of delivery
                    await ws.send_json({"type": "delivery", "id": msg_id, "status": "delivered"})
                else:
                    # Not delivered
                    await ws.send_json({"type": "delivery", "id": msg_id, "status": "not_delivered"})

            elif event_type == "urgent":
                if role != "passenger":
                    await ws.send_json({"type": "error", "message": "passenger_role_required"})
                    continue
                urg_id = data.get("id") or str(uuid.uuid4())[:8]
                urg_type = data.get("urgent_type", "medical")
                payload = {
                    "type": "urgent",
                    "id": urg_id,
                    "seat": seat,
                    "urgent_type": urg_type,
                    "ts": time.time(),
                }
                # Record as a request
                req = Request(
                    id=urg_id,
                    flight_id="JL-DEMO",
                    seat=seat,
                    source_lang=lang,
                    target_lang="en",
                    source_text=f"URGENT: {urg_type}",
                    translated_text=f"URGENT: {urg_type}",
                    kind="urgent",
                    priority="urgent",
                    status="sent",
                )
                state.add_request(req)

                if not state.simulate_failure and state.crew_online():
                    delivered = await _broadcast_to_crew(payload)
                    if not delivered:
                        await ws.send_json({"type": "delivery", "id": urg_id, "status": "not_delivered"})
                        continue
                    req.status = "delivered"
                    req.delivered_at = time.time()
                    await ws.send_json({"type": "delivery", "id": urg_id, "status": "delivered"})
                else:
                    await ws.send_json({"type": "delivery", "id": urg_id, "status": "not_delivered"})

            elif event_type == "ack":
                msg_id = data.get("id")
                req = state.requests.get(msg_id)
                if req and role == "crew":
                    req.status = "acknowledged"
                    req.acknowledged_at = time.time()
                    req.acknowledged_by = session_id
                    # Notify the passenger
                    await _broadcast_to_passenger(req.seat, {
                        "type": "delivery",
                        "id": msg_id,
                        "status": "acknowledged",
                    })
                    # Keep every open crew queue in sync.
                    await _broadcast_to_crew({"type": "ack", "id": msg_id, "status": "acknowledged"})

            elif event_type == "resolve":
                msg_id = data.get("id")
                req = state.requests.get(msg_id)
                if req and role == "crew":
                    req.status = "resolved"
                    req.resolved_at = time.time()
                    await _broadcast_to_passenger(req.seat, {
                        "type": "delivery",
                        "id": msg_id,
                        "status": "resolved",
                    })
                    await _broadcast_to_crew({"type": "delivery", "id": msg_id, "status": "resolved"})

            elif event_type == "repeat_request":
                if role != "passenger":
                    await ws.send_json({"type": "error", "message": "passenger_role_required"})
                    continue
                repeat = {"type": "repeat_request", "id": data.get("id", ""), "request_id": data.get("request_id", ""), "seat": seat, "ts": time.time()}
                state.add_repeat_request(repeat)
                state.fallback_count += 1
                await _broadcast_to_crew(repeat)

            elif event_type == "simulate_failure":
                if role != "crew":
                    await ws.send_json({"type": "error", "message": "crew_role_required"})
                    continue
                state.simulate_failure = bool(data.get("on", False))
                await ws.send_json({"type": "simulate_failure", "on": state.simulate_failure})

            elif event_type == "crew_reply":
                if role != "crew":
                    await ws.send_json({"type": "error", "message": "crew_role_required"})
                    continue
                await handle_crew_reply(ws, data, _broadcast_to_crew)

    except WebSocketDisconnect:
        pass
    finally:
        state.remove_session(session_id)
        await _broadcast_presence()
