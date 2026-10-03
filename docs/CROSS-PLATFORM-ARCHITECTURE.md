> Optional location services now use a platform-neutral foreground adapter, manual/saved fallback, and standard browser Geolocation. See [location](LOCATION.md). No Apple API is required by the core.

> V1 is now local-first. See [local-first chat](LOCAL-FIRST-CHAT.md) for device clock, free optional retrieval, extractive local summaries, privacy and current Mac validation. Launch with `scripts/start-mac-chat.sh` for search; static Vite preview alone has no retrieval API.

# NhomeAI cross-platform architecture

## Product requirement
NhomeAI is a private, single-owner AI system. Its core product must work on iPhone/iPad, Android, macOS, Windows, and Linux without requiring an Apple Developer Program subscription or recurring iOS re-signing.

## Architecture
1. **Portable client:** `web/` is the primary cross-platform UI/PWA.
2. **Portable state:** conversations, memories, and image-draft concepts retain schema-v1 semantics from the tested Swift implementation.
3. **Provider boundary:** the client talks to a `ChatProvider`; UI/storage must not depend on Apple Foundation Models, MLX, or any cloud vendor.
4. **Local/private runtimes:** the browser provider runs Llama 3.2 1B Instruct 4-bit in a dedicated browser Web Worker through WebLLM/WebGPU, on the client device. Initial asset downloads are explicit and browser-cached. No Mac or cloud inference is required. A selectable desktop adapter runs Qwen3.5 4B Q4_K_M through loopback-only Ollama; see `docs/MAC-LOCAL-AI.md`. Desktop browsers initially select Ollama; mobile browsers select WebLLM. Future optional adapters may target a trusted LAN node or explicitly configured private backend. See `docs/LOCAL-AI-CHAT.md` for requirements and device acceptance.
5. **Apple adapter:** the existing Swift/Apple implementation remains preserved as tested reference code and may later serve as an optional Apple-native adapter. It is not the required NhomeAI client.
6. **Installability:** the web client is designed as a PWA so supported browsers can install it to the home screen/desktop without App Store distribution.

## Migration sequence
- Phase A: portable PWA shell, schema, persistence, prompt/context behavior, provider interface.
- Phase B: local WebLLM provider and streaming implemented; physical-iPhone model/runtime and offline acceptance pending.
- Phase C: import/migrate existing PocketAI state and validate chat/memory parity.
- Phase D: add optional LAN node discovery/configuration so phones can use stronger Mac/PC AI when desired.
- Phase E: image provider, then voice/video according to the product roadmap.

## Guardrails
- No paid service is added without owner approval.
- No platform-specific model is a required dependency.
- Local/private operation is preferred.
- Existing known-good Swift V1 is preserved until replacement behavior is validated.
