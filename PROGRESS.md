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

## Session Metadata
- Last Active Model: ChatGPT (GPT-5.6 Sol)
- Last Updated: 2026-09-13
- Canonical Hand-Off Location: `PROGRESS.md` on the default branch (`main`)
- Active Development Branch: determined per development session and recorded here when work begins
- Status: READY FOR V1 DEVELOPMENT
- Active Milestone: Version 1 - Chat

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
No V1 feature should be considered half-finished solely because of this hand-off setup. The hand-off framework is established; the next substantive work is Version 1 chat development on an appropriate feature branch.

Existing image-related source should remain intact unless a V1 chat change requires a compatibility fix.

## Immediate Next Steps for Incoming Model
1. Read this entire file before modifying code.
2. Inspect recent commits, open PRs/feature branches, repository tree, and `docs/ROADMAP.md`.
3. Choose or resume the appropriate feature branch. Never implement unfinished AI-generated feature work directly on `main`.
4. Establish the V1 chat baseline without redesigning working abstractions unnecessarily.
5. Prioritize chat reliability, persistence/memory, local-model handling, switching/streaming/cancellation/error states, and a provider-neutral hybrid/remote boundary.
6. Keep the existing `ChatEngine` seam unless concrete evidence shows it must change. Prefer adding a future remote engine/routing layer rather than coupling UI or persistence directly to a provider.
7. Do not connect paid services or make spending decisions without explicit owner approval.
8. When Mac/Xcode becomes necessary, stop at a clean commit and record the exact validation needed below.
9. At the end of every work session, update this file with completed work, unfinished work, validation status, blockers, active branch, and precise next steps.

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
5. Update this file with model/date, active branch/status, exact work completed, materially changed files, validation actually performed and results, unfinished work, blockers, exact next steps, and any Mac/Xcode/device validation required.
6. Ensure the canonical `PROGRESS.md` on `main` is updated through the normal merge/PR workflow at an appropriate stopping point so the next model can discover it immediately.
7. The incoming model reads this file and independently inspects the latest commit/diff before continuing.

### Recommended Incoming-Model Prompt
> Continue build. Read `PROGRESS.md` from `main` first, inspect the newest commits and active development PR/branch, then continue the recorded PocketAI V1 task from the actual repository state. Preserve the documented architecture and scope. Do not restart completed work, work directly on `main` for unfinished features, make spending decisions, or report builds/tests/device behavior as verified unless they were actually run.

## Session Log
### 2026-09-13 - ChatGPT (GPT-5.6 Sol)
- Created and refined the PocketAI-specific hand-off framework for cross-model continuity.
- Replaced generic Node/JWT examples with PocketAI's actual architecture and V1 scope.
- Recorded the single-user/private requirement and V1 through V4 roadmap.
- Added an explicit `continue build` protocol so any incoming AI model follows the same continuation path.
- Made the hand-off workflow explicitly model-agnostic so future AI models do not need to be named in advance.
- Made `PROGRESS.md` on `main` the canonical discovery point while keeping unfinished development on feature branches.
- Recorded the distinction between source implementation and Mac/iPhone validation.
- Added hand-off, small-commit, no-main-feature-development, and no-unverified-test rules.
- Code behavior changed: No.
- Builds/tests run: None; documentation-only change.
