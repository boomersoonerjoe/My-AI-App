# NhomeAI V1 local-first chat

## Saved sources and article follow-ups (2026-10-02)

Search results now persist on every retrieved reply even when source lists are hidden. Article/story follow-ups reuse saved evidence and accessible cached article text rather than searching again. Public article URLs can be read once and retained; supplied URLs can be read directly. Cached evidence survives reloads and works with search Off. Old messages whose evidence was already discarded need one new retrieval. See [retrieval context](RETRIEVAL-CONTEXT.md) for subject-reference handling, bounded safe article access, Mac validation and limitations. Prior sections describing no article reading are historical.

## Today forecast correction (2026-10-02)

“what is the weather in Tulsa,ok supposed to be today?” now separates the city/state from forecast phrasing. Expected-weather questions use Open-Meteo daily high, low and rain chance for the resolved location’s current calendar day; right-now questions retain current data. Exact screenshot wording, capital, driving math and current Tulsa weather passed real local-model/retrieval testing; 41 unit/HTTP checks and build passed. Mac UI also verified the forecast answer without source lists or warnings. Other forecast periods retain general web search. The running retrieval server was restarted with this fix.

## Current chat routing (2026-10-01)

Normal conversation, math and stable general knowledge go directly to the local model. Search runs only for changing/live information or explicit search/browse/look-up requests. Legacy Always settings now apply automatic routing too; general-web preference still chooses the web tool for eligible queries. Off still disables internet access. Device-clock questions keep their existing direct offline behavior.

Retrieved answers stream as ordinary local-model prose, without the former structured-quote validation/repair gate, automatic citation lists, verification warnings or publication-date caveats. Sources are displayed only when the current question requests sources/citations/links. Saved old messages are not rewritten. Missing internet/results still produces a short retrieval error instead of invented live data. Safe-link checks, free endpoints, privacy and retrieval bounds remain.

Mac regression: 57 tests passed (40 unit/HTTP, 17 live). The final exact-example rerun returned “The capital of Oklahoma is Oklahoma City.” and “3 hours.” without searching; Tulsa weather retrieved fresh model data and answered “It is currently 70°F in Tulsa, with a feels-like temperature of 76°F and high humidity.” No source list or warnings. Production build passed. Older validation sections below are historical and their quote-gate/source-warning behavior is superseded by this section.

The portable React/TypeScript PWA, schema-v1 local storage and provider-neutral ChatProvider remain the foundation. The new chat-service orchestrates device context, optional retrieval and local inference. Existing Swift reference code is unchanged.

## Behavior and privacy

- Device date, time, weekday, UTC offset and IANA time zone come from Date/Intl, refreshed per request. The header ticks independently. Direct clock questions work without internet or a loaded model. Accuracy depends on the device clock.
- Ordinary conversation runs locally, using Ollama on desktop or the retained WebLLM browser adapter. No cloud AI fallback.
- Auto search recognizes common current-information wording, including “Tulsa news today.” Always · automatic sources handles other wording; Always · general web also searches news questions through HTML engines; Off disables retrieval. Auto is a heuristic, not comprehensive intent detection. Unrecognized changing-fact questions receive a model instruction to decline unsupported current claims; that instruction alone cannot guarantee model compliance.
- A loopback Node server retrieves free Google News RSS for news. General web search parses organic HTML results from Brave, then Bing, with Bing RSS as a final fallback. No account, API key or paid API. These public endpoints are best effort and may change, block requests, return irrelevant results or omit coverage. No challenge bypass, search-engine AI answer scraping, full article scraping or arbitrary URL fetching.
- Only the current question is used as the external query. Saved notes/history remain local. Search sites see the query, normal network metadata and, for news, a derived calendar date range. No GPS/location permission. Opening a source link makes an ordinary third-party browser visit.
- Retrieved answers use short conversational sentences generated locally by Qwen/Ollama, with numbered citations and source cards. Each sentence carries an exact supporting excerpt internally. The app validates source IDs, exact quote membership, numbers, names and conservative news wording/tense before publishing, and permits one repair attempt. A uniquely matching quote can correct a misnumbered citation. Failed validation produces an explicit refusal. These checks reduce unsupported claims but are not a formal semantic proof and cannot establish publisher accuracy. Insufficient evidence produces an honest explanation instead of invented prices, comparisons or current facts.
- Today-news results require publication metadata matching the device's exact calendar day/time zone; future and undated entries are discarded. News publication metadata is supplied by the feed, not independently audited. General web snippets have unknown publication dates and are labeled accordingly; today-specific web questions can retrieve relevant snippets, but never claim verified publication dates or live accuracy; the answer includes that warning. Weather, prices and other live data are not guaranteed by general search snippets.
- Missing connectivity, sources or a valid grounded answer produces an explicit refusal rather than a guessed current answer. Previously saved citations retain their retrieval timestamp; they are not refreshed or represented as today's new evidence. Sources persist additively within schema-v1 messages.

## Run on the Mac

The existing installed runtime is Ollama 0.35.0 with Qwen3.5 4B Q4_K_M (`qwen3.5:4b-q4_K_M`). Model processing stays on the Mac. In separate terminals from the repository:

```sh
./scripts/start-local-ai.sh
./scripts/start-mac-chat.sh
```

Open http://127.0.0.1:4173 and connect local Ollama. The second script now runs the retrieval/static server, replacing Vite preview. Model weights/runtime are ignored local files, not part of Git. See MAC-LOCAL-AI.md for initial setup. No additional model download is needed on this Mac.

For a rebuild, use Node 22+ and pnpm in web/: `pnpm install`, `pnpm test`, `pnpm run build`, `pnpm start`. Vite development at port 5173 proxies /api/search to the separately running server on 4173. A static-only host or Vite preview alone cannot provide online search.

The Node service uses portable APIs and the provider contract remains portable. Launch scripts and outbound-blocking test profile are Mac-specific conveniences. Windows/Linux launch instructions, mobile retrieval deployment and physical mobile acceptance remain future work. The server binds loopback only; it is not exposed to phones/LAN. Native browser inference and cached offline chat remain available where WebGPU/model assets are supported.

## Mac validation, 2026-10-01

- Production TypeScript/Vite build passed (39 modules; existing large WebLLM bundle advisory).
- 31 unit/HTTP tests passed, including clock/DST/calendar boundaries, privacy, exact extraction, malformed/fabricated source selections, offline refusals, cancellation, safe links, bounded feeds, origin/host/body validation and static traversal protection.
- Three opt-in real tests passed: live dated Tulsa news retrieved through the server and summarized through installed Ollama; streaming and app-owned recall of 7429; Stop and successful fresh request.
- Mac browser: live news summary/citations visible, saved citations survive reload; header and combined date/time answer correct; ordinary greeting works while both server and Ollama outbound internet are blocked with the sandbox profile; news request in that condition explicitly refuses current facts. Normal retrieval server restored afterward.

Owner acceptance remains: open the preview, ask date/time, ordinary chat and Tulsa news today, follow source links, and try with Wi-Fi disconnected. The agent tested blocked outbound processes without altering the owner's Wi-Fi settings. Broader queries, search relevance and other platforms need acceptance; no full-article synthesis, live-data guarantees, packaging/autostart or mobile retrieval rollout is claimed.

## Conversational-query correction

On 2026-10-01 the owner's full Tulsa question exposed an overconstrained upstream query. News search now strips common question/response scaffolding into topic keywords and tries a second upstream date syntax if the first returns no dated matches. Exact local-day validation is never relaxed. The exact owner query is the opt-in live regression. All 36 tests (including three live tests) and the production build passed after the correction. Ollama selects headlines at temperature zero, with explicit guidance that relevant dated headlines can answer broad news-summary requests. Free public feed reliability is still outside the application's control.

## General web expansion, 2026-10-01

The free tool now uses normal Node HTTP requests and Cheerio to parse organic HTML search results, not only RSS. Brave is preferred; Bing HTML and Bing RSS provide bounded fallbacks. Each request has an 8-second per-engine timeout, 25-second combined budget, 1 MiB response limit, up to four safe HTTP/S source links, and cancellation. Redirects are rejected. HTML scripts/styles/markup are stripped; search-engine generated answer boxes and ads are excluded. No API keys, account, paid credits, cloud inference, or extra dependencies were added.

Auto triggers now include products, price/cost, comparisons/reviews/recommendations, research, common device shopping terms, weather and current events in addition to news/latest/current wording. This remains a deterministic heuristic; Always modes cover missed wording. News RSS is retained with its exact local-day date filter. Always · general web can search any topic, including news, through HTML engines.

Query normalization strips common research/comparison commands and puts the subject ahead of generic recency/price adjectives. Public engine relevance and access are not guaranteed. In live Mac tests Brave's Node requests were rate-limited; the app respected that failure and used Bing. Some Bing results were too broad until topic-first normalization. No CAPTCHA or blocking page was bypassed.

Qwen3.5 4B Q4_K_M on Ollama 0.35.0 continues to select exact excerpts locally, with sources and persisted retrieval timestamps. It can supply sourced search excerpts and useful links; it cannot infer missing product comparisons, exact live prices, numeric current weather, publication dates or full-page findings. A weather search that returns forecast-page descriptions is a list of sources, not a verified forecast. Specialized weather/retailer data and full-page retrieval are future improvements. Search sites see only the current normalized query (and normal request metadata); notes and other turns never leave the device.

Mac checks: production build passed; 38 unit/HTTP tests plus 8 real tests passed. Live queries covered exact Tulsa news, Tulsa weather today, MacBook Air current price, latest budget laptops, Oklahoma current events and solar-panel research, plus ordinary Ollama streaming/recall/Stop/retry. UI confirmed automatic HTML search with links. With outbound internet blocked, general weather search refused unsupported facts while ordinary local greeting worked. Online server restored afterward. Windows/Linux/mobile acceptance remains pending; implementations use portable Node/browser APIs, while test sandbox/launch conveniences remain Mac-specific.

## Weather location correction

On 2026-10-01 Bing returned Waxahachie weather even with Tulsa present in the outgoing query. Primary general-web queries now retain the trimmed original text rather than stripping/reordering words. Topic-prefixed retries remove only leading request scaffolding. Weather sources must match the requested location in title/URL and identify a weather page; unrelated cities are discarded.

Named current-weather requests first use free noncommercial Open-Meteo geocoding/current-weather APIs. The exact city name is checked, explicit state/country constraints are retained, ambiguous places require clarification unless one exact-name city clearly dominates in population, and the full resolved place is always shown. Only the question's named location is sent; no GPS or device geolocation is read. Celsius/Fahrenheit requests are retained; US defaults to Fahrenheit. Coordinates come only from validated geocoding results. Current data must be within two hours of the device clock, not materially future-dated, and have valid requested units. This is model-based weather, not a station observation. Forecast/historical questions are not silently answered with current values. If the free weather API fails, location-filtered search remains a fallback; if neither verifies sources, the app refuses rather than substituting another city.

Open-Meteo/GeoNames attribution appears with the source. The fixed weather API URL is linked so returned data can be inspected. [Weather API documentation](https://open-meteo.com/en/docs) and [geocoding documentation](https://open-meteo.com/en/docs/geocoding-api) describe the data and parameters. Free access applies to this personal noncommercial app; commercial use would require revisiting the service terms. No account, paid key or dependency was introduced.

Mac validation: 42 unit/HTTP checks plus 8 live checks and production build passed. Checks cover exact query details, Waxahachie rejection, wrong-state rejection, unit preservation and stale data, plus existing category/local-inference regressions. “current tulsa weather” and browser “What is the current Tulsa weather?” returned explicitly resolved Tulsa, Oklahoma model data and sources. Native observations, multi-day forecast integration and other-platform acceptance remain future work.

## Conversational answers and expanded live checks

Current retrieved replies now use locally generated short cited sentences rather than extractive lists. See [live chat validation](LIVE-CHAT-VALIDATION.md) for validation rules and the 12 weather/news/product/research queries. Mac passed 46 unit/HTTP plus 14 real tests and production build. Weather and dated news returned supported prose; product queries honestly explained missing prices/comparisons. Two broad general-web queries lacked substantive evidence and were declined. Earlier validation sections describe historical checkpoints. Source snippets remain incomplete, no full-page reading was added, and screening cannot formally prove every paraphrase.
