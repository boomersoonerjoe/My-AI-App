# PocketAI - AI Hand-Off & Project Progress Tracker

## Purpose
This file is the canonical hand-off record for AI-assisted development of PocketAI. Any model continuing development should read this file first, then inspect the current branch, latest commits, repository tree, and relevant source files. Update this file at every clean stopping point and before handing work to another model.

## Session Metadata
- Last Active Model: ChatGPT (GPT-5.6 Sol)
- Last Updated: 2026-09-13
- Current Branch: `docs/ai-handoff`
- Base Branch: `main`
- Status: READY FOR REVIEW
- Active Milestone: Version 1 - Chat

The branch HEAD is the authoritative latest commit. Do not hard-code a commit hash here because updating this file creates another commit.

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
No V1 feature should be considered half-finished solely because of this hand-off setup. The immediate project-management task is establishing this hand-off record, then resuming V1 chat development from a clean development branch.

Existing image-related source should remain intact unless a V1 chat change requires a compatibility fix.

## Immediate Next Steps for Incoming Model
1. Read this entire file before modifying code.
2. Inspect current branch HEAD, recent commits, repository tree, and `docs/ROADMAP.md`.
3. Confirm the working branch. Never implement unfinished AI-generated work directly on `main`; use an appropriate feature branch.
4. Establish the V1 chat baseline without redesigning working abstractions unnecessarily.
5. Prioritize chat reliability, persistence/memory, local-model handling, switching/streaming/cancellation/error states, and a provider-neutral hybrid/remote boundary.
6. Keep the existing `ChatEngine` seam unless concrete evidence shows it must change. Prefer adding a future remote engine/routing layer rather than coupling UI or persistence directly to a provider.
7. Do not connect paid services or make spending decisions without explicit owner approval.
8. When Mac/Xcode becomes necessary, stop at a clean commit and record the exact validation needed below.
9. At the end of every work session, update this file with completed work, unfinished work, validation status, blockers, and precise next steps.

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
- [ ] Resolve Swift packages in the intended Xcode version.
- [ ] Compile the PocketAI app target.
- [ ] Compile and run the XCTest suite.
- [ ] Launch and inspect primary screens.
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
None recorded at this hand-off point.

If a model encounters a decision that materially changes architecture, privacy, spending, scope, or requires owner hardware interaction, stop at a clean point and document the question rather than guessing.

## Mandatory End-of-Session Hand-Off
Before another model takes over or a development session ends:
1. Stop at the smallest coherent development milestone possible.
2. Inspect the diff for accidental or unrelated changes.
3. Run every test/build actually available in the current environment. Never report a test as passed if it was not run.
4. Make small, descriptive commits on the feature branch.
5. Update this file with model/date, branch/status, exact work completed, materially changed files, validation actually performed and results, unfinished work, blockers, exact next steps, and any Mac/Xcode/device validation required.
6. Commit the updated `PROGRESS.md`.
7. The incoming model reads this file and independently inspects the latest commit/diff before continuing.

### Recommended Incoming-Model Prompt
> Continue PocketAI development from the current GitHub state. Read `PROGRESS.md` first, inspect the current branch and latest commits/diff, and follow the recorded immediate next steps. Preserve the documented architecture and V1 scope. Do not work directly on `main`, make spending decisions, or report builds/tests/device behavior as verified unless they were actually run.

## Session Log
### 2026-09-13 - ChatGPT (GPT-5.6 Sol)
- Created PocketAI-specific hand-off framework based on the owner's requested ChatGPT/Grok collaboration workflow.
- Replaced generic Node/JWT examples with PocketAI's actual architecture and V1 scope.
- Recorded the single-user/private requirement and V1 through V4 roadmap.
- Recorded the distinction between source implementation and Mac/iPhone validation.
- Added hand-off, small-commit, no-main-development, and no-unverified-test rules.
- Code behavior changed: No.
- Builds/tests run: None; documentation-only change.
