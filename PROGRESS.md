# Latest fix: retained retrieval/article context and subject references, 2026-10-02

- Confirmed source evidence was discarded unless sources were requested; follow-up prompts also omitted stored evidence and had a tiny history budget. Evidence now persists on every retrieved reply regardless of visibility, and recognized source/story/article follow-ups reuse it without a fresh search. Explicit article references can reach earlier retrieval across unrelated turns; generic references stay with the previous reply.
- Added bounded public-article reading from the prior source or an explicitly supplied URL, with cached text/status, private-address/DNS/redirect protections, no credentials/paywall bypass and no paid API. Cached article text survives reload/offline follow-ups; snippets remain available if full text cannot be read. Source cards stay opt-in; ordinary questions, clock/weather/forecast behavior and schema remain.
- The Vance substitution came from model generation, not an app name rewrite. Evidence-based reference instructions prioritize the saved source over mistaken prior names; retrieved replies use temperature zero. Real local-model synthetic regression keeps Trump as the subject despite an earlier Vance mistake. Model errors/search relevance remain possible.
- Mac: all 70 checks passed (50 unit/HTTP and 20 live); build passed. Browser verified direct NASA article reading and a cached follow-up after reload with search Off; Auto restored. See docs/RETRIEVAL-CONTEXT.md for exact evidence and limits. Existing old messages with discarded evidence need one fresh retrieval.
- Development branch only; no push or merge.

# Latest fix: screenshot weather wording and today forecast, 2026-10-02

- Reproduced the exact owner question “what is the weather in Tulsa,ok supposed to be today?” failing because the location parser retained “supposed to be” after Tulsa,ok. It now separates expected-weather phrasing from the city/state while preserving state matching.
- Added today daily high/low and maximum precipitation probability to the free Open-Meteo path for expected-weather/forecast requests, with location-local day and units checked. Current/right-now requests retain current data. Tomorrow/multi-day/historical requests still use existing search behavior; no broader forecast rollout is claimed.
- Mac: 41 unit/HTTP checks and 4 exact owner live questions passed; production build passed. Screenshot wording returned Tulsa’s retrieved daily high/low/rain chance in natural local-Qwen prose; Mac UI verified the same without source lists or warnings. Capital/math stayed local (Oklahoma City/3 hours). Confirmed retrieval server restarted with the fix.
- Work remains local on codex/cross-platform-foundation; no push or merge.

# Latest fix: direct local routing and clean retrieved replies, 2026-10-01

- Narrowed search triggers: normal conversation, math, general knowledge and conceptual research/comparisons stay local, even with saved legacy Always settings. Live/current questions and explicit search requests use retrieval; Off/device-clock behavior retained.
- Retrieved answers now stream normal local-model prose. Removed quote-validation/repair refusals, automatic warnings and default citations/source lists. Sources are opt-in per question. Safe URLs, bounded free retrieval and private local context remain unchanged.
- Mac: 57 regression checks passed; final exact-example rerun passed all three. Capital → Oklahoma City/no search; driving math → 3 hours/no search; Tulsa right-now weather → retrieved data and concise natural answer/no source list or disclaimer. Production build passed. UI verified source-free weather prose.
- Work stays local on codex/cross-platform-foundation; no push or merge. Earlier quote-gate checkpoints below are historical.

# Latest checkpoint: conversational retrieved answers, 2026-10-01

- Local Qwen/Ollama now writes short cited conversational prose instead of only exact extractive lists. Structured sentences include exact supporting quotes; the app checks citations, quotes, numbers, names and conservative news wording/tense before publishing. One repair attempt is allowed; individually unsupported sentences are discarded when supported ones remain. Unique quote matches correct citation misnumbering; ambiguous matches fail closed. Semantic screening is conservative, not a formal no-hallucination guarantee.
- Mac: 60 checks passed (46 unit/HTTP, 12 live retrieval questions, 2 real local-inference/recall/Stop tests); TypeScript/Vite production build passed. Weather covered Tulsa Fahrenheit/Celsius, Oklahoma City and Waxahachie with correct locations. Dated news covered exact full Tulsa question, Oklahoma City and US news. Product searches covered MacBook Air, budget laptops and iPhone, explaining absent prices/comparisons instead of fabricating them. Two broader web research questions lacked substantive snippets and were honestly declined. See docs/LIVE-CHAT-VALIDATION.md for outcomes and limitations.
- Mac UI verified natural Tulsa/Celsius weather prose, cited iPhone response and the exact full Tulsa news summary with dated sources. Qwen3.5 4B Q4_K_M / Ollama 0.35.0, free retrieval, offline ordinary chat/device clock, portable provider/schema foundation remain. Other-platform acceptance and deeper page/article retrieval remain pending.
- Work remains local on codex/cross-platform-foundation. Do not push or merge.

# Latest fix: weather query/location preservation, 2026-10-01

- Removed broad web-query command stripping/adjective reordering. Primary web queries preserve the trimmed original text. Bounded retries add a subject prefix and remove only leading question scaffolding; location spelling, qualifiers, units and other details remain. Named subject checks retain product/research relevance.
- Reproduced Bing returning Waxahachie weather despite Tulsa in the outgoing query. Weather results now require the requested location in the title/URL and an actual weather page. Unmatched sources fail closed.
- Added free noncommercial Open-Meteo current weather for exactly resolved named cities, respecting explicit state/country and Celsius/Fahrenheit. Ambiguous places fail closed unless one exact-name place clearly dominates in population; resolved full place is shown. No GPS or device-location assumptions. Freshness and units validated; forecasts/historical questions keep search rather than silently receiving current data.
- Mac: production build passed; 42 unit/HTTP and 8 live tests passed. Live current Tulsa returned timestamped numerical weather-model data through local Qwen. Browser “What is the current Tulsa weather?” verified the same Tulsa/Oklahoma location with a source link. Model estimates are clearly labeled, not claimed as station observations. Offline failure behavior and free/local-first architecture preserved.
- Checkpoint local only on codex/cross-platform-foundation. No push or merge. Other-platform validation and specialized forecast/station-observation support remain pending.

# Latest milestone: general web search, 2026-10-01

- Expanded retrieval beyond RSS with free Brave/Bing organic HTML search, Bing RSS fallback, bounded fetch/parse/cancellation, safe decoded links and exact excerpts. No keys, paid API, extra dependency or cloud inference. Qwen/Ollama unchanged.
- Expanded automatic intent routing for weather/products/prices/current events/research/comparison and added Always · general web override, including news. RSS remains the automatic news source. Device clock and ordinary offline chat preserved.
- Production build passed; 38 unit/HTTP plus 8 live tests passed. Mac live tests verified sources/local selection for all requested categories and retained news/streaming/recall/Stop/retry. UI verified automatic HTML search; blocked outbound networking verified explicit search refusal and ordinary local greeting. Online server restored.
- Free engine access/relevance is best effort. Brave was rate-limited to Node; Bing fallback worked. No challenge bypass. Web snippets have unknown publication dates; exact live weather/prices and full-page comparisons are not claimed. See docs/LOCAL-FIRST-CHAT.md for precise limitations and privacy.
- Checkpointed locally on codex/cross-platform-foundation; no push or merge. Other-platform acceptance and owner tests remain.

# Latest fix: conversational news retrieval, 2026-10-01

- Reproduced the owner's exact query: “what happened today in the news in tulsa? give me a short summary and show sources” returned no dated sources because response instructions and conversational scaffolding were sent verbatim to Google News RSS.
- Added portable deterministic topic normalization (query becomes “tulsa news”) and a bounded second date-syntax attempt after an empty news feed. Both attempts retain exact device-calendar-day filtering; no older/undated fallback or paid API.
- Clarified local source selection: dated relevant headlines suffice for broad headline summaries. Ollama source selection now uses temperature zero; generated facts still cannot enter the extractive summary.
- Validation: 36 automated tests passed, including real exact-query retrieval and local Ollama selection; production build passed. Mac browser exact query returned current dated News On 6, UAB Athletics, Tulsa Flyer and FOX23 links and a short extractive summary. Public feed availability/relevance remains best effort.
- Changes checkpointed locally on codex/cross-platform-foundation. No push or merge authorized for this fix; none performed.

# Latest checkpoint: 2026-10-01 local-first V1

- Preserved portable PWA/provider/schema architecture and Swift reference; added Date/Intl device context and offline clock answers, optional free fixed-endpoint Google News/Bing RSS retrieval in a loopback Node server, Auto/Always/Off controls, persisted citations, and validated Ollama source selection for exact extractive summaries.
- Current retrieval failures refuse rather than fabricate. Auto intent detection is heuristic; general snippets are not verified live data. See docs/LOCAL-FIRST-CHAT.md for precise limits/privacy and cross-platform rollout requirements.
- Mac: production build passed; 31 unit/HTTP checks and 3 real Ollama/live-news checks passed. Browser verified dated Tulsa sources, persistence, offline clock, offline local greeting, and explicit unavailable-news refusal under blocked outbound networking. Normal server restored. Existing model/runtime unchanged; no paid API or main merge.
- Earlier commits becabed/84b84dd were pushed after explicit owner authorization to boomersoonerjoe/My-AI-App on this development branch. This local-first milestone is committed locally, pending any new publish instruction. Historical approval-block text below describes the earlier pre-authorization state.
- Owner acceptance, full article retrieval, specialized live data, packaging/autostart, Windows/Linux and physical mobile validation remain. No broad no-hallucination guarantee is claimed for ordinary generative chat.

# PocketAI - AI Hand-Off & Project Progress Tracker

## Purpose
This file is the canonical hand-off record for AI-assisted development of PocketAI. Any model continuing development should read this file first, then inspect the latest commits, open pull requests, active feature branches, repository tree, and relevant source files. Update this file at every clean stopping point and before handing work to another model.

This workflow is intentionally model-agnostic. No AI provider or model needs to be listed here in advance to participate. Any capable AI model with appropriate repository access should follow the same continuation, branch, validation, and hand-off rules in this file.

## Continuation Rule
When the owner says **"continue build"**, the incoming model should automatically use this protocol:
1. Read `PROGRESS.md` from the repository's default branch first.
2. Inspect recent commits and any open PocketAI development pull requests/feature branches.
3. Determine the active development branch from the newest coherent hand-off information; do not assume `main` is the work branch.
4. Inspect the actual diff/source before trusting a summary from another model.
5. Continue the recorded immediate next step unless it is blocked, unsafe, conflicts with newer code, or requires an owner decision.
6. Never restart completed work merely because a different AI model is taking over.
7. Before stopping, leave the repository in a coherent state and update this file so the next model can resume without asking the owner to reconstruct context.

If `PROGRESS.md`, branch state, and actual code disagree, **the repository code and newest valid commits win**. Update this file to reconcile the discrepancy before continuing substantial work.

## Abrupt-Stop / Usage-Limit Recovery
Development must remain recoverable even if an AI session ends unexpectedly because of a usage limit, disconnect, tool failure, crash, or other interruption before a normal hand-off can be written.

During any substantive development session:
1. Create or resume the correct feature branch before making meaningful changes.
2. Commit small, coherent milestones frequently enough that another model can recover from GitHub without depending on the prior chat session.
3. Do not wait until the end of a long session to make the first useful commit.
4. For longer sessions, refresh `PROGRESS.md` or another clearly referenced hand-off note at natural checkpoints when practical, rather than relying only on a final end-of-session update.
5. Treat uncommitted or unpushed workspace changes as non-transferable. Another AI may not be able to see them, so important progress should reach GitHub promptly after it becomes coherent.

If an incoming model suspects the previous session ended abruptly:
1. Do not assume `PROGRESS.md` is fully current.
2. Inspect the newest commits, active feature branches, open pull requests, and diffs first.
3. Prefer the newest coherent repository state over an older hand-off summary.
4. Identify the last completed checkpoint and continue from there; do not reconstruct or redo work that is already present in GitHub.
5. If partial or contradictory changes make the intended next step unclear, stop and ask the owner rather than guessing.

Goal: after each meaningful checkpoint, the repository itself should contain enough information for a different AI model to resume safely even if the prior model disappeared without warning.

## Session Metadata
- Last Active Model: Codex
- Last Updated: 2026-10-01
- Canonical Hand-Off Location: `PROGRESS.md` on the default branch (`main`)
- Active Development Branch: `codex/cross-platform-foundation`
- Status: MAC OLLAMA CHAT AND NETWORK-RESTRICTED INFERENCE VERIFIED; READY FOR OWNER TESTING; APPLE V1 PRESERVED AT `395d298`
- Active Milestone: Version 1 - Cross-platform Chat

The actual Git branch HEAD is the authoritative latest commit. Do not hard-code a commit hash here as the permanent source of truth because updating this file creates another commit.

## Product Purpose and Scope
PocketAI is a private personal AI system for one owner only. It is not intended for App Store distribution, public users, or commercial SaaS operation.

Do not add public-product infrastructure unless the owner explicitly changes this requirement. Avoid unnecessary multi-user systems, customer billing, public onboarding, analytics, or public-scale architecture.

Privacy and security remain important. Prefer local/private behavior where practical. Network or server use should be intentional and visible.

### Version Roadmap
- V1 - Chat: finish a strong, usable personal chat assistant. This is the active milestone.
- V2 - Voice OR image generation: choose after V1 based on usefulness and available technology.
- V3 - Add whichever of voice/image was not selected for V2.
- V4 - Expansion: reassess desired features after real use.

Scope guard: do not expand image generation or voice chat during V1 unless required for compatibility or explicitly requested by the owner.

## Cross-Platform Requirement
NhomeAI must not be Apple-only. The primary product must support iPhone/iPad, Android, macOS, Windows, and Linux without requiring an Apple Developer Program subscription or recurring seven-day iOS re-signing. Apple Foundation Models and MLX may remain optional adapters, but cannot be required by the core product. The primary client direction is an installable PWA/web client with portable state and provider-neutral AI interfaces. See `docs/CROSS-PLATFORM-ARCHITECTURE.md`.

## Long-Term Architecture
Target direction:

`PocketAI client -> routing layer -> local engine OR private remote/server engine`

Design assumptions:
- iPhone, Mac, and other laptops may act as clients.
- Lightweight chat and personal-memory work should remain local when practical.
- Heavy work may later route to a VPS/private backend.
- The VPS should eventually be replaceable with the owner's physical AI server without rebuilding the client.
- Persistent personal memory is a core requirement.
- Remote/provider-specific details should stay behind stable interfaces so servers/providers can change later.

## Current Source State
Repository inspection shows substantial reusable V1 groundwork:
- SwiftUI app/project structure with app and test targets.
- `ChatEngine` abstraction for interchangeable chat backends.
- `AppleChatEngine` using Apple's on-device language-model APIs.
- `MLXChatEngine` for downloadable/local MLX models.
- Streaming responses, cancellation, bounded context, and engine status handling.
- Local conversation and memory persistence through app-owned JSON state.
- Downloadable model library with disk-space guard, staging, cancellation, pinned revisions, and integrity verification.
- Local model switching/loading infrastructure.
- Image storage groundwork exists, but image generation is not a V1 priority.
- XCTest source exists for model-library and persistence behavior.
- Build/test documentation and project-generation scripts are present.

IMPORTANT: implemented in source does not mean device-verified. Compilation, package resolution, XCTest execution, real-device behavior, offline execution, MLX performance, memory pressure, and thermal behavior still require Mac/iPhone validation unless later recorded as completed.

## Work Currently In Progress
The primary PWA has selectable provider-neutral local runtimes: Ollama with Qwen3.5 4B Q4_K_M for desktop, and WebLLM/WebGPU with Llama 3.2 1B for mobile/browser use. The M5/16 GB Mac has Ollama 0.35.0 and verified model weights installed in ignored `.local-ai/`. All 17 tests (including real Ollama inference) and the production build pass. The cached in-app browser generated and recalled `8531`, persisted history after reload, isolated a new chat, and passed Stop/retry with the web server stopped and Ollama's external networking blocked. See `docs/MAC-LOCAL-AI.md` for exact setup, digest, measurements and limits.

The previous real WebLLM Mac smoke test remains valid, and Swift/Apple V1 remains unchanged. No paid service or remote inference is enabled. These Mac results do not establish physical-iPhone behavior, cache survival after eviction, or sustained battery/thermal performance.

## Immediate Next Steps for Incoming Model
1. Read this file and the architecture/Mac-local notes; inspect actual branch HEAD/source. Continue `codex/cross-platform-foundation`. Do not merge `main` without owner instruction.
2. Owner can personally test now at `http://127.0.0.1:4173`. If services stopped, run `scripts/start-local-ai.sh` and `scripts/start-mac-chat.sh` in separate terminals. Runtime/weights/dependencies/build already exist on this Mac; no download is needed. Prefer the same browser/origin for existing conversations.
3. Complete owner Safari/Chrome Wi-Fi-disconnected chat, relaunch/Mac-restart, keyboard/accessibility, memory pressure, latency/battery/thermal acceptance. Daemon auto-start/native packaging is not implemented.
4. Preserve phone acceptance as separate work: trusted HTTPS, actual WebGPU compatibility, download/streaming/context/Stop/persistence, Safari/Home Screen offline lifecycle, background/GPU-loss, memory/battery/thermals, and accessibility per `docs/LOCAL-AI-CHAT.md`.
5. Swift-state import, memory-note editing, model selection within each runtime and trusted LAN support remain future work. Runtime selection between Ollama and WebLLM is implemented. Do not add voice/image/remote features during local-chat acceptance.
6. Preserve Swift/Apple V1 and its recorded simulator gate. Do not purchase or enable paid services.
7. Update this hand-off and commit coherent development changes. Automatic approval review rejected the attempted development-branch push because external transfer was not explicitly authorized and the remote unverified. No push occurred; obtain owner authorization before retrying. The no-main-merge instruction remains in force.

## Architectural Decisions and Guardrails
- Single-user/private: optimize for one owner, not a public product.
- V1 is chat only: voice and image-generation feature development are deferred.
- Local-first where practical: remote use should be intentional.
- Hybrid-ready: keep local and remote engines behind stable interfaces.
- Server replaceability: avoid client dependence on one VPS vendor or inference provider.
- Persistent memory: preserve and evolve the existing app-owned memory/persistence layer.
- No unapproved spending: paid services require explicit owner approval.
- Preserve working code: do not restart PocketAI merely because another architecture is possible.
- Source vs. verified: distinguish code that exists from behavior proven by builds/tests/devices.
- Cross-model continuity: any incoming AI model should continue the same project history rather than create provider- or model-specific forks unless a deliberate experiment requires one.
- Model neutrality: the workflow applies equally to current and future AI assistants; naming a model in session history records who worked last but does not grant special status or create a separate workflow.
- Crash recoverability: meaningful progress should be committed to GitHub in small coherent checkpoints so an abrupt session end does not strand important work in one model's temporary workspace.

## Validation Status
### Present in source
- Project structure
- Chat abstractions
- Apple local chat adapter
- MLX local chat adapter
- Persistence/memory source
- Model download/integrity source
- XCTest source

### Mac / Xcode Validation Queue
Mark PASS/FAIL only after actual execution:
- [x] Resolve Swift packages in Xcode (pinned products resolved).
- [x] Compile the PocketAI app target for iOS Simulator.
- [x] Compile and run the XCTest suite (19 passed, including real Apple-model streaming/context/persistence).
- [x] Manual simulator chat acceptance: owner verified launch, new conversation, local AI response, and follow-up recall of `7429` on iPhone 18 Pro.
- [ ] Inspect remaining primary screens and physical-device keyboard/accessibility layouts.
- [ ] Verify conversation/memory persistence across relaunch.
- [ ] Test Apple on-device chat availability, streaming, and cancellation where supported.
- [ ] Test MLX model download, verification, load, generation, cancellation, and deletion.
- [ ] Verify real offline chat after required model assets are installed.
- [ ] Measure practical memory, thermal, and performance behavior on the target iPhone.

### Quick Repository References
- Roadmap: `docs/ROADMAP.md`
- Build/test notes: `docs/BUILD-AND-TEST.md`
- Core chat: `PocketAI/ChatEngine.swift`
- MLX chat: `PocketAI/MLXChatEngine.swift`
- App state/orchestration: `PocketAI/AppStore.swift`
- Persistence models: `PocketAI/Models.swift`
- Local model management: `PocketAI/ModelLibrary.swift`

## Current Blockers / Owner Decisions Needed
Physical-iPhone hardware and a trusted HTTPS app origin are needed for device acceptance. No production site was deployed during this milestone. WebGPU presence alone does not guarantee model GPU capability or sufficient iPhone memory. Mac Ollama network-restricted inference and cached-shell relaunch are verified; physical-phone offline inference and cache eviction/restart survival remain unverified. The historical Apple/MLX physical-device acceptance queue remains pending and separate from the primary PWA milestone.

## Mandatory End-of-Session Hand-Off
Before another model takes over or a development session ends:
1. Stop at the smallest coherent development milestone possible.
2. Inspect the diff for accidental or unrelated changes.
3. Run every test/build actually available in the current environment. Never report a test as passed if it was not run.
4. Make small, descriptive commits on the feature branch.
5. Update this file with model/date, active branch/status, exact work completed, materially changed files, validation actually performed and results, unfinished work, blockers, exact next steps, and any Mac/Xcode/device validation required.
6. Ensure the canonical `PROGRESS.md` on `main` is updated through the normal merge/PR workflow at an appropriate stopping point so the next model can discover it immediately.
7. The incoming model reads this file and independently inspects the latest commit/diff before continuing.

If the session ends before these steps can be completed, the Abrupt-Stop / Usage-Limit Recovery rules above take precedence for the next model.

### Recommended Incoming-Model Prompt
> Continue build. Read `PROGRESS.md` from `main` first, inspect the newest commits and active development PR/branch, then continue the recorded PocketAI V1 task from the actual repository state. Preserve the documented architecture and scope. Do not restart completed work, work directly on `main` for unfinished features, make spending decisions, or report builds/tests/device behavior as verified unless they were actually run. If the prior session appears to have ended abruptly, reconstruct the latest safe checkpoint from GitHub before continuing.

## Session Log
### 2026-10-01 - Codex completed Mac offline chat acceptance
- Finished Qwen3.5 4B Q4_K_M download after DNS interruption and conservative partial-file resume recovery; Ollama verified full SHA-256 integrity and wrote the manifest. Digest and installed byte size are recorded in `docs/MAC-LOCAL-AI.md`.
- Verified real production-provider inference under macOS `sandbox-exec` denying external outbound connections while permitting loopback. The same profile reached local Ollama and blocked an external IP that returned HTTP 301 normally. Cloud remains disabled.
- All 17 tests passed (15 unit + two real inference tests); verbose focused live run also passed. `7429` recall and Stop/recovery to `Cedar` passed. Recorded 2.223-second first text after weight unload/reload; 512-token browser reply measured 39.94 tokens/sec; Ollama reported 3.18 GB loaded-model GPU memory at context 4096, not total peak RAM.
- Cached Mac in-app-browser acceptance passed with preview server stopped: fresh reply and `8531` recall, history retained across reload, separate chat without prior number, Stop with partial reply, successful Retry. Close/reopen activates waiting app-cache updates.
- Added provider disposal on runtime switch; browser engine unloads and its worker terminates. Cleanup unit test passed. Desktop default excludes iPads using desktop user agents. Mac preview launcher works on a minimal PATH with bundled Node and installed Vite, without pnpm on PATH.
- Production build passed after final source changes; existing WebLLM bundle-size advisory only. Native Swift source and storage schema remain untouched. No main merge, paid service, LAN endpoint or GitHub push.
- Local logs/weights/runtime in `.local-ai/` are ignored and not committed. Remaining: owner preferred-browser Wi-Fi-off/relaunch/restart/accessibility/long-session memory/battery/thermal acceptance, plus separate cross-platform/device, state-import and memory-editing work. No setup blocker remains for Mac chat.

### 2026-10-01 - Codex Mac Ollama integration checkpoint
- Confirmed current branch and clean initial checkout; inspected portable `ChatProvider`, React UI, persistence/context, browser WebLLM provider and preserved Swift/MLX architecture before editing.
- Confirmed hardware: M5 MacBook Air, 16 GB RAM. Selected Ollama 0.35.0 with `qwen3.5:4b-q4_K_M` (about 3.4 GB weights), thinking disabled, context 4096, response cap 512, two-minute keep-alive.
- Added loopback-only provider and desktop/mobile runtime selection. No cloud fallback, automatic pull or LAN endpoint. Swift source and storage schema remain unchanged.
- Added ignored `.local-ai/` runtime/model storage, cloud-disabled loopback daemon script, production preview script, setup/acceptance notes and opt-in real-inference test.
- Validation: 14 unit tests passed; real-inference test deliberately skipped until weights exist; strict TypeScript/Vite production build passed with existing WebLLM chunk-size warning; shell syntax and diff whitespace checks passed.
- Browser verification reached the real daemon and correctly reported missing model weights. Fixed browser `fetch` binding discovered during this test.
- Runtime installed in `.local-ai/runtime/`; daemon reports Apple M5 Metal and cloud disabled. Model download remains in progress; do not claim working Qwen chat, measured throughput or disconnected-network acceptance yet.
- Runtime service session and preview run on loopback. Download log: `.local-ai/pull.log`; daemon log: `.local-ai/server.log`. Resume installation if interrupted using the pull command in `docs/MAC-LOCAL-AI.md`.
- Next: finish download, run `NHOMEAI_LIVE_TEST=1 pnpm test -- src/ollama-live.test.ts`, verify production UI reply/recall/Stop/retry/persistence, record model digest and practical resource measurements. Owner offline and thermal/battery acceptance remains required. No main merge.

### 2026-10-01 - Codex local browser AI chat
- Installed pinned `@mlc-ai/web-llm` 0.2.82 plus Vitest and React types; updated the pnpm lockfile. Added strict TypeScript checking to the production build.
- Replaced the placeholder with provider-neutral lifecycle/status interfaces and a WebLLM adapter. Default model is `Llama-3.2-1B-Instruct-q4f16_1-MLC`; dedicated worker handles on-device WebGPU inference. No Mac server or cloud inference API is used.
- Implemented explicit model loading with progress/error/retry UI, real streaming and persisted assistant messages, Stop and response retry, request serialization, bounded context reuse, and engine-history reset per request. UI chat switching is locked during generation.
- Added a build-generated versioned offline shell service worker, production registration, mobile safe-area/input/streamed-text styling, architecture update, and detailed runtime/device acceptance notes in `docs/LOCAL-AI-CHAT.md`.
- Validation: `pnpm run build` PASS (strict TypeScript, Vite 7.3.6, 34 modules, offline shell with 6 assets); `pnpm test` PASS (7 tests: model selection/loading deduplication, unsupported browser, load retry, streaming/context reset, cancellation/retry, concurrency, bounded UTF-8 context). Build reports expected large WebLLM runtime chunks (about 6 MB each for worker/main runtime); no build errors.
- Real Mac in-app-browser production-preview smoke test PASS: actual model download/load, response `7429.`, follow-up `You asked me to remember the number 7429.`, conversation retained across reload. No browser console errors/warnings were reported at model-ready inspection. This was real WebGPU inference, not the fake test runtime.
- Physical iPhone, Safari/Home Screen behavior, airplane-mode inference, cache survival, background/GPU-loss recovery, peak memory, performance/thermal/battery, and accessibility remain unverified. Automatic device-loss recovery/load cancellation, Swift-state import, and memory editing/model-picker UI are not implemented.
- Only `web/`, cross-platform docs, and this hand-off changed. Swift/Apple V1 remains intact; no main merge or paid service activation.

### 2026-10-01 - Codex cross-platform production build
- Fetched origin and checked out `codex/cross-platform-foundation`, tracking the remote branch; confirmed `395d298` is an ancestor.
- Read this hand-off and `docs/CROSS-PLATFORM-ARCHITECTURE.md` before changes.
- Installed `web/` dependencies with bundled Node/pnpm because Node/npm were absent from the shell PATH. Added `web/pnpm-lock.yaml` and explicit esbuild install-script approval in `web/pnpm-workspace.yaml`.
- Production validation: `pnpm run build` passed with Vite 7.3.6 (27 modules). No build errors or application-source fixes were required.
- Added ignore rules for web dependencies, production output, and the local pnpm store. Existing Swift/Apple V1 code is unchanged; no merge into `main` was performed.
- Browser/device runtime behavior remains unverified. Next development step is the first real local cross-platform chat provider/runtime and state migration/import; this session only validated the production build.

### 2026-10-01 - ChatGPT cross-platform migration
- Confirmed `boomersoonerjoe/My-AI-App` is the NhomeAI/PocketAI repository by locating known-good commit `395d298`.
- Created `codex/cross-platform-foundation` from that exact checkpoint; did not modify `main`.
- Added `web/` installable-PWA foundation with responsive chat UI, schema-v1 conversation/memory/image-draft types, local browser persistence, bounded context construction matching Swift V1 semantics, and a provider-neutral `ChatProvider` boundary.
- Added `docs/CROSS-PLATFORM-ARCHITECTURE.md`. Existing Swift/Xcode/Apple/MLX code remains intact as tested reference/optional adapter code.
- No paid service was connected. No Apple Developer membership is required by the target architecture.
- Validation: repository structure/source inspected; browser build has NOT yet been executed in this connector-only session. Next step is to run `npm install && npm run build` in `web/`, then implement the first real local cross-platform chat provider/runtime and state migration/import.

### 2026-09-30 - Codex / owner manual acceptance
- Resolved and compiled MLXLLM, MLXLMCommon, MLXHuggingFace, and Tokenizers at the existing pinned versions. Fixed the Debug app/package architecture mismatch with `ONLY_ACTIVE_ARCH = YES` and preserved it in the generator.
- Disabled chat save/send controls while model switching; rejected unsupported MLX simulator loading with an actionable error.
- Generic simulator build passed. All 19 XCTest cases passed on iPhone 18 Pro/iOS 27.0, including real Apple-model streaming, follow-up recall, and persistence when reopening the store.
- Owner manually passed on-screen V1 chat: launch, conversation creation, local response, remember `7429`, follow-up correctly answered `7429`. Treat this gate as complete; do not repeat it solely because Device Hub automation timed out.
- Updated build notes, roadmap, and canonical progress. No new features added. Physical-device/offline/Memory-note/relaunch/MLX/performance acceptance remains as listed above.
- Checkpointed session changes on `codex/v1-local-chat-validation` at the owner's request; no GitHub push, merge into `main`, or device signing/install was performed. Read the branch HEAD for the commit identity.

### 2026-09-13 - ChatGPT (GPT-5.6 Sol)
- Created and refined the PocketAI-specific hand-off framework for cross-model continuity.
- Replaced generic Node/JWT examples with PocketAI's actual architecture and V1 scope.
- Recorded the single-user/private requirement and V1 through V4 roadmap.
- Added an explicit `continue build` protocol so any incoming AI model follows the same continuation path.
- Made the hand-off workflow explicitly model-agnostic so future AI models do not need to be named in advance.
- Added abrupt-stop / usage-limit recovery rules so another model can recover from the latest coherent GitHub checkpoint if a session ends unexpectedly.
- Made `PROGRESS.md` on `main` the canonical discovery point while keeping unfinished development on feature branches.
- Recorded the distinction between source implementation and Mac/iPhone validation.
- Added hand-off, small-commit, no-main-feature-development, and no-unverified-test rules.
- Code behavior changed: No.
- Builds/tests run: None; documentation-only change.
