import { expect, it, vi } from 'vitest';
import { replyPersistence } from './reply-persistence';
import { loadData, saveData } from './storage';
import { emptyData, type Conversation } from './types';

it('keeps cancelled/interrupted previews off disk, preserves the user turn on reopen and commits only the retry result', () => {
  const disk = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value) });
  try {
    const conversation: Conversation = { id:'test',title:'Story',messages:[{id:'q',role:'user',createdAt:'',text:'Write a story'}] };
    saveData({ ...emptyData(), conversations:[conversation] });
    let visible = conversation;
    const writer = replyPersistence(conversation, {id:'answer',role:'assistant',text:'',createdAt:''}, value => { visible=value; }, value => { saveData({...loadData(),conversations:[value]}); visible=value; });
    writer.preview('Incomplete fragment'); expect(visible.messages.at(-1)?.text).toBe('Incomplete fragment');
    expect(loadData().conversations[0].messages).toEqual(conversation.messages);
    writer.discard(); expect(visible).toEqual(conversation);
    expect(loadData().conversations[0].messages.at(-1)?.role).toBe('user');
    writer.preview('Retry in progress'); writer.complete('Completed retry');
    expect(loadData().conversations[0].messages.map(message => message.text)).toEqual(['Write a story','Completed retry']);
  } finally { vi.unstubAllGlobals(); }
});
