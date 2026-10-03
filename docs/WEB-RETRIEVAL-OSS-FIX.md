# Free open-source web retrieval follow-up

Validated locally October 2, 2026 (America/Chicago). No commit, push or merge.

## Decision and cost

Keep NhomeAI's React/PWA interface, browser-local model, Ollama provider, memory and existing Node server. Reuse [Mozilla Readability](https://github.com/mozilla/readability) 0.6.0 (Apache-2.0) with [jsdom](https://github.com/jsdom/jsdom) 30.1.1 (MIT) for readable evidence. Both allow personal use and modification without payment. Pin the two new dependencies in the existing pnpm lockfile.

This uses the useful component approach from the research: focused queries, multiple search sources, readable page content and local synthesis, without installing an entire assistant or another orchestration/RAG platform. Adding a separate SearXNG service or adopting a whole search application would add deployment and maintenance requirements without resolving NhomeAI's routing and local-model execution bugs. The existing public engines already returned relevant official pages when queried correctly.

There are no paid search keys, hosted inference, subscriptions or new hosting requirements. Existing public web search/news endpoints remain free access dependencies. [Open-Meteo](https://open-meteo.com/en/pricing) remains on its free personal/noncommercial API; its optional commercial service is not configured. The ordinary costs of running the user's existing computer/internet remain unchanged.

## Diagnosed failures

The earlier repair is already present in the working tree; this follow-up strengthens it rather than replacing working V1 functionality. Existing lifecycle changes were preserved.

- **Amazon sale dates:** earlier validation documented unrelated Amazon landing/account/music/jobs results accepted as success. Query formulation did not reliably retain the requested month/year, and search stopped at the first weak engine response. A link alone did not supply the official announcement's dates.
- **Ring capability refusal:** the earlier server returned irrelevant dictionary results and the old answer instruction contradicted retrieved access. The existing semantic planner helped but could still fail or return a false-negative decision; there was no reliable recovery from a capability refusal. A planner exception silently continued as local chat.
- **A newly reproduced headphone routing failure:** `isSuppliedArithmetic` extracted both `1000` and `6` from the product identifier `WH-1000XM6`. Combined with the word discounts, this marked a shopping request as arithmetic, bypassed retrieval planning and enabled reasoning. The model exhausted its budget without a final answer. This is fixed by parsing independent numeric operands rather than digits embedded in identifiers.
- **Local model execution:** the installed Qwen model's template is `{{ .Prompt }}`. Some requests emitted hidden reasoning without a final answer despite requesting non-thinking output. Retrieval now uses the documented Qwen chat/non-thinking prefix explicitly through Ollama raw generation, with bounded context/output and stream handling. Normal chat and intentional arithmetic reasoning keep their existing chat path. No model template, weights, runtime configuration or LaunchAgent was replaced.
- **Evidence quality:** first-engine selection missed stronger sources; flattened catalog text mixed marketing badges, neighboring products and prices. Generic matching confused products sharing a brand word. Plural topic words could incorrectly become required news entities. Monthly lease amounts could be mistaken for adequate purchase-price evidence, stopping refinement; eligibility-specific prices could outrank general product listings. A weather planner's abbreviated state failed geocoding. Tomorrow sometimes fell back to generic search instead of the next day's structured forecast. Old editorial deal articles and publication dates could be mistaken for current offers or deadlines.

## Changes

- Keep semantic Auto planning; preserve named products, sellers, locations and requested event year. Remove invented model generations and gratuitous complete ISO dates. Normalize news intent from generated queries.
- Treat planner exceptions as unknown decisions requiring enabled online retrieval, rather than silently disabling Auto. If a local answer says it cannot access live information, retrieve and regenerate; if it refuses despite supplied evidence, retry with the same evidence. Off/offline behavior and cancellation remain guarded.
- Aggregate independent free search engines per focused query with existing validation and bounded deadlines. Match complete meaningful multiword constraints, normalize topic plurals, exclude irrelevant review guides and reject explicit event-year mismatches. Rank official sources and refine supplier queries when only monthly payments are available. Prefer specific purchase pages and structured cash prices; downrank eligibility-only education pricing unless requested. Follow at most two bounded same-store product links when an official storefront landing page lacks an upfront price; read their structured Product offers. Use a bounded 50-second retrieval deadline so refinement has time to complete.
- Read editorial pages with Readability; preserve table/catalog fallback. Extract bounded Schema.org Product offers and heading-associated Now/Was prices so model and price stay together. Skip expired explicit offers. Preserve explicit article publication metadata and exclude editorial sale reports older than 14 days from current-deal evidence; direct manufacturer/store catalogs retain their existing role. An unknown date is not claimed as verified freshness.
- Supply concise evidence instructions for conversational answers, exact seller/model/price pairing, attribution of editorial reporting, news tense, and publication-date versus sale-deadline distinctions. Separate short weather instructions use already validated conditions/forecast values without browsing refusals or irrelevant clock conversions.
- Use structured Open-Meteo current conditions or the next local calendar day's high/low/precipitation probability. Validate timestamp, date, region and units. Support standard US state abbreviations generically; saved/manual/device location resolution is retained.
- Verify local forecast summaries against the structured numbers, reject invented current/feels-like measurements and certainty about rain, retry once and use a concise live-fact rendering if the model still fails validation. Forecast evidence excludes current conditions to prevent mixing dates. Invalid forecast fragments are held back from the display.
- Bound browser evidence separately for its smaller context. Escape Qwen control tokens in raw retrieval prompts. Keep article scripts/resources disabled and existing public-DNS pinning, private-network/redirect restrictions, decompression limits and server-origin checks.

## Preservation and validation

148 regression tests pass; 27 optional tests skip in the ordinary run. TypeScript, production build and offline-shell generation pass. The existing large model-worker bundle warning remains. `git diff --check` passes.

Four additional real-Ollama preservation tests pass: app-owned chat context, cancellation and retry, multi-step arithmetic, and persisted memory across chats including edited/deleted notes. Memory tests use isolated fixture storage, not the user's actual saved data. The live question harness also verifies no search calls for conceptual explanation, Off-mode writing and supplied-number arithmetic.

The existing local web LaunchAgent was restarted to load the backend and the production client rebuilt. Ollama/autostart definitions, real memory/storage and saved location settings were not edited. A browser tab must reload to use the rebuilt client. Physical-device WebGPU/mobile behavior and a reboot were not retested; browser provider and startup paths are covered by regression tests.

Live tests run the actual application orchestration, client search function, local `/api/search`, public providers and installed Ollama model. Natural questions come from an external temporary input file; no exact question or answer is embedded in application routing. Results are reviewed against retrieved evidence, not only source counts. The concise results artifact omits page bodies.

Public engines can rate-limit or block pages, and an editorial reported price is not a direct retailer verification. The assistant should provide supported details with appropriate attribution or report a genuine retrieval failure; no free public-search approach guarantees every page or sale remains available.

## Final natural-question results

Ten distinct current-information questions triggered live retrieval and supplied evidence to the real local model. Three local controls made zero search calls. Earlier failing runs were used to find the defects above; affected questions were rerun after their corrections. This report combines the latest validated results, rather than claiming the initial full run passed. Full questions, answers, generated queries and source URLs are recorded in [WEB-RETRIEVAL-OSS-RESULTS.json](WEB-RETRIEVAL-OSS-RESULTS.json).

| Natural question/topic | Inspected result |
| --- | --- |
| Ring camera sales online anywhere | Official Ring catalog: Battery Doorbell 2K $39.99 and Outdoor Cam 2K $49.99; exact product/price pairs preserved. |
| Amazon Prime deal sales this October | Official Amazon announcement: October 6–7, 2026; requested month/year retained. |
| Sony WH-1000XM6 discounts at the moment | PhoneArena reporting: a remaining $62-off offer despite the earlier broader promotion ending; attributed to the publisher. Direct retailer availability was not independently verified. |
| Apple entry-level MacBook Air price | Same-store product links supplied actual structured prices: 13-inch M5, 16GB/512GB, USD 1,299 in Midnight and Silver. No conversion from monthly installments. |
| Latest NASA announcements | Recent dated news headlines summarized, with the limitation that full articles were unavailable. |
| Seattle umbrella tomorrow | Structured next-day forecast: high about 68°F, low about 52°F, precipitation probability 1%. No invented feels-like reading. |
| Munich Oktoberfest closing this year | Official event information: October 4, 2026. |
| Best Buy Ring camera sales | Recent How-To Geek report of a $60 doorbell/indoor-camera bundle, attributed as reporting; direct current retailer verification remained unavailable. Old editorial offers were excluded. |
| Denver temperature right now | Validated current reading: 60.9°F, feels like 55.4°F, summarized directly without a clock-zone objection. |
| Rain here tomorrow, with fixture saved location Tulsa | Saved-location route produced high 74.8°F, low 60.3°F and a 4% precipitation probability. |
| Moon phases explanation | Local conversational explanation, no retrieval. |
| Two-line sleepy-cat poem with search Off | Local creative response, no retrieval. |
| 25% of 120 | Local answer 30, no retrieval. |

These are observations at the recorded retrieval times, not guarantees that the same prices/conditions persist. Editorial offers remain distinguished from directly read retailer prices. No canned responses or exact-question routing rules were introduced.
