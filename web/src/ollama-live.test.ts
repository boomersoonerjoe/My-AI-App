import { expect, it } from 'vitest';
import { OllamaChatProvider } from './ollama-provider';
import { buildPrompt } from './context';

// Opt in only after the local daemon and weights are installed; never download in tests.
const enabled = (globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.NHOMEAI_LIVE_TEST === '1';
it.skipIf(!enabled)('streams real local inference and recalls app-owned context', async () => {
  const provider = new OllamaChatProvider();
  await provider.prepare(() => {});
  const updates: string[] = [];
  const started = performance.now();
  let firstTokenMs: number | undefined;
  const first = await provider.generate({ prompt: 'Remember the number 7429. Briefly acknowledge.' }, text => { firstTokenMs ??= performance.now() - started; updates.push(text); }, AbortSignal.timeout(120000));
  const firstResponseMs = performance.now() - started;
  expect(first.trim().length).toBeGreaterThan(0);
  expect(updates.length).toBeGreaterThan(0);
  const prompt = buildPrompt({ id: 'live', title: 'Live test', messages: [
    { id: '1', role: 'user', text: 'Remember the number 7429.', createdAt: '' },
    { id: '2', role: 'assistant', text: first, createdAt: '' },
    { id: '3', role: 'user', text: 'What number did I ask you to remember? Reply only with the number.', createdAt: '' },
  ] }, []);
  const recall = await provider.generate({ prompt }, () => {}, AbortSignal.timeout(120000));
  expect(recall).toContain('7429');
  console.log(JSON.stringify({ first, recall, streamingUpdates: updates.length, firstTokenMs, firstResponseMs }));
}, 240000);

it.skipIf(!enabled)('stops real inference and successfully generates a fresh request', async () => {
  const provider = new OllamaChatProvider();
  await provider.prepare(() => {});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    await expect(provider.generate({ prompt: 'Write a long story about a forest.' }, () => controller.abort(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  } finally { clearTimeout(timer); }
  const retry = await provider.generate({ prompt: 'Reply only with the word Cedar.' }, () => {}, AbortSignal.timeout(120000));
  expect(retry).toContain('Cedar');
  console.log(JSON.stringify({ cancellationAndRetry: retry }));
}, 240000);

it.skipIf(!enabled)('checks multi-step arithmetic with local reasoning rather than price search', async () => {
  const { answerConversation } = await import('./chat-service');
  const provider = new OllamaChatProvider(); await provider.prepare(() => {});
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await answerConversation({id:crypto.randomUUID(),title:'Arithmetic',messages:[{id:'q',role:'user',createdAt:'',text:'A store discounts a $120 item by 25%, then adds 10% sales tax. What is the final price? Explain briefly.'}]},[],provider,{mode:'auto',signal:AbortSignal.timeout(120000),onUpdate(){},onActivity(){},search:async()=>{throw new Error('Arithmetic must not search');}});
    expect(result.text).toMatch(/\$?99\b/); expect(result.text).not.toMatch(/\$93\b/);
    console.log(JSON.stringify({arithmeticAttempt:attempt+1,answer:result.text}));
  }
}, 240000);
