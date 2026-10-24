# CabinBridge Build Plan

## Folder structure
- `frontend/`: Vite + React + TypeScript, screens, components, assets, service worker.
- `backend/`: FastAPI routes, in-memory flight state, Argos translation, Whisper transcription.
- `shared/approved_phrases.json`: source phrase catalog imported by backend and frontend.
- `README.md`: architecture, setup, support matrix, validation plan, limitations, pilot proposal.

## Screens
- `/`: role, seat, and language picker.
- `/passenger`: phrase board, typed and voice request, delivery status, accessibility.
- `/crew`: priority request queue, replies, approved safety library, operated mode.
- `/metrics`: recent requests, latency percentiles, and fallback count.
- `/about` and `/demo`: support/privacy information and four demo scenarios.

## WebSocket message types
- `join`: role, seat, and language context; connection query carries these values.
- `message`: original and translated text, source/target language, kind, priority, and metrics.
- `urgent`: predefined assistance event; never invokes ASR or translation.
- `delivery`: server-confirmed delivered, not-delivered, acknowledged, or resolved state.
- `ack`, `resolve`: crew state changes relayed to the passenger.
- `repeat_request`: ask crew to repeat or slow down.
- `presence`: whether a crew WebSocket client is connected.
- `simulate_failure`: withhold server delivery for the demonstration.
- `crew_reply`: crew-to-passenger original and translated text.

## Milestones and acceptance checks
- M1 Data/backend skeleton: 40 reviewed-later phrases and health/language/translation APIs. Acceptance: phrases load and exact approved text bypasses Argos.
- M2 Realtime/state: WebSocket relay, request queue, delivery/ack/resolve, metrics. Acceptance: crew receipt changes the passenger state only after server delivery confirmation.
- M3 Frontend shell: role/language setup, navigation, theme, accessibility. Acceptance: all screens open and settings persist after reload.
- M4 Passenger: cards, three-card composition, TTS, urgent flow. Acceptance: card request shows source/target and urgent state without invoking translation.
- M5 Crew: sorted queue, replies, safety library, operated mode. Acceptance: crew can acknowledge, resolve, reply, and send only catalog safety wording.
- M6 Voice: push-to-talk, audio quality, ASR, editable transcript. Acceptance: low-confidence/empty transcript cannot send and valid text is previewed before sending.
- M7 Offline: service worker, phrase cache, BroadcastChannel. Acceptance: cached phrase board and urgent UI remain usable offline and delivery is not falsely claimed.
- M8 Demo/docs UI: metrics, demo, about/language matrix. Acceptance: four demo scenes are available and latency/fallback data is shown.
- M9 README: run instructions, architecture, validation plan, limitations, license notes, pilot. Acceptance: a new operator can start both local services from the documented commands.
