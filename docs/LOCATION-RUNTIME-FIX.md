# Real Mac location failure investigation — 2026-10-02

**Real Mac device-location acceptance: NOT PASSED. Owner reported failure; owner retest is required.** Automated tests and public-coordinate geocoding are not hardware proof.

## Confirmed defects and corrections

- Direct questions “Where am I?” and “What is my current location?” were absent from location routing. They went to ordinary local model chat without resolved coordinates/manual location. They now call the same platform-neutral resolver and answer deterministically from the result, including with no model loaded. Saved fallback is labelled as saved/stated, not presented as a verified sensor reading.
- The browser adapter required `Permissions.query({name:'geolocation'})` to report granted. Browsers without this feature, or with a prompt/unknown status after a successful callback, could suppress later readings. A successful foreground callback now authorizes reuse within the session; persisted explicit user opt-in also allows a foreground location request after adapter/browser restart when permission-status querying is unsupported or says prompt. The OS/browser still controls consent and may prompt when a grant expires. Reported denied permission still falls back immediately. Device access off and ordinary chat do not invoke geolocation.
- Enabling location previously cleared the setting if coordinates did not arrive within eight seconds, conflating a permission decision with a successful reading. Enable now retains explicit opt-in, reports the actual outcome, and offers **Refresh device location** plus **Turn off device location**. Initial/manual refresh allows 45 seconds for permission/acquisition; normal location questions allow 20 seconds. No periodic/background tracking.
- City conversion was only used for nearby searches, not for a direct current-location answer. A bounded, loopback-origin-restricted **POST /api/location** endpoint now resolves rounded coordinates through the existing free Photon adapter. Chat resolves a city before answering direct location questions. If conversion fails, use saved/manual fallback; coordinate weather can still work without a city when no fallback exists. Invalid/distant/missing-city geocoder results are rejected.
- Location Settings shows coordinate receipt (rounded to two decimal places), permission/service/timeout failure, and city-lookup success/failure. Permission approval alone is not displayed as successful coordinate acquisition.

## Actual runtime evidence

- Real Mac browser Enable/Refresh invoked browser Geolocation. **No real coordinates arrived** in the agent's browser session: the original eight-second request and the corrected 45-second refresh timed out. This is an observed runtime failure, not a fixture. The cause of OS/browser sensor unavailability cannot be established from a timeout alone. No guessed coordinates were substituted.
- Real running endpoint `/api/location` with public fixture coordinates 36.15, -95.99 returned HTTP 200, `Tulsa, OK`. This proves deployed city conversion, not receipt of the owner's device reading.
- Actual chat UI with device access unavailable and saved Tulsa, OK: “Where am I?” and “What is my current location?” returned **Your saved location is Tulsa, OK.** Model loading was unnecessary. “What’s the weather outside?” retrieved Tulsa conditions; “Find coffee shops near me” retrieved Tulsa coffee-shop sources and a local-model answer. The final persisted-opt-in path requests actual foreground coordinates after reload before falling back.
- Full automated/live regression suite: **106/106 passed**, 12 files, 113.13 seconds. After the final persisted-opt-in/validation refinement, the affected location/server suite: **33/33 passed**. Production build passed; browser console warnings/errors inspected. Test logs: `.local-ai/location-runtime-full.log`, `location-runtime-targeted.log`, `location-runtime-build.log`. Hardware acceptance remains separate.

## Owner retest

Refresh http://127.0.0.1:4173/, open **Location settings** below Internet search, verify Saved location is Tulsa, OK, press **Enable device location** or **Refresh device location**, and approve the browser/macOS prompt if shown. Keep the app visible; allow up to 45 seconds.

The status must explicitly show **Device coordinates received … City lookup: …** to establish real device success. A timeout/denial is a device-access failure, even if saved fallback works. In a new chat, test all four requests: Where am I? / What is my current location? / What’s the weather outside? / Find coffee shops near me. With device access off/denied, direct answers should explicitly identify Tulsa, OK as saved and weather/nearby retrieval should use it. Internet is needed for city reverse-geocoding and fresh retrieval, not for returning a saved city. No physical-city inference from time zone.

If coordinates still time out, the visible status now distinguishes the stage. Owner/browser/macOS Location Services checks remain necessary; this work did not reset system permissions or change OS privacy settings. Both local services remain running. No push or merge; branch codex/cross-platform-foundation.
