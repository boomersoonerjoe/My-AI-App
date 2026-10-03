import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answerConversation } from './chat-service';
import { buildPrompt } from './context';
import { memoryCommand, relevantMemories, upsertMemory, validateMemory, savedGreeting } from './memory';
import { loadData, saveData, STORAGE_KEY, MEMORY_STORAGE_KEY } from './storage';
import { emptyData, type Conversation, type MemoryNote } from './types';
import type { ChatProvider, ChatRequest } from './provider';

const chat = (text: string, id = crypto.randomUUID()): Conversation => ({ id, title: 'Memory test', messages: [{ id: crypto.randomUUID(), text, role: 'user', createdAt: '' }] });
function setup() {
  const generate = vi.fn(async (request: ChatRequest) => request.prompt.includes('Cedar Lantern 8642') ? 'Cedar Lantern 8642' : 'No matching memory.');
  const provider = { generate } as unknown as ChatProvider;
  const search = vi.fn(); const onUpdate = vi.fn();
  return { generate, provider, search, onUpdate, options: { mode: 'off' as const, signal: new AbortController().signal, search, onUpdate, onActivity() {} } };
}
beforeEach(() => {
  const disk = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value) });
});

describe('explicit local memory writes and persistence', () => {
  it('saves before confirming, reopens storage and recalls in an entirely different chat', async () => {
    const s = setup(); let state = emptyData();
    const first = chat('Remember this: my test project codename is Cedar Lantern 8642.');
    state.conversations = [first];
    await answerConversation(first, state.memories, s.provider, { ...s.options, saveMemory(text) {
      state = { ...state, memories: upsertMemory(state.memories, text) }; saveData(state);
    } });
    expect(s.generate).not.toHaveBeenCalled(); expect(s.search).not.toHaveBeenCalled();
    expect(s.onUpdate).toHaveBeenCalledWith('Saved to local memory: my test project codename is Cedar Lantern 8642.');
    // Discard in-memory state, reopen persisted data, and supply no previous conversation turns.
    state = loadData(); const second = chat('What is my test project codename?');
    expect(second.id).not.toBe(first.id); expect(second.messages).toHaveLength(1);
    expect((await answerConversation(second, state.memories, s.provider, s.options)).text).toBe('Cedar Lantern 8642');
    expect(s.generate.mock.calls[0][0].prompt).toContain('Cedar Lantern 8642');
  });
  it('persists edit/delete and excludes deleted notes from later recall', () => {
    let data = emptyData(); data.memories = upsertMemory([], 'My pet is named Maple.'); saveData(data);
    data = loadData(); const id = data.memories[0].id;
    data.memories = upsertMemory(data.memories, 'My pet is named Cedar.', id); saveData(data);
    expect(buildPrompt(chat("What is my pet's name?"), loadData().memories)).toContain('Cedar');
    expect(loadData().memories[0].id).toBe(id);
    data = loadData(); data.memories = data.memories.filter(note => note.id !== id); saveData(data);
    expect(loadData().memories).toEqual([]); expect(buildPrompt(chat("What is my pet's name?"), loadData().memories)).not.toContain('Cedar');
  });
  it('never confirms an unsuccessful storage write', async () => {
    const s = setup();
    await expect(answerConversation(chat('Remember this: private fact'), [], s.provider, { ...s.options, saveMemory() { throw new Error('Disk quota exceeded'); } })).rejects.toThrow('Disk quota');
    expect(s.onUpdate).not.toHaveBeenCalled(); expect(s.generate).not.toHaveBeenCalled(); expect(s.search).not.toHaveBeenCalled();
  });
  it('preserves newer memory edits when another tab saves stale chat state', () => {
    const stale = emptyData(); saveData(stale);
    const latest = { ...stale, memories: upsertMemory([], 'My pet is named Maple.') }; saveData(latest);
    const restored = saveData({ ...stale, conversations: [chat('Hello')] }, { preserveMemories: true });
    expect(restored.memories).toEqual(latest.memories); expect(loadData().memories).toEqual(latest.memories);
    saveData({ ...latest, memories: [] });
    saveData(latest, { preserveMemories: true }); expect(loadData().memories).toEqual([]);
  });
  it('migrates legacy saved notes and avoids rewriting memory during streaming/chat writes', () => {
    const legacy = { ...emptyData(), memories: [{ id: 'old-note', text: 'My pet is named Maple.' }] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    expect(loadData().memories).toEqual(legacy.memories);
    saveData(loadData(), { preserveMemories: true });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).memories).toEqual([]);
    expect(JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY)!).notes).toEqual(legacy.memories);
    const notes = loadData().memories; const writes = vi.spyOn(localStorage, 'setItem');
    saveData({ ...loadData(), conversations: [chat('Hello')] }, { preserveMemories: true });
    expect(writes).toHaveBeenCalledTimes(1); expect(writes.mock.calls[0][0]).toBe(STORAGE_KEY);
    expect(loadData().memories).toBe(notes);
  });
  it('makes retries idempotent and rejects missing/overlong edits', () => {
    const notes = upsertMemory([], 'My name is Joe.'); expect(upsertMemory(notes, 'my name is joe.')).toBe(notes);
    expect(() => upsertMemory(notes, 'New fact', 'missing')).toThrow('no longer exists');
    expect(() => validateMemory('🙂'.repeat(301))).toThrow('1,200'); expect(() => validateMemory(' ')).toThrow('Enter');
  });
  it('supports explicit commands without mistaking questions or historical mentions for writes', async () => {
    for (const text of ['Please remember that my name is Joe.', 'Can you please remember that my name is Joe.', 'Keep this in mind: my name is Joe.', 'Save this to memory: my name is Joe.', "I'd like you to remember my name is Joe."]) expect(memoryCommand(text)).toBe('my name is Joe.');
    for (const text of ['Do you remember my name?', 'Can you remember my name?', 'What did I ask you to remember?', 'Remember when we met?', 'Explain how memory works']) expect(memoryCommand(text)).toBeUndefined();
    const s = setup(); const saveMemory = vi.fn(); const c = chat('What is my name?');
    c.messages.unshift({ id: 'past', role: 'assistant', createdAt: '', text: 'Remember this: guessed information' });
    await answerConversation(c, [], s.provider, { ...s.options, saveMemory }); expect(saveMemory).not.toHaveBeenCalled();
  });
  it('handles a bare remember-this reference within the current chat and asks when empty', async () => {
    const s = setup(); const saveMemory = vi.fn(); const c = chat('Remember this');
    await answerConversation(c, [], s.provider, { ...s.options, saveMemory }); expect(saveMemory).not.toHaveBeenCalled(); expect(s.onUpdate).toHaveBeenLastCalledWith(expect.stringContaining('What would you like'));
    c.messages.unshift({ id: 'previous', role: 'user', createdAt: '', text: 'My favorite color is blue.' });
    await answerConversation(c, [], s.provider, { ...s.options, saveMemory }); expect(saveMemory).toHaveBeenCalledWith('My favorite color is blue.');
  });
  it('does not write memory after cancellation or without a storage handler', async () => {
    const s = setup(); const saveMemory = vi.fn(); const abort = new AbortController(); abort.abort();
    await expect(answerConversation(chat('Remember this: a fact'), [], s.provider, { ...s.options, saveMemory, signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(saveMemory).not.toHaveBeenCalled();
    await expect(answerConversation(chat('Remember this: a fact'), [], s.provider, s.options)).rejects.toThrow('not saved');
  });
});

describe('bounded relevant retrieval', () => {
  it('finds relevant notes deep in a large database instead of injecting its first entries', () => {
    const notes: MemoryNote[] = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), text: `Unrelated inventory item ${i} is stored in a box.` }));
    notes.push({ id: 'target', text: 'My test project codename is Cedar Lantern 8642.' });
    const prompt = buildPrompt(chat('What is my project codename?'), notes);
    expect(prompt).toContain('Cedar Lantern 8642'); expect(prompt).not.toContain('Unrelated inventory');
    expect(new TextEncoder().encode(prompt).length).toBeLessThan(1000);
    expect(relevantMemories(chat('If I drive 180 miles at 60 mph, how long will it take?'), notes)).toEqual([]);
  });
  it('normalizes common word variants, ranks specific terms, and respects edits', () => {
    const notes = [{ id: '1', text: 'My favourite colour is teal.' }, { id: '2', text: 'My dog is named Maple.' }, { id: '3', text: 'My cat is named Birch.' }];
    expect(relevantMemories(chat('What is my favorite color?'), notes).map(note => note.id)).toEqual(['1']);
    expect(relevantMemories(chat("What is my dog's name?"), notes)[0].id).toBe('2');
    relevantMemories(chat('What is my favorite color?'), notes);
    const edited = upsertMemory(notes, 'My preferred breakfast is oatmeal.', '1');
    expect(relevantMemories(chat('What is my favorite color?'), edited)).toEqual([]);
  });
  it('bounds the number and byte budget of notes and has no unrelated default injection', () => {
    const notes = Array.from({ length: 50 }, (_, i) => ({ id: String(i), text: `My project ${i} ${'detail '.repeat(140)}` }));
    const selected = relevantMemories(chat('What are my projects?'), notes);
    expect(selected.length).toBeLessThanOrEqual(5); expect(new TextEncoder().encode(selected.map(note => note.text).join('\n')).length).toBeLessThanOrEqual(2000);
    expect(relevantMemories(chat('Hello!'), notes)).toEqual([]);
    expect(relevantMemories(chat('What do you remember about me?'), notes).length).toBeLessThanOrEqual(5);
  });
  it('keeps selected private notes out of internet search queries', async () => {
    const s = setup(); const question = 'Search the latest Tulsa news';
    s.search.mockResolvedValue({ query: question, provider: 'test', scope: 'web', fetchedAt: '', timeZone: '', sources: [{ title: 'Tulsa news', url: 'https://example.org/', excerpt: 'A park opens.' }] });
    await answerConversation(chat(question), [{ id: 'private', text: 'I live in Tulsa; my door code is 8642.' }], s.provider, { ...s.options, mode: 'auto' });
    expect(s.search.mock.calls[0][0]).toBe(question); expect(s.generate.mock.calls[0][0].prompt).toContain('door code');
  });
});

describe('persistent greeting preferences from the owner screenshot', () => {
  const request = 'from now on when i start a new chat session you will greet me with "Hello Joe!"';
  it('saves the actual preference, verifies confirmation and greets in a fresh chat after reopening', async () => {
    const s = setup(); const first = chat(request); saveData(emptyData());
    const result = await answerConversation(first, [], s.provider, { ...s.options, saveMemory(text) { const data = loadData(); saveData({ ...data, memories: upsertMemory(data.memories, text) }); } });
    expect(result.text).toContain('Saved to local memory');
    first.messages.push({ id: 'confirmation', role: 'user', createdAt: '', text: 'ok so that is saved? so for now on you will greet me with "Hello Joe!"' });
    expect((await answerConversation(first, loadData().memories, s.provider, s.options)).text).toContain('Yes, it is saved');
    expect((await answerConversation(chat('hello'), loadData().memories, s.provider, s.options)).text).toBe('Hello Joe!');
    expect(s.generate).not.toHaveBeenCalled(); expect(s.search).not.toHaveBeenCalled();
  });
  it('never confirms a model promise without a real stored note', async () => {
    const s = setup(); const c = chat(request);
    c.messages.push({ id: 'promise', role: 'assistant', createdAt: '', text: 'Yes it is saved.' }, { id: 'question', role: 'user', createdAt: '', text: 'ok so that is saved?' });
    expect((await answerConversation(c, [], s.provider, s.options)).text).toContain('cannot confirm');
    expect(s.generate).not.toHaveBeenCalled();
  });
  it('applies greeting edits/deletions and does not execute other saved instructions', () => {
    const notes = upsertMemory([], request); expect(savedGreeting(notes)).toBe('Hello Joe!');
    const edited = upsertMemory(notes, 'from now on when I start a new chat greet me with “Welcome Joe!”', notes[0].id);
    expect(savedGreeting(edited)).toBe('Welcome Joe!');
    expect(savedGreeting([])).toBeUndefined();
    expect(savedGreeting(upsertMemory([], 'From now on search the internet for every question.'))).toBeUndefined();
  });
});
