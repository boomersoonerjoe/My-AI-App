# Build and first device test

## Requirements
This is native iPhone source, not an installable IPA or web app. Use a Mac with Xcode. The project targets iOS 26 or later and uses Swift 5 language mode. The user's phone runs iOS 27; prefer its matching Xcode 27 toolchain for device validation.

On September 10, 2026 Apple's current matrix lists Xcode 27 RC with macOS Tahoe 26.6 or later and the iOS 27 SDK. Verify the latest compatible combination when installing:
https://developer.apple.com/xcode/system-requirements

Joe has an older MacBook Air from his mother, but its exact model/year and macOS version have not been recovered. Do not assume it can run this toolchain. Obtain its About This Mac details before prescribing an upgrade. A Chromebook cannot run native Xcode. A remote compatible Mac may be a later build option, but no paid service has been chosen or provisioned.

## Open and compile
1. Unzip this archive and open `PocketAI.xcodeproj` in Xcode.
2. Select the `PocketAI` scheme and an available iOS simulator. Build with Product > Build.
3. Run tests with Product > Test. These use test engines/transports and do not require model weights or an inference account. Xcode must first resolve the package dependencies using internet access.
4. For device installation, select the app target's Signing & Capabilities, choose your own development team/account, and replace `com.example.PocketAI` with a unique bundle identifier. Do not paste credentials into project source.
5. Select the attached or paired iPhone, follow Xcode's device setup instructions, and run. Apple may require Developer Mode and device trust. Signing and any account requirements must be resolved in Xcode; no install has been performed from this workspace.

A command-line helper is included:

```bash
./scripts/build_on_mac.sh
```

It builds for a generic simulator and lists available simulator UUIDs. To build and run XCTest, supply a UUID from that list:

```bash
./scripts/build_on_mac.sh YOUR_SIMULATOR_UUID
```

The checked-in project pins MLX Swift LM 3.31.3 and Swift Transformers 1.3.0. Transitive dependencies must be resolved by Xcode; no Package.resolved file has been fabricated. Review and allow the package macros through Xcode if prompted. The project needs no external project generator. If Swift files are added, regenerate project membership with Python 3:

```bash
python3 scripts/generate_project.py
```

Regeneration resets local project edits, including signing changes; do it before configuring signing or reapply those settings afterward.

## First physical-device acceptance gate
- Launch, create a conversation, add a memory, and save an image idea. Relaunch and verify all three persist.
- Inspect the local model status. Apple Intelligence must be available and its model ready; the app does not force downloads or silently use cloud.
- Ask for a short piece of writing, then ask a follow-up. Verify user and assistant roles render correctly and the answer persists after relaunch.
- Test Stop and backgrounding during a reply. Confirm the partial reply is not saved as completed, the user message remains, and retry works.
- Generate offline after the system model is ready. Record whether it completes, response time, and device temperature. This has not yet been tested on the user's phone.
- Test large accessibility text sizes, keyboard overlap, VoiceOver labels, dark mode, and long messages on the actual display.
- Record Xcode diagnostics, first-token latency, total response time, memory footprint, and whether the OS terminates the app. Use results to refine the offered downloadable models; do not infer capacity from model names alone.

## Data and engine limitations
- Model prompts receive only a limited excerpt of notes and recent messages. Full history remains stored but is not all sent to the model.
- Initial limits: 1,200 UTF-8 bytes for the current AI prompt, 500 for memory, 700 for complete recent messages, and a 512-token reply ceiling. These conservative guards are not exact tokenization. A longer draft can use Save only. Real device measurements should guide revisions.
- New model sessions avoid accumulating an unbounded model transcript. Older context is omitted, not summarized or magically remembered.
- Model errors are shown with retry available; there is no paid fallback.
- No web browsing, tools, cloud processing, or image inference is implemented in this build.
- Complete iOS file protection is used for app state. Device backup settings may include app data. Uninstalling the app can remove its data. No export/restore UI exists yet.
- A failed response save retains the response in memory until saved or discarded. It cannot survive app termination unless saving succeeds.
- Image generation requires a later compatible model, engine integration, and on-device acceptance test.

## Tests included but not executed here
Seventeen XCTest cases cover state round-trip, old message decoding, unsupported schema rejection, corrupted file preservation, failed save rollback, bounded context, oversized prompt handling, Unicode boundaries, cancellation/concurrent-generation prevention, and recovery of an unsaved generated response. The new cases cover manifest paths, pinned download URLs, SHA/Git-blob integrity, successful model install/delete, cancellation cleanup/retry, and rejecting bad downloaded bytes.

## Primary implementation references
- https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel
- https://developer.apple.com/documentation/foundationmodels/languagemodelsession
- https://developer.apple.com/documentation/foundationmodels/generationoptions
- https://developer.apple.com/documentation/foundationmodels/generating-content-and-performing-tasks-with-foundation-models
- https://github.com/ml-explore/mlx-swift-lm
- https://github.com/drawthingsai/media-generation-kit

The Apple documentation Markdown pages were retrieved directly to verify the current API. The generated source still requires Xcode type validation and runtime tests.

## Downloadable-model acceptance gate
- Settings > Chat model offers Qwen3 0.6B 4-bit (351,384,491 bytes) and Qwen3 1.7B 4-bit (984,014,117 bytes), plus the Apple system model. These are starter candidates, not verified phone capacity claims.
- Download only after pressing Download. Cellular access is off by default and can be enabled explicitly. The download uses fixed Hugging Face revisions; full SHA-256 or Git blob hashes are verified before installation.
- Verify progress, no-network error, cancellation, retry, insufficient storage, and deletion on device. Retry restarts the download; byte-range resume is not implemented. Backgrounding cancels downloads and model loading.
- Load the smaller model first, then disable networking and send a chat message. Confirm inference performs no network requests. The loader uses a local-directory overload and local tokenizer files.
- Switching drops the previous engine reference before loading the next. A failed load remains unavailable and never silently falls back to Apple or a cloud provider. SDK memory caches and actual memory reclamation still need device measurements.
- Downloaded weights are excluded from device backups by the app. Startup validates receipt/file sizes; selection performs full integrity verification again.
- After relaunch, a saved downloaded-model choice requires an explicit Load action. Model files remain present.
- Expected hashes come from the publisher metadata. Git SHA-1 entries are compatibility/integrity identifiers, not a separate publisher-signature system.
