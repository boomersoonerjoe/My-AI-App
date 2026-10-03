> V1 is now local-first. See [local-first chat](LOCAL-FIRST-CHAT.md) for device clock, free optional retrieval, extractive local summaries, privacy and current Mac validation. Launch with `scripts/start-mac-chat.sh` for search; static Vite preview alone has no retrieval API.

# Local desktop chat

See [Mac local chat](MAC-LOCAL-AI.md) for the Ollama desktop adapter, setup and validation. The runtime selector preserves the browser provider described below.

# Local browser chat acceptance

## Implemented runtime

The browser PWA provider is WebLLM 0.2.82 with `Llama-3.2-1B-Instruct-q4f16_1-MLC` (4-bit weights). A dedicated module Web Worker executes WebGPU inference on the client device. No Mac inference service, API key, or cloud inference endpoint is used. `ChatProvider` keeps model/runtime details outside the UI and storage; the local adapter accepts a different model ID for future model changes.

Loading is explicit: tap **Load local model**. Initial model/config/tokenizer downloads use Hugging Face and the WebLLM model-library CDN; third parties see normal asset requests, not chat prompts. WebLLM manages the model cache. Browser storage can be evicted, so offline availability is conditional on retained assets. The app shell and bundled worker/runtime are separately cached by a generated service worker. There is no remote fallback.

The prebuilt f16 model needs working WebGPU and its required GPU capabilities, not just a WebGPU API object. WebLLM performs final capability checks during loading and surfaces failures. Its catalog estimates about 879 MB GPU memory at a 4096-token context; this is not a measured iPhone peak or guarantee. Browser overhead and compilation also need memory. Responses are capped at 256 tokens. Context remains app-owned and bounded by the existing UTF-8 prompt limits, and runtime chat state resets on every request.

## Run and validate

From `web/`, use Node 22+ with pnpm:

```
pnpm install
pnpm test
pnpm run build
pnpm run preview --host 127.0.0.1
```

Build includes strict TypeScript checking and generates `dist/sw.js` from the exact output assets. The service worker is enabled only for production. Deploy the entire `dist/` to an HTTPS origin. The current build assumes deployment at the origin root. Plain HTTP at a Mac's LAN IP is not a secure context on iPhone; localhost works only on the same device. Hosting static assets on a computer does not make inference depend on that computer after complete caching. No hosting service has been enabled by this implementation.

## Physical-iPhone acceptance (all pending)

1. Use Safari on iOS 26+ over trusted HTTPS. Record iPhone model, iOS/Safari version, storage availability, and whether Safari or installed Home Screen mode is being tested. Safari WebGPU support does not establish WebLLM model compatibility.
2. Load model on Wi-Fi. Record download/compile time, errors, memory pressure, and whether progress/keyboard/UI remain responsive. Retry after an interrupted download.
3. Start a chat, request a real response, then say “Remember 7429” and ask for that number. Start a separate chat and check there is no unrelated engine-history leakage.
4. Stop during generation; retry; send another message. Check double-send prevention, partial-response retention, and error recovery. Switching chats is disabled during generation.
5. Relaunch and confirm conversation persistence. Existing schema memory notes enter the prompt, but a memory-note editor and Swift-state import are not part of this milestone.
6. After successful load, close/reopen the installed PWA in airplane mode and generate a fresh response. Repeat after device restart. Verify both app-shell cache and WebLLM assets survive. Test Safari and Home Screen separately; their storage behavior may differ.
7. Test background/foreground and screen locking during load/generation; document browser suspension or GPU loss. If the GPU becomes unusable, reload the app and load the model again; automatic device-loss recovery and load cancellation are not yet implemented.
8. Measure time to first token, tokens/second, battery, thermal behavior, and sustained memory use. Check scrolling, safe areas, small-screen keyboard, VoiceOver, and long streamed messages.

## Primary references

- [WebLLM basic loading and streaming APIs](https://webllm.mlc.ai/docs/user/basic_usage.html)
- [WebLLM Web Worker runtime](https://webllm.mlc.ai/docs/user/advanced_usage.html)
- [Safari 26 WebGPU support](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#webgpu)
- [MLC 4-bit Llama model assets and license](https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC)
