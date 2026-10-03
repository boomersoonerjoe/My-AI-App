# Conversational live chat validation on Mac — 2026-10-01

Runtime: local Ollama 0.35.0, Qwen3.5 4B Q4_K_M. Retrieval uses free noncommercial Open-Meteo, Google News RSS and Bing/Brave public search. No cloud inference or paid API was added.

The app now asks the local model for short conversational sentences, each with a source number and an exact supporting excerpt. Source numbers are explicit in the prompt. The app stages the draft, validates quotes/citations/numbers/names and conservative news wording/tense, permits one repair attempt, and discards individually unsupported sentences if supported ones remain. A uniquely matching quote can correct a wrong citation number; ambiguous matches are rejected. News keeps headline attribution rather than claiming an event occurred on its publication date. This is conservative screening, not a formal guarantee of semantic entailment or publisher accuracy.

## Live questions

| Question | Observed outcome |
| --- | --- |
| what happened today in the news in tulsa? give me a short summary and show sources | Dated RSS headlines, short locally generated summary and citations; no expansion of Trump to an unsupported first name or claim that a scheduled match already happened. |
| current tulsa weather | Tulsa, Oklahoma numerical model estimate in Fahrenheit, conversational temperature/feels-like answer and Open-Meteo source. |
| Current weather in Tulsa, OK in Celsius | Tulsa location and Celsius retained; conversational temperature/feels-like answer. |
| Current weather in Oklahoma City, OK | Oklahoma City retained; temperature, feels-like, humidity and wind drawn from API data. |
| Current weather in Waxahachie, TX | Waxahachie, Texas retained; never substituted for Tulsa. |
| Oklahoma City news today | Dated KOCO/News 9 headlines summarized with explicit headline attribution and citations. |
| United States news today | Dated RSS sources and a supported headline summary; an unsupported companion sentence is withheld if repair cannot validate it. |
| MacBook Air current price | Relevant Apple/retailer sources; explains that retrieved snippets omit a verified current price. No price invented. |
| Compare latest budget laptops | Retailer/review sources; explains missing model comparisons and pricing. Does not invent rankings/specifications. |
| iPhone current price | Relevant product sources, conversational explanation that snippets omit prices. |
| Current events in Oklahoma (forced general web) | Search returned news landing pages without event details; explicit insufficient-evidence reply, with source cards. This does not establish adequate general-web event retrieval. |
| Research solar panel efficiency | Search returned broad solar pages without efficiency data; explicit insufficient-evidence reply. Detailed research retrieval remains limited. |

The last two are honest refusals, not successful substantive research answers. Search snippet quality is a remaining limitation; the app does not fetch complete pages/articles or guarantee current prices. Weather is model-based, not a station observation. News coverage may be sparse or geographically broad. Source metadata and retrieval time are visible; unknown publication dates are labeled.

All 60 checks passed (46 unit/HTTP and 14 live), and the production build passed. Mac browser also verifies conversational Tulsa/Celsius prose, iPhone pricing limitations, and the exact full Tulsa news question with dated sources. Public test logs and screenshots are in ignored `.local-ai/`; no private notes/history are sent in test searches. Ordinary local inference, app-owned recall, Stop/retry, offline failure behavior and privacy are retained in the regression suite. Windows/Linux/mobile acceptance remains pending.

Reproduce with the retrieval server and local runtime running:

```sh
NHOMEAI_LIVE_TEST=1 pnpm --dir web test --silent=false
pnpm --dir web build
```

All work stays on `codex/cross-platform-foundation`. Do not push or merge without new authorization.
