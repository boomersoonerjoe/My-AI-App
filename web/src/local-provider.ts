import { planRetrieval } from './retrieval-plan';
import type { DeviceContext } from './device-context';
import { systemInstructions, inferencePrompt } from './inference-context';
import type { ChatProvider, ChatRequest, ProviderStatus } from './provider';
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm';

export const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
type Runtime = Pick<WebWorkerMLCEngine, 'chat' | 'resetChat' | 'interruptGenerate'> & { dispose?(): Promise<void> };
type RuntimeFactory = (model: string, report: (status: ProviderStatus) => void) => Promise<Runtime>;

async function createRuntime(model: string, report: (status: ProviderStatus) => void): Promise<Runtime> {
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
  const worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
  try {
    const engine = await CreateWebWorkerMLCEngine(worker, model, {
      initProgressCallback: ({ progress, text }) => report({ phase: 'loading', progress, message: text }),
    }, { context_window_size: 4096 });
    return Object.assign(engine, { dispose: async () => {
      try { await engine.unload(); } finally { worker.terminate(); }
    } });
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

export async function browserSupportsLocalAI(): Promise<boolean> {
  if (!globalThis.isSecureContext) return false;
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return !!gpu && !!(await gpu.requestAdapter());
}

export class LocalChatProvider implements ChatProvider {
  readonly id = 'webllm';
  readonly name = 'Llama 3.2 1B Instruct · 4-bit · on device';
  private runtime?: Runtime;
  private loading?: Promise<void>;
  private generating = false;
  constructor(
    readonly modelID = DEFAULT_MODEL_ID,
    private factory: RuntimeFactory = createRuntime,
    private check = browserSupportsLocalAI,
  ) {}
  isAvailable() { return this.check(); }
  async dispose() {
    const runtime = this.runtime;
    this.runtime = undefined;
    await runtime?.dispose?.();
  }
  async prepare(report: (status: ProviderStatus) => void): Promise<void> {
    if (this.runtime) { report({ phase: 'ready', message: 'Ready · inference stays on this device' }); return; }
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        if (!(await this.isAvailable())) throw new Error('Local AI needs HTTPS and a WebGPU-capable browser. On iPhone, use Safari on iOS 26 or later. No remote fallback is enabled.');
        report({ phase: 'loading', progress: 0, message: 'Loading model assets…' });
        this.runtime = await this.factory(this.modelID, report);
        report({ phase: 'ready', message: 'Ready · inference stays on this device' });
      } catch (error) {
        report({ phase: 'error', message: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally { this.loading = undefined; }
    })();
    return this.loading;
  }
  planRetrieval(question: string, device: DeviceContext, signal: AbortSignal) {
    return planRetrieval(this, question, device, signal);
  }
  async generate(request: ChatRequest, onUpdate: (text: string) => void, signal: AbortSignal): Promise<string> {
    if (!this.runtime) throw new Error('Load the local model first.');
    if (this.generating) throw new Error('A response is already running.');
    signal.throwIfAborted();
    this.generating = true;
    const engine = this.runtime;
    const stop = () => engine.interruptGenerate();
    signal.addEventListener('abort', stop, { once: true });
    try {
      // App-owned bounded context is authoritative; never leak engine history across chats.
      await engine.resetChat();
      signal.throwIfAborted();
      const chunks = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemInstructions(request) },
          { role: 'user', content: inferencePrompt(request,3000) },
        ], stream: true, max_tokens: 256, temperature: request.evidence || request.responseKind ? 0 : 0.6,
      });
      let text = '';
      for await (const chunk of chunks) {
        signal.throwIfAborted();
        text += chunk.choices[0]?.delta.content ?? '';
        onUpdate(text);
      }
      signal.throwIfAborted();
      return text;
    } finally {
      signal.removeEventListener('abort', stop);
      this.generating = false;
    }
  }
}
