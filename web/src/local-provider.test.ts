import { describe, expect, it, vi } from 'vitest';
import { LocalChatProvider, DEFAULT_MODEL_ID } from './local-provider';
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm';
import { buildPrompt } from './context';
function fakeRuntime() {
  const resetChat = vi.fn(async () => {});
  const interruptGenerate = vi.fn();
  const create = vi.fn(async function* (_request: unknown) {
    yield { choices: [{ delta: { content: 'Hello' } }] };
    yield { choices: [{ delta: { content: ' world' } }] };
  });
  const runtime = { resetChat, interruptGenerate, chat: { completions: { create } } } as unknown as WebWorkerMLCEngine;
  return { runtime, create, resetChat, interruptGenerate };
}
describe('local provider', () => {
  it('loads the default 4-bit model once and streams with app-owned context', async () => {
    const fake = fakeRuntime();
    const factory = vi.fn(async (_model: string) => fake.runtime);
    const provider = new LocalChatProvider(undefined, factory, async () => true);
    await Promise.all([provider.prepare(vi.fn()), provider.prepare(vi.fn())]);
    await provider.prepare(vi.fn());
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory.mock.calls[0][0]).toBe(DEFAULT_MODEL_ID);
    const updates: string[] = [];
    expect(await provider.generate({ prompt: 'Remember 7429' }, text => updates.push(text), new AbortController().signal)).toBe('Hello world');
    expect(updates).toEqual(['Hello', 'Hello world']);
    await provider.generate({ prompt: 'Different conversation' }, vi.fn(), new AbortController().signal);
    expect(fake.resetChat).toHaveBeenCalledTimes(2);
    expect(fake.create.mock.calls[0][0]).toMatchObject({ stream: true, max_tokens: 256, messages: [{ role: 'system' }, { role: 'user', content: 'Remember 7429' }] });
  });
  it('disposes a loaded runtime when the UI switches providers', async () => {
    const fake = fakeRuntime();
    const dispose = vi.fn(async () => {});
    const provider = new LocalChatProvider(undefined, async () => Object.assign(fake.runtime, { dispose }), async () => true);
    await provider.prepare(vi.fn());
    await provider.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(provider.generate({ prompt: 'test' }, vi.fn(), new AbortController().signal)).rejects.toThrow('Load');
  });
  it('rejects unsupported browsers without loading any runtime', async () => {
    const factory = vi.fn();
    const provider = new LocalChatProvider(undefined, factory, async () => false);
    const report = vi.fn();
    await expect(provider.prepare(report)).rejects.toThrow('HTTPS');
    expect(factory).not.toHaveBeenCalled();
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error' }));
  });
  it('allows retry after a failed load', async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error('Network failed')).mockResolvedValue(fakeRuntime().runtime);
    const provider = new LocalChatProvider(undefined, factory, async () => true);
    await expect(provider.prepare(vi.fn())).rejects.toThrow('Network failed');
    await provider.prepare(vi.fn());
    expect(factory).toHaveBeenCalledTimes(2);
  });
  it('interrupts cancellation, releases the busy guard, and supports retry', async () => {
    const fake = fakeRuntime();
    const provider = new LocalChatProvider(undefined, async () => fake.runtime, async () => true);
    await provider.prepare(vi.fn());
    const abort = new AbortController();
    await expect(provider.generate({ prompt: 'test' }, () => abort.abort(), abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fake.interruptGenerate).toHaveBeenCalledTimes(1);
    expect(await provider.generate({ prompt: 'retry' }, vi.fn(), new AbortController().signal)).toBe('Hello world');
  });
  it('rejects concurrent requests and requests before loading', async () => {
    const fake = fakeRuntime();
    const provider = new LocalChatProvider(undefined, async () => fake.runtime, async () => true);
    await expect(provider.generate({ prompt: 'test' }, vi.fn(), new AbortController().signal)).rejects.toThrow('Load');
    await provider.prepare(vi.fn());
    const first = provider.generate({ prompt: 'test' }, vi.fn(), new AbortController().signal);
    await expect(provider.generate({ prompt: 'test' }, vi.fn(), new AbortController().signal)).rejects.toThrow('already running');
    await first;
  });
});
describe('bounded portable context', () => {
  it('includes saved memories and conversation context for follow-up recall', () => {
    const prompt = buildPrompt({ id: 'c', title: 'test', messages: [
      { id: '1', text: 'Remember 7429', role: 'user', createdAt: '' },
      { id: '2', text: 'OK', role: 'assistant', createdAt: '' },
      { id: '3', text: 'What number and what is my name?', role: 'user', createdAt: '' },
    ] }, [{ id: 'm', text: 'My name is Joe' }]);
    expect(prompt).toContain('7429'); expect(prompt).toContain('My name is Joe'); expect(prompt).toContain('What number and what is my name?');
  });
  it('limits UTF-8 input size and excludes excessive old history', () => {
    const message = { id: '1', text: '🙂'.repeat(301), role: 'user' as const, createdAt: '' };
    expect(() => buildPrompt({ id: 'c', title: '', messages: [message] }, [])).toThrow('1,200');
    const old = 'old'.repeat(1000); const prompt = buildPrompt({ id: 'c', title: '', messages: [{ ...message, text: old }, { ...message, text: 'hello' }] }, []); expect(prompt).not.toContain(old); expect(new TextEncoder().encode(prompt).length).toBeLessThan(2400); expect(prompt).toContain('hello');
  });
});
