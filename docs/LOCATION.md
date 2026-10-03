> Owner real Mac location test FAILED. Corrected runtime paths and remaining hardware gate: [LOCATION-RUNTIME-FIX.md](LOCATION-RUNTIME-FIX.md). This newer report supersedes adapter permission/timing behavior below.

# Location context and services (2026-10-02)

The portable web/PWA is the primary NhomeAI client. Location logic lives in `web/src/location.ts`, behind a platform-neutral `LocationProvider` interface. The `BrowserLocationProvider` adapter uses standard browser Geolocation; neither the core nor AI providers import Apple services. The preserved native Swift reference is unchanged; a future native adapter must implement foreground/While Using authorization, not request Always or background tracking.

## Using location

- Tell NhomeAI **“I’m in Tulsa, OK”** or **“I live in Tulsa, OK”** in a chat. Later “What’s the weather outside?” or nearby requests use the most recent stated city in that conversation, including after reopening it. Assistant guesses, retrieved text and device time zones are not location inputs.
- To reuse across completely separate chats, say **“Remember this: I live in Tulsa, OK”**, or open **Location settings**, enter a **Saved location** and press **Save location**. Clear the field and save to clear the fallback; Memory edits/deletions control saved memory locations.
- An explicit requested city wins. Otherwise precedence is latest user location statement in the active chat → permitted device location if enabled → saved fallback setting → most recent saved location note. A new travel location in a chat therefore overrides device/saved defaults. Ambiguous manual city names may require state/country. Parsing supports explicit first-person location statements, not arbitrary inferred locations.
- With no usable location, NhomeAI asks for city/state or country; **America/Chicago never supplies Chicago as a physical city**.

## Permission and privacy

Device access starts **off**. **Enable device location** invokes the platform permission flow. Choose **While Using** or **Allow Once** when offered. Web browsers control the exact permission choices; the app cannot force an OS-specific authorization label. During chat, the adapter reads location only if enabled, visible in the foreground and permission is already granted. It never triggers a fresh surprise prompt on chat/restart. Unsupported Permissions API falls back to manual location rather than risking an unexpected prompt. If a one-time grant expires, explicitly enable again.

No `watchPosition`, periodic poll, background task or Always authorization. One-shot low-accuracy reads have an 8-second timeout and at most a one-minute cached position. Latitude/longitude are rounded to two decimal places (roughly kilometre scale, varying by latitude) before retrieval. No raw sensor coordinates are persisted. Device coordinates are not written to saved memory; approximate coordinates/city can remain in persisted search evidence/source URLs. Permission denial, unavailable services and adapter errors fall back to manual/saved location. Abort remains abort.

Turning device location off prevents subsequent requests; revoke browser/OS permission for broader enforcement. Browser geolocation requires a secure context (HTTPS or trusted loopback), hardware/service availability and user permission. No actual device permission or sensor reading was exercised by the agent; granted/denied/lifecycle/cancellation paths use controlled fixtures. Owner device acceptance remains necessary. See [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).

When online weather/nearby retrieval is requested, the selected manual city or approximate device coordinates are shared with free retrieval services, not saved private notes or full conversations. Weather uses existing free Open-Meteo directly for coordinate requests. Nearby device requests use [Photon](https://github.com/komoot/photon) to resolve the rounded point to a city/state, then existing free web search. Photon is an optional public demo with no availability guarantee; request-scoped lookups are cached in server memory for ten minutes (64 entries), no background lookup. OpenStreetMap attribution is visible in Location settings. Distant reverse-geocoding results and nearby search sources without the resolved city or requested subject are rejected. Nearby means city-level search, not a guaranteed walking-distance ranking or live business-hours database.

Offline local chat, saved city context and memory remain available. Fresh weather/business facts still require retrieval. Search Off does not query device location in the UI.

## Validation

- Full suite with live retrieval/inference: **102/102 passed**; affected final location/server suite **28/28 passed** after refinements. Production build passed, existing large WebLLM bundle advisory only.
- Actual Mac UI: “I’m in Tulsa, OK” → “What’s the weather outside?” returned retrieved Tulsa 71°F/feels-like 72°F/wind 11 mph in conversational prose. No source list was requested/shown.
- Saved fallback field survived reload and a separate “Find coffee shops near me. Give me a short answer.” chat returned a conversational Tulsa coffee-shop answer. A failed first attempt exposed response-format wording polluting the query; the final query strips only that formatting instruction and preserves the nearby topic/location. Actual free public-coordinate fixture (36.15, -95.99) produced Open-Meteo weather, and Photon resolved it to Tulsa, OK; nearby search returned Tulsa coffee-shop sources. No actual user sensor data was requested/shared.
- Tests cover manual/context precedence, explicit city override, memory across separate chats, granted/denied/unavailable/throwing adapters, background/insecure restrictions, cancellation, no timezone city inference, coordinate bounds/rounding, direct weather without geocoding, nearby city/subject validation, and ordinary-chat no location access.
- Owner's actual Wi-Fi offline/reconnect test was reported **PASSED**, with Tulsa, OK specified. This supersedes that manual pending gate in the previous final report. Physical Mac/iPhone location permission/OS controls and sensor readings still need manual testing, as do other previously unperformed physical-device gates.

All changes remain local on `codex/cross-platform-foundation`; no push or merge.
