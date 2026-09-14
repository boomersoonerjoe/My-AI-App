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
- Last Active Model: Grok (Grok 4.6)
- Last Updated: 2026-09-13
- Canonical Hand-Off Location: `PROGRESS.md` on the default branch (`main`)
- Active Development Branch: `feature/v1-chat-baseline`
- Status: V1 CHAT BASELINE IN PROGRESS
- Active Milestone: Version 1 - Chat
- Open PR: https://github.com/boomersoonerjoe/My-AI-App/pull/4 (draft)

## Immediate Next Steps for Incoming Model
1. Resume `feature/v1-chat-baseline` / draft PR #4. Do not work unfinished features on `main`.
2. Commit regenerated `PocketAI.xcodeproj` after `python3 scripts/generate_project.py` so ChatRouter, ImageRepository, and ChatRouterTests are in target membership (still missing from the checked-in pbxproj).
3. Next code: chat UI reliability (retry after stop, clearer engine-not-ready Save vs Send) without voice/image generation.
4. Do not connect paid services.
5. Mac/Xcode validation remains the gate before claiming the app works on device.

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

## Work Currently In Progress
V1 chat baseline on `feature/v1-chat-baseline`. ChatRouter plus engine-switch persistence/error restore are in source. Image generation remains deferred.

## Architectural Decisions and Guardrails
- Single-user/private: optimize for one owner, not a public product.
- V1 is chat only: voice and image-generation feature development are deferred.
- Local-first where practical: remote use should be intentional.
- Hybrid-ready: keep local and remote engines behind stable interfaces.
- No unapproved spending: paid services require explicit owner approval.
- Source vs. verified: distinguish code that exists from behavior proven by builds/tests/devices.
- Failed local model load must not silently fall back to Apple or a paid/remote provider.

## Validation Status
### Present in source
- Project structure, ChatEngine, ChatRouter, Apple/MLX adapters, persistence, model library, XCTest source

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
- Routing: `PocketAI/ChatRouter.swift`
- App state: `PocketAI/AppStore.swift`
- Persistence: `PocketAI/Models.swift`
- Models: `PocketAI/ModelLibrary.swift`

## Current Blockers / Owner Decisions Needed
None. Mac/Xcode required before any validation box can be marked PASS/FAIL.

## Session Log
### 2026-09-13 - Grok (Grok 4.6) session 2
- Resumed `feature/v1-chat-baseline` and draft PR #4. `main` still `bc5e51be`.
- Failed/cancelled model load now restores via ChatRouter. No silent Apple/remote fallback.
- `forgetDeletedModel` clears `selectedModelID` after file delete.
- Regenerated pbxproj locally again; it was not pushed this session (file is large for this tool path). Next model should commit `python3 scripts/generate_project.py` output.
- Builds/tests run: None on Mac/Xcode.

### 2026-09-13 - Grok (Grok 4.6) session 1
- Created `feature/v1-chat-baseline`, ChatRouter, Settings route label, ChatRouterTests, draft PR #4.

### 2026-09-13 - ChatGPT (GPT-5.6 Sol)
- Established model-agnostic hand-off, abrupt-stop rules, V1 scope. Docs only.
