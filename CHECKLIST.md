# CabinBridge Build Checklist

## M1 – Data + Backend Skeleton
- [x] Shared 40-phrase catalog with seven language texts and review note
- [x] FastAPI app, CORS, health/language endpoints
- [x] Argos translation and exact approved-phrase lookup

## M2 – WebSocket + State Machine
- [x] In-memory JL-DEMO sessions and request queue
- [x] Message and urgent relay with delivery, acknowledge, and resolve states
- [x] Whisper transcription endpoint and confidence thresholds
- [x] Last-50 metrics endpoint and simulated link failure

## M3 – Frontend Shell
- [x] Vite React TypeScript shell, navigation, language/role/seat picker
- [x] Typed API client, shared types, support matrix, accessibility settings

## M4 – Passenger Features
- [x] Phrase cards, up-to-three composition, bilingual preview, TTS
- [x] Typed messages, repeat actions, persistent urgent flow and fallback
- [x] Incoming translated crew replies and delivery status

## M5 – Crew Features
- [x] Urgent-first request queue and acknowledge/resolve controls
- [x] Typed, quick-card, and voice reply paths
- [x] Approved safety library and crew-operated seat/language mode

## M6 – Voice Pipeline
- [x] Push-to-talk, recording indicator, RMS/peak feedback, replay
- [x] Editable transcript, confidence/empty prompt, translation preview

## M7 – Offline Support
- [x] Service worker caches shell and phrase catalog
- [x] Offline banner, local outbox, and BroadcastChannel tab sync

## M8 – Metrics, Demo, About
- [x] Metrics view, latency percentiles, fallback count
- [x] Four demo scenes and local Web Audio noise helper
- [x] About page with language matrix, privacy, and limitations

## M9 – README
- [x] Run instructions, Mermaid architecture, language matrix
- [x] Evaluation plan, license notes, pilot proposal and KPIs

Implementation is complete. No packages were installed and no browser session or benchmark was run.
