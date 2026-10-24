"""
Metrics endpoint — last 50 interactions with latency stats.
"""
import statistics
from fastapi import APIRouter
from ..state import state

router = APIRouter()


@router.get("/api/metrics")
def get_metrics():
    requests = state.get_recent_requests(50)
    records = []
    for r in requests:
        records.append({
            "id": r.id,
            "seat": r.seat,
            "kind": r.kind,
            "source_lang": r.source_lang,
            "target_lang": r.target_lang,
            "status": r.status,
            "confidence_level": r.confidence_level,
            "asr_ms": r.asr_ms,
            "translate_ms": r.translate_ms,
            "total_ms": r.total_ms,
            "created_at": r.created_at,
        })

    # Compute latency stats
    asr_times = [r.asr_ms for r in requests if r.asr_ms > 0]
    translate_times = [r.translate_ms for r in requests if r.translate_ms > 0]
    total_times = [r.total_ms for r in requests if r.total_ms > 0]

    def stats(values):
        if not values:
            return {"median": 0, "p95": 0, "count": 0}
        sorted_vals = sorted(values)
        median = statistics.median(sorted_vals)
        p95_idx = max(0, int(len(sorted_vals) * 0.95) - 1)
        return {"median": median, "p95": sorted_vals[p95_idx], "count": len(values)}

    fallback_count = state.fallback_count + sum(
        1 for r in requests
        if r.kind in ("card",) or r.confidence_level in ("empty", "low")
    )

    return {
        "requests": records,
        "stats": {
            "asr": stats(asr_times),
            "translate": stats(translate_times),
            "total": stats(total_times),
        },
        "fallback_count": fallback_count,
        "total_requests": len(records),
        "crew_online": state.crew_online(),
        "simulate_failure": state.simulate_failure,
    }


@router.post("/api/simulate_failure")
def toggle_failure(on: bool):
    state.simulate_failure = on
    return {"simulate_failure": state.simulate_failure}
