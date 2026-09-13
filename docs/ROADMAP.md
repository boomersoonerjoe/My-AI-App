# Execution sections

## 1. Native foundation — source prepared, Apple validation pending
SwiftUI Chat / Images / Memory / Settings; app-owned persisted state; migration from the first source checkpoint; visible storage errors; checked-in Xcode app/test targets and shared scheme. Gate: compile, run the XCTest suite, inspect screens on device, and verify relaunch persistence.

## 2. Local chat — Apple and downloadable adapters written, device validation pending
Use Apple's on-device model as an initial integration test, not as a permanent limit on the product. Included: status, streaming, one active generation, stop/retry, bounded history and memory, and response persistence. Gate: offline answer, follow-up, cancellation, and performance measurements on Joe's iPhone 17e.

MLX integration, a two-model catalog, explicit download/delete, disk-space guard, progress/cancel/retry, immutable revisions, SHA verification, and local-directory loading are implemented in source. Direct SDK versions are pinned. Phone testing and package resolution remain pending. Model downloading uses the internet; no paid inference provider is connected. Do not claim verified offline execution until measured on device. Avoid concurrently loading chat and image engines in the next section.

## 3. Local images — workspace prepared, engine pending
Embed the official MediaGenerationKit rather than relying on an unverified handoff to the installed Draw Things app. Choose and pin its SDK and a small compatible image model, implement generation/progress/cancel, atomic image saves and gallery metadata, then export/share. Start with one image at a modest resolution. Gate: generate a real image offline, save/reopen it, handle low storage and cancellation, and measure memory and thermal behavior. Model files from another app's sandbox are not automatically accessible.

## 4. Optional cloud — not connected
Explicit Local/Cloud choice, clear provider and model identity, secure credentials, per-job disclosure of transmitted content and estimated cost, tracked usage and enforceable provider/server spending controls. No silent paid fallback. Scope and limits must be defined before implementing a claim of a hard spending cap. Start with chat/image providers; evaluate video separately. No provider subscriptions or charges authorized by this source checkpoint.

## 5. Expanded assistant experience — planned
Voice, file/image attachments, richer memory retrieval and export/restore, image editing, longer tasks, video orchestration, and an independently verified supported connection to ChatGPT. Build each as a measurable feature with its own device limits. A local app is not automatically accessible from ChatGPT, and a UI resembling ChatGPT does not reproduce its proprietary model or cloud infrastructure.
