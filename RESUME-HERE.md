# Current retrieval-context checkpoint (2026-10-02)

Stay on codex/cross-platform-foundation; do not push or merge. Search evidence is now saved regardless of source visibility. Article/story follow-ups recall saved evidence; public article URLs can be read once with bounded safe Node retrieval and cached for reload/offline follow-ups. Explicit article references can reach across intervening turns; generic references do not drag unrelated old topics in. Stronger source-person reference instructions and temperature zero for retrieved replies address the Trump/Vance confusion; models remain fallible. Source cards are still opt-in; normal chat stays local.

Read docs/RETRIEVAL-CONTEXT.md for implementation/tests/privacy/limits. Older chats whose evidence was discarded need one new retrieval. Real NASA public article and synthetic Trump-name regression pass; browser reload + search-Off follow-up verified, Auto restored. Physical other-platform acceptance remains pending. Runtime/model installed; start scripts/start-local-ai.sh and scripts/start-mac-chat.sh at localhost:4173. New /api/article server must run for uncached public article reads.

# Current weather wording checkpoint (2026-10-02)

The owner screenshot exposed location parsing of “Tulsa,ok supposed to be” instead of “Tulsa,ok”. Fixed phrase separation and added free Open-Meteo today high/low/rain chance for expected-weather queries. Location-local date/units checked; right-now weather stays current data. 41 unit/HTTP + 4 exact live routing/forecast tests and build passed; exact screenshot query works in Mac UI. Confirmed loopback retrieval server restarted. Refresh app/connect local Ollama before owner retest. No push/merge; remain on codex/cross-platform-foundation. Other forecast periods retain existing general search behavior.

# Current routing checkpoint

Keep codex/cross-platform-foundation; do not push or merge. Latest owner request supersedes prior quote validation and source-warning UX: ordinary/stable questions go directly to local Qwen/Ollama; only live information or explicit search uses retrieval. Natural streamed replies, sources only when asked, no validation refusals or automatic warnings. Search settings retain Off and web preference; legacy Always values no longer force ordinary queries online. Clock/privacy/free bounded retrieval remain. 57 Mac regressions passed; final owner examples passed (Oklahoma City, 3 hours, current Tulsa weather). Read current docs/LOCAL-FIRST-CHAT.md section; earlier entries are historical.

# Current conversational-answer checkpoint

Remain on codex/cross-platform-foundation. The user forbids push/merge. Latest changes implement locally generated cited conversational sentences with exact quote/source validation, conservative news/name/number checks, one repair and partial supported-sentence retention. All 60 Mac checks passed (46 unit/HTTP + 14 live), production build passed. Read docs/LIVE-CHAT-VALIDATION.md for 12 live retrieval questions and honest limitations: prices/comparisons often absent, broad research snippets inadequate, no complete-page fetching. Weather/news sources and Qwen/Ollama remain free/local-first. Semantic validation reduces risk but does not formally prove every paraphrase.

Mac UI verified conversational weather and product replies. Start existing scripts/start-local-ai.sh and scripts/start-mac-chat.sh, connect at http://127.0.0.1:4173. Local runtime/model already installed. Earlier remote commits remain unchanged; newer work is local only. Other platforms and owner acceptance remain pending.

# Current weather-location checkpoint

Work remains local on codex/cross-platform-foundation; do not push or merge. Latest fix preserves general search details, rejects wrong-city weather results, and adds free noncommercial Open-Meteo current model weather for validated named locations with explicit resolved place/time/units and attribution. Qwen/Ollama remain local. Read latest PROGRESS.md and docs/LOCAL-FIRST-CHAT.md for 50-test Mac evidence and limitations. Model estimates are not station observations. Primary web queries retain original trimmed text; retries remove only request scaffolding and preserve important details. News RSS and general HTML search remain available.

Start scripts/start-local-ai.sh and scripts/start-mac-chat.sh; open http://127.0.0.1:4173. Earlier authorized commits becabed/84b84dd are remote; newer feature/fix checkpoints remain local. User explicitly forbids push/merge for this work. Other-platform acceptance and specialized forecasts/station observations remain.
