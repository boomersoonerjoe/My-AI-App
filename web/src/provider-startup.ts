import type { ChatProvider, ProviderStatus } from './provider';

// Only Ollama is already installed/running; browser model downloads stay explicit.
export function connectOnStartup(provider: ChatProvider, report: (status: ProviderStatus) => void): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (provider.id !== 'ollama') return () => {};
  async function connect(attempt: number) {
    let failure: ProviderStatus | undefined;
    try {
      await provider.prepare(status => {
        if (cancelled) return;
        if (status.phase === 'error') failure = status;
        else report(status);
      });
    } catch {
      if (cancelled) return;
      if (attempt < 3) {
        report({ phase: 'loading', message: 'Waiting for local Ollama to start…' });
        timer = setTimeout(() => { void connect(attempt + 1); }, 2000);
      } else {
        report(failure ?? { phase: 'error', message: 'Local Ollama is unavailable. Start Ollama and retry the connection.' });
      }
    }
  }
  void connect(1);
  return () => { cancelled = true; clearTimeout(timer); };
}
