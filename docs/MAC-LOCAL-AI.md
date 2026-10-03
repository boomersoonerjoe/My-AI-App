> V1 is now local-first. See [local-first chat](LOCAL-FIRST-CHAT.md) for device clock, free optional retrieval, extractive local summaries, privacy and current Mac validation. Launch with `scripts/start-mac-chat.sh` for search; static Vite preview alone has no retrieval API.

# Mac local chat

## Architecture and selection

The primary NhomeAI client is the React/TypeScript PWA in `web/`. `ChatProvider` owns availability, preparation and streamed generation; schema-v1 storage and bounded prompt construction remain independent of inference. The existing Swift/Apple/MLX implementation is preserved reference code, not the required desktop client.

The runtime installed for this session is Ollama **0.35.0** from the official standalone macOS download. The Mac/PC provider is Ollama over `http://127.0.0.1:11434`, with **Qwen3.5 4B Q4_K_M**, exact tag `qwen3.5:4b-q4_K_M`. The publisher lists about 3.4 GB of weights. This is a practical starting balance for the confirmed M5 MacBook Air with 16 GB unified memory: more conversational capacity than the browser's 1B model while leaving room for the OS. It is a reasoned selection, not a measured comparison against every candidate. MLX is attractive for Apple-specific optimization but would add a native bridge to the portable client; Ollama provides a common local HTTP API on macOS, Windows and Linux. Larger 9B weights take about 6.6 GB before runtime/context overhead and are not the starting default for this fanless 16 GB Mac.

Requests disable thinking, cap context at 4096 tokens and output at 512 tokens, use temperature 0.6 and keep the model loaded for two minutes. A new message array is sent per request, so app-owned context is authoritative across chats. The existing 1200/500/700 UTF-8-byte prompt/history/memory limits still apply. Token streaming, Stop, retry, missing-model errors, truncated-stream errors and empty responses are supported. Stop aborts the HTTP request; resource release timing still needs real-device observation. Model loading happens on the first response; Connect only verifies the daemon and installed weights.

There is no cloud fallback, API key, automatic model pull or remote endpoint configuration. The supplied daemon script disables cloud features, binds only loopback and permits the local development/preview origins. Desktop browsers initially select Ollama; mobile browsers initially select WebLLM. The runtime selector retains both providers. A phone cannot use the Mac through this loopback adapter; trusted LAN support remains a separate milestone.

## Setup and launch

Downloaded runtime and weights belong to ignored `.local-ai/`, never Git. To install the standalone official macOS runtime manually:

```sh
mkdir -p .local-ai/runtime
curl -fL --retry 3 https://ollama.com/download/ollama-darwin.tgz -o /tmp/nhomeai-ollama.tgz
tar -xzf /tmp/nhomeai-ollama.tgz -C .local-ai/runtime
```

Alternatively install Ollama from https://ollama.com/download/mac; the daemon script falls back to an `ollama` on PATH. This setup intentionally stores models in the workspace rather than the global Ollama model library.

From the repository root, keep this running in one terminal:

```sh
./scripts/start-local-ai.sh
```

Download the model once in another terminal (internet required):

```sh
OLLAMA_HOST=127.0.0.1:11434 ./.local-ai/runtime/ollama pull qwen3.5:4b-q4_K_M
```

If using a system installation, replace the runtime path with `ollama`. Model installation is verified by Ollama. The tag is explicit but publisher tags can change on future pulls; record the installed digest from `/api/tags`. Do not pull again to use offline.

Build once with Node 22+ and pnpm:

```sh
cd web
pnpm install --frozen-lockfile
pnpm test
pnpm run build
cd ..
./scripts/start-mac-chat.sh
```

Open **http://127.0.0.1:4173**, select **Local Ollama (Mac / PC)**, press **Connect local Ollama**, start a new chat and send a message. The preview script uses installed Node or the Codex bundled Node fallback, and runs the already-installed Vite directly without requiring pnpm on the terminal PATH. No Xcode, signing or Apple Developer subscription is needed for this PWA.

Both the preview server and Ollama can run with internet disconnected after setup. Visit the production page once online/local to cache the app shell for PWA launch; cached assets alone do not start the daemon. Keep using the same browser and origin to retain conversations. This is a local web client, not a packaged macOS app or auto-start service.

## Validation

Unit tests run without Ollama. Real inference is an explicit opt-in:

```sh
cd web
NHOMEAI_LIVE_TEST=1 pnpm exec vitest run src/ollama-live.test.ts --reporter=verbose --silent=false
```

The live tests invoke the production provider, check streamed output and first-token timing, feed a bounded conversation prompt and verify recall of `7429`, then cancel a real response and verify a fresh request succeeds. It never pulls weights. After setup, personally verify browser permissions/CORS, Stop and retry, separate-chat isolation, conversation persistence after relaunch, and fresh generation with Wi-Fi disconnected. Safari/Chrome may ask permission to access a local service; allow loopback access for this local app. Benchmark sustained latency, memory, battery and thermals before expanding context/model size. No disconnected-network acceptance is inferred from unit tests.

## Network-restricted acceptance on macOS

Stop any existing Ollama daemon first, then run the same daemon with external outbound connections denied:

```sh
sandbox-exec -f scripts/local-ai-offline.sb ./scripts/start-local-ai.sh
```

Run the opt-in live tests in another terminal. This profile permits loopback requests and Metal inference while denying external network connections in Ollama and its child processes. A check against a normally reachable external IP verifies that the restriction actually takes effect. This does not alter Wi-Fi settings; owner testing with Wi-Fi disconnected remains useful for the browser/PWA lifecycle.

## Verified on this Mac — October 1, 2026

- Installed Ollama 0.35.0 and `qwen3.5:4b-q4_K_M`; model manifest digest `2a654d98e6fba55d452b7043684e9b57a947e393bbffa62485a7aac05ee4eefd`. Total installed model files: 3,389,983,735 bytes. Ollama confirmed full SHA-256 verification before writing the manifest. A DNS interruption required recovery of conservative resume offsets from the partial file; final integrity verification passed.
- All **17 tests passed**: 15 unit tests and two opt-in tests using the production Ollama provider and real weights. Real streaming and `7429` recall passed; abort after real output and a subsequent `Cedar` reply passed. A focused verbose run also passed both live tests.
- Strict TypeScript and Vite production build passed; six app-shell assets cached. Existing WebLLM bundles trigger a size advisory, not a build failure. Shell syntax and diff whitespace checks passed.
- With the preview server stopped and Ollama/child-process external networking blocked, the in-app browser reopened from cache, generated a real reply, recalled `8531`, and retained all turns after reload. A fresh chat correctly reported no previously supplied number. Browser Stop retained the partial reply and Retry completed successfully. Updated app caches activate when older tabs close; close/reopen the app after a build update.
- After explicitly unloading/reloading model weights, one short reply reached first text in **2.223 seconds** and finished in **2.761 seconds**, with 21 streamed updates. A later 512-token response measured **39.94 tokens/second** in the inference log. These are smoke-test samples, not a sustained benchmark or quality comparison.
- Ollama reported **3,179,576,032 bytes** (3.18 GB / 2.96 GiB) of loaded-model memory, all on GPU, with context 4096; the runner confirmed 34/34 model layers offloaded to Apple M5 Metal. This is not total app/process peak RAM. Sustained battery, thermal behavior, memory pressure and long-session performance remain unmeasured.
- Runtime selection preserves the browser provider, and switching away from it unloads its engine and terminates its worker; cleanup is unit-tested. No Swift files, schema migration, LAN inference or paid service were added.

Ready for owner testing: run the daemon and local preview scripts if needed, open `http://127.0.0.1:4173`, connect Ollama and chat. Installation/download is complete. Personally test with Wi-Fi disconnected in your preferred Safari/Chrome profile, including relaunch and Mac restart. The local daemon must run; browser cache can be evicted. Native macOS packaging/auto-start, memory editing, state import and phone/Windows/Linux acceptance remain separate work.

## Primary sources

- Model/quantization: https://ollama.com/library/qwen3.5:4b-q4_K_M
- Local API, thinking control and streaming: https://docs.ollama.com/api/chat
- Loopback binding, cloud disablement, origins, model storage and GPU inspection: https://docs.ollama.com/faq
