# Local image integration — paused work

Saved September 10, 2026 at the user's request. Do not implement further until the user resumes.

## Existing partial implementation
`PocketAI/ImageRepository.swift` contains SavedImage metadata and an app-owned PNG/index repository. It validates the PNG signature, reads the existing index before changing files, writes PNG/index atomically with file protection, and removes a newly written PNG if index saving fails. Removal updates metadata first and performs best-effort PNG cleanup; failed cleanup can leave an orphan. This file is not included in the generated Xcode project, has not been syntax parsed or compiled, and has no tests yet. Preserve and review this source. The current Images UI still saves ideas only.

## Research already performed
Wrapper: https://github.com/drawthingsai/media-generation-kit
Latest main revision retrieved: `8868a9685d9c299816f43ef53efd455ffca437f0`.
Inspected main Package.swift points to draw-things-community revision `d473a2f148b3e7dc9b90d0b7cfccc5cda999eb66`. Verify Package.swift at the exact wrapper revision before adding a dependency. README examples referenced an older revision; do not blindly copy that pin.
Wrapper uses Swift 5.9, supports iOS 16, exposes MediaGenerationKit, and has LGPLv3 licensing. No image dependency has been added to Pocket AI yet.

Upstream source base:
https://github.com/drawthingsai/draw-things-community/tree/d473a2f148b3e7dc9b90d0b7cfccc5cda999eb66
Relevant paths under Libraries/MediaGenerationKit/Sources: MediaGenerationEnvironment.swift, MediaGenerationEnvironment+Ensure.swift, MediaGenerationPipeline.swift, ModelResolver.swift, ConfigurationResolver.swift, MediaGenerationExecutionSupport.swift, MediaGenerationExecutionUtilities.swift. Also Libraries/ModelZoo/Sources/ModelZoo.swift and Libraries/MediaGenerationKit/Resources/models.json.

Verified API findings:
- MediaGenerationEnvironment.default exposes externalUrls (process-wide ModelZoo setting) and maxTotalWeightsCacheSize.
- env.ensure(model, offline: Bool, stateHandler: ...) asynchronously resolves and ensures files, with resolving/verifying/downloading states and download byte counts. It supports hash verification, resumable downloads, and cancellation.
- CRITICAL: ensure(offline:true) only makes catalog resolution offline. Missing resources can STILL DOWNLOAD. Never use it as a network-free readiness check.
- resolveModel(model, offline:true) has sync and async overloads. inspectModel reports primary-file isDownloaded; it does not establish that all dependencies are ready.
- MediaGenerationPipeline.fromPretrained(model, backend: .local(directory: String?)) creates a local pipeline. Configuration includes width, height, steps, seed (UInt32), guidanceScale (Float), batchCount and batchSize.
- generate(prompt:negativePrompt:inputs:stateHandler:) asynchronously returns results. Result.write(to:type:.png) saves an output. States cover backend/model resolution, preparation, resources, encoding, generating(step:totalSteps:), decoding, postprocessing, completion and cancellation.
- Local Storage.generate invokes generateLocally directly, not ensure. Its cancellation bridge awaits completion. No cloud executor is used for .local.
- UNRESOLVED: local preparedStorage sets offline:false; the factory invokes ModelResolver and ConfigurationResolver. Inspect ConfigurationResolver next to establish whether a cold launch with built-in model ID can generate without catalog network access. Do not claim offline behavior is verified.

Candidate built-in model: Stable Diffusion v1.5, file sd_v1.5_f16.ckpt, SHA256 bf867591702e4c5d86cb126a3601d7e494180cce956b8dfaf90e5093d2e7c0f6. Dependencies from ModelZoo.filesToDownload: clip_vit_l14_f16.ckpt and vae_ft_mse_840000_f16.ckpt. File sizes have not been fetched. No weights have been downloaded and no phone performance has been measured.

## Next work when resumed
1. Inspect the existing source and resolve the offline factory question above; verify the wrapper revision before adding packages.
2. Implement a local image controller/engine with an explicit download action and truthful model readiness. Keep image models in an app-owned folder. Chat's cellular toggle does not automatically govern the SDK downloader; resolve this explicitly in implementation/UI.
3. Coordinate inference with AppStore: release the chat engine before image loading, prevent overlapping inference, and require explicit chat reloading afterward. Never silently use cloud.
4. Wire image generation, gallery, sharing and removal to ImageRepository. Preserve generated PNGs for retry on save failure.
5. Add focused persistence tests, update the project generator/dependencies, and statically validate source/project. Record that native compilation, XCTest, offline behavior and device performance remain unverified until Mac/iPhone validation.

## Constraints and continuity
Target recorded in the existing checkpoint: Joe's iPhone 17e, iOS 27. MacBook Air model/macOS unknown; Joe plans to provide About This Mac screenshot tonight. Do not request it again during source work. This Linux environment has no Xcode/Apple SDK. No native compilation, test execution, app installation, paid service, cloud provider, or GitHub repository has been established. Source work may continue before the screenshot.
Temporary upstream research files are not part of this checkpoint; retrieve exact pinned source URLs as needed. All completed 0.3 chat/model code remains in this archive.
