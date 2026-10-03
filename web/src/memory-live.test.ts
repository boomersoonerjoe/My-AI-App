import { expect, it, vi } from 'vitest';
import { answerConversation } from './chat-service';
import { OllamaChatProvider } from './ollama-provider';
import { upsertMemory } from './memory';
import { loadData, saveData } from './storage';
import { emptyData, type Conversation } from './types';

const enabled = (globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.NHOMEAI_LIVE_TEST === '1';
const chat = (text: string): Conversation => ({ id: crypto.randomUUID(), title: 'Memory live test', messages: [{ id: crypto.randomUUID(), text, role: 'user', createdAt: '' }] });
it.skipIf(!enabled)('real Qwen recalls persisted memory in new chats, honors edits and does not recall a deleted note', async () => {
  const disk = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value) });
  try {
    const provider = new OllamaChatProvider(); await provider.prepare(() => {});
    const options = { mode: 'off' as const, signal: AbortSignal.timeout(120000), onUpdate() {}, onActivity() {}, search: async () => { throw new Error('Memory must stay offline'); } };
    saveData(emptyData());
    const first = await answerConversation(chat('Remember this: my fictional lighthouse is named Juniper Beacon 9376.'), [], provider, { ...options, saveMemory(text) {
      const data = loadData(); saveData({ ...data, memories: upsertMemory(data.memories, text) });
    } });
    expect(first.text).toContain('Saved to local memory');
    const reopened = loadData();
    const recall = await answerConversation(chat('What is my fictional lighthouse name and number?'), reopened.memories, provider, options);
    expect(recall.text).toContain('Juniper Beacon'); expect(recall.text).toContain('9376');
    saveData({ ...reopened, memories: upsertMemory(reopened.memories, 'My fictional lighthouse is named Aspen Signal 4821.', reopened.memories[0].id) });
    const edited = await answerConversation(chat('What is my fictional lighthouse name and number?'), loadData().memories, provider, options);
    expect(edited.text).toContain('Aspen Signal'); expect(edited.text).toContain('4821'); expect(edited.text).not.toContain('9376');
    saveData({ ...loadData(), memories: [] });
    const deleted = await answerConversation(chat('What is my fictional lighthouse name and number?'), loadData().memories, provider, options);
    expect(deleted.text).not.toMatch(/Juniper|Aspen|9376|4821/);
    console.log(JSON.stringify({ memorySaved: first.text, crossChatRecall: recall.text, editedRecall: edited.text, deletedRecall: deleted.text }));
  } finally { vi.unstubAllGlobals(); }
}, 240000);
