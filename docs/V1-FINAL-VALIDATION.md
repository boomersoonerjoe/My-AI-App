> Real Mac device-location acceptance is NOT PASSED: owner reported failure. Routing/fallback and runtime fixes are recorded in [LOCATION-RUNTIME-FIX.md](LOCATION-RUNTIME-FIX.md); real sensor receipt remains owner acceptance.

> Update 2026-10-02: owner reports physical Wi-Fi offline/reconnection test PASSED with Tulsa, OK specified. Location context/services added and validated separately; see [LOCATION.md](LOCATION.md). Other unperformed hardware/reboot gates below remain.

# NhomeAI V1 final validation — 2026-10-02

Branch: `codex/cross-platform-foundation`. No push or merge. This records the tested state, not universal model accuracy or physical iPhone acceptance.

## Automated results

- `NHOMEAI_LIVE_TEST=1 pnpm --dir web test`: **92/92 passed**, 11 files, 145.84 seconds. Live cases enabled; none skipped. Includes local Qwen inference and real free retrieval, mocked provider/error contracts, and separate-process persistent-storage coverage.
- `pnpm --dir web build`: TypeScript, production bundle and offline shell passed. Existing large WebLLM bundle warning remains; no compilation errors.
- `xcodebuild ... -scheme PocketAI -destination 'platform=iOS Simulator,id=BAEE81A3-4591-4684-8A70-CA1701E2540B' ... test`: **19/19 passed**, zero skips/failures. Generation, model library and persistence; actual AppleChatEngine inference on iPhone 18 Pro/iOS 27 simulator. This native reference is not feature parity evidence for the portable web V1 and is not an iPhone 14 Pro Max test.
- `git diff --check`: passed. Browser warning/error logs inspected: empty during the tested Mac flows. Expected failed requests were handled in the UI. No unexpected server/runtime crashes observed.

Ignored local evidence: `.local-ai/v1-web-final.log`, `v1-native-tests.log`, `v1-native-derived/Logs/Test/`, `v1-online-server.log`, `v1-offline-server.log`, `v1-ollama.log`.

## Mac function matrix

| Function | Result | Evidence and limits |
|---|---|---|
| Local chat and streaming | PASS | Real Qwen3.5 4B Q4_K_M through local Ollama 0.35.0, no cloud fallback. |
| Browser WebGPU runtime on Mac | PASS | Actual WebLLM Llama 3.2 1B q4f16_1 model loaded and answered Oklahoma City, 3 hours, and Aspen Signal 4821 from saved memory in a new chat. No phone or offline cache-restart acceptance is implied. |
| General knowledge / ordinary local routing | PASS | Oklahoma capital answered Oklahoma City; stable questions do not search. |
| Math / reasoning examples | PASS | 180 miles at 60 mph → 3 hours; repeated $120 less 25% plus 10% tax → $99. Models remain fallible outside tested examples. |
| Same-chat context and conversation persistence | PASS | Nonce recall, saved chats, reload/tab reopening and local service restart. |
| Persistent memory / separate-chat recall | PASS | Real Qwen recall, edit/delete, save-before-confirm, migration, separate-process storage reopening and actual browser reopening. Same browser profile/origin required. |
| Greeting preference | PASS | Actual saved “Hello Joe!” appears in fresh chats, including after reopening; edits/deletions covered. |
| Relevant memory retrieval / privacy | PASS | Bounded five-note/2,000-byte context, large 10,001-note regression, no private memories in search queries. |
| Device date/time/timezone offline | PASS | Local clock, UTC-midnight/DST regressions, no network/model required. |
| Current weather / forecast | PASS | Real Tulsa location/units and exact owner wording, retrieved current conditions and today high/low/rain chance, conversational Qwen answer. |
| Current news / web / product searches | PASS | Live Tulsa news, Oklahoma/US news, iPhone/MacBook prices, budget laptops and research questions; source visibility opt-in. Search coverage and snippets may be incomplete; no promise every product price is available. |
| Retrieved article follow-ups | PASS | Real NASA article plus cached offline follow-up; saved evidence survives reload; synthetic Trump/Vance person-reference regression. Public accessible excerpts only, not paywall bypass. |
| Offline local behavior | PASS | Retrieval process outbound networking denied; local capital answer worked, unavailable live weather returned an honest retrieval failure. Ollama separately restarted with outbound networking denied and cloud disabled; local reply worked. Not an OS airplane-mode test. |
| Internet reconnection | PASS | Retrieval process restarted with networking restored; actual UI Tulsa weather returned current conversational data after earlier failure. |
| Stop / Retry | PASS | Real midstream Stop, incomplete fragment removed, reopened pending chat offered Retry, retry completed and saved reply survived reload. Provider cancellation/concurrency/error contracts pass. |
| Error recovery | PASS | Stopped real Ollama process, actual failed request and Retry, restarted Ollama and successful local response. Missing weights, HTTP/malformed/empty streams, storage failures and retrieval failure tested. |
| Persistence after process restart | PASS | App server and Ollama restarted, browser tabs reopened, memory/chats retained; separate-process storage regression passes. Full browser-process quit and Mac reboot remain manual. |

## Failures found and fixed during validation

1. Supplied-price arithmetic was mistaken for a current product-price query. Preserve local routing for arithmetic with supplied numbers, while explicit/current price searches remain online.
2. Qwen's fast mode returned $93 for the $99 discount/tax example. Enable bounded local reasoning only for recognized supplied-number arithmetic, hide reasoning tokens and check the final total. The repeated live regression passes; regular chat retains its existing fast path.
3. Stopping a streamed reply left an incomplete fragment stored as a completed assistant answer. Stream into a temporary UI preview; persist only completed replies, discard cancelled/error previews, and offer Retry for a durable pending user turn after reopening. Actual UI midstream and persistence tests pass. Old fragments saved by the previous version have no completion metadata and are not automatically removed.

No unrelated feature changes. Existing saved-memory work is preserved. Normal replies remain conversational; sources only when asked; no paid APIs.

## Required manual acceptance

### Mac

- Quit the entire browser, relaunch the same profile at the same origin, verify saved chats and memory, then restart the Mac and restart the existing local services. No actual Mac reboot or full browser-process termination was performed in this session.
- Turn Wi-Fi off/on; test sleep/wake and retrieval recovery. Automated process network denial is strong isolation evidence but not physical network-switch evidence.
- Longer real conversations and sustained use: output quality, battery, thermals, memory pressure and latency. Bounded responses can stop at the configured token limit (512 normal Qwen tokens, 2,048 arithmetic reasoning budget).

### iPhone 14 Pro Max — not accepted yet

- Apple Foundation Models cannot be assumed available: Apple's supported Apple Intelligence iPhones start with 15 Pro/Pro Max, not 14 Pro Max. The successful newer simulator does not remove this runtime gate. See https://support.apple.com/en-gb/121115.
- Establish a compatible on-device runtime and actual delivery: trusted HTTPS Safari/PWA with WebGPU/model cache, or a compatible signed native build. Mac loopback `127.0.0.1:4173` is not a phone-accessible URL. No deployment/signing/exposure was added during validation.
- Test model download/cache, interrupted downloads, free storage and memory pressure; ordinary chat/knowledge/math and all memory/search features on the actual chosen build. Native reference tests alone do not prove portable feature parity.
- New-chat recall, greeting, edit/delete and conversation/article persistence across Safari/PWA close, force quit and phone reboot. Clearing browser site data removes local notes; no cross-browser/device sync or backup is supplied.
- Airplane mode and Wi-Fi/cellular reconnection, cached article follow-ups, stop/retry, backgrounding and screen locking.
- Keyboard, portrait/landscape, notch/safe areas, touch targets, text sizes/VoiceOver, sustained 15–30 minute battery/thermal/performance checks.

## Completion assessment

**Approximately 80% of overall V1 acceptance complete**, an engineering estimate rather than a test-pass percentage. All executed final automated Mac/simulator tests pass after fixes. Physical iPhone runtime/delivery/feature acceptance and actual OS reboot/network/lifecycle/performance gates remain substantial. V1 is not certified complete on the iPhone 14 Pro Max.
