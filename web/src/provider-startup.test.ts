import { afterEach, expect, it, vi } from 'vitest';
import { connectOnStartup } from './provider-startup';
import { OllamaChatProvider, MAC_MODEL } from './ollama-provider';
import type { ChatProvider } from './provider';

afterEach(() => vi.useRealTimers());
const tags = () => Response.json({ models: [{ name: MAC_MODEL }] });

it('connects an installed local service without a click and permits chat', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(tags()).mockResolvedValueOnce(new Response('{"message":{"content":"Ready"},"done":true}\n'));
  const provider = new OllamaChatProvider(fetcher);
  const report = vi.fn();
  connectOnStartup(provider, report);
  await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' })));
  expect(await provider.generate({ prompt: 'Hello' }, () => {}, new AbortController().signal)).toBe('Ready');
  expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/tags');
});

it('automatically recovers when the daemon starts shortly after the page', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(tags());
  const report = vi.fn();
  connectOnStartup(new OllamaChatProvider(fetcher), report);
  await vi.advanceTimersByTimeAsync(2000);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
});

it('bounds retries and retains the actionable missing-model error', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ models: [] }));
  const report = vi.fn();
  connectOnStartup(new OllamaChatProvider(fetcher), report);
  await vi.advanceTimersByTimeAsync(20000);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error', message: expect.stringContaining('ollama pull') }));
});

it('ignores pending results when the selected provider changes or the app unmounts', async () => {
  let resolve!: (response: Response) => void;
  const report = vi.fn();
  const stop = connectOnStartup(new OllamaChatProvider(() => new Promise(done => { resolve = done; })), report);
  stop(); report.mockClear(); resolve(tags());
  await new Promise(done => setTimeout(done, 0));
  expect(report).not.toHaveBeenCalled();
});

it('cancels scheduled retries and leaves WebGPU loading manual', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  const stop = connectOnStartup(new OllamaChatProvider(fetcher), vi.fn());
  await vi.advanceTimersByTimeAsync(0); stop();
  await vi.advanceTimersByTimeAsync(20000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const prepare = vi.fn();
  connectOnStartup({ id: 'webllm', prepare } as unknown as ChatProvider, vi.fn());
  expect(prepare).not.toHaveBeenCalled();
});
