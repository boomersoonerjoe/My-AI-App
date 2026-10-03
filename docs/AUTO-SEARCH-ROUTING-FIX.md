# Auto search routing regression fix

Superseded by [the end-to-end retrieval repair](INTERNET-RETRIEVAL-FIX.md), which addresses the weak results and verifies actual Ollama summaries.

The V1 prompt “Are there any sales currently going on at Best Buy for Ring cameras?” missed `needsCurrentInformation` in `web/src/search.ts`. The router matched `deals` and `prices`, but not `sales`, `currently`, or natural cost questions. With no retrieved evidence, the local model produced its own real-time-access caveat. Retrieval is decided before generation, so changing model instructions would not correct the cause.

The classifier now covers sales, discounts, promotions, coupons, cost questions, product availability/specifications/recommendations, news, weather, current events, financial rates, flight status, current officeholders, and timely external facts. Current-time qualifiers take precedence over the old broad past-tense exclusion, allowing “What happened in the news today?” and yesterday's election results. Explicit search requests, supplied-price arithmetic, conceptual explanations, historical questions, and local device clock behavior retain their existing routes. The search transport, provider, memory, location, article reuse, and mode semantics were not changed.

Validation:

- 21 current-information prompts assert Auto invokes retrieval exactly once before generation and passes evidence into the provider, including the exact reported prompt.
- 10 additional local-routing cases and an Off-mode regression check.
- Deterministic suite: 122 tests passed; 22 existing opt-in tests skipped (before adding four new opt-in retrieval tests).
- Four opt-in tests in `web/tests/auto-search-live.test.mjs` passed against real services: Best Buy sales, Ring pricing, Tulsa weather, and technology news. Run with `NHOMEAI_SEARCH_LIVE_TEST=1`.
- TypeScript checking and production build passed.

Live-test limit: the real Bing web endpoint returned irrelevant dictionary pages for both full-sentence shopping questions. These tests confirm the Auto routing and evidence handoff, not deal accuracy or answer quality. Weather returned Open-Meteo evidence and news returned Google News RSS evidence. Search-result relevance is a separate existing retrieval-service issue; this routing change does not claim that an active Ring deal was confirmed.

No push or merge performed. Existing uncommitted lifecycle work was preserved.
