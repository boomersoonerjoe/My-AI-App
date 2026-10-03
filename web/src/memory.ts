import type { Conversation, MemoryNote } from './types';

export const MEMORY_BYTES = 1200;
const encoder = new TextEncoder();
export function validateMemory(text: string) {
  const value = text.trim();
  if (!value) throw new Error('Enter something to remember.');
  if (encoder.encode(value).length > MEMORY_BYTES) throw new Error('Keep each memory under 1,200 UTF-8 bytes.');
  return value;
}

// Only direct user commands can write memory. Model output and retrieved text cannot.
export function memoryCommand(text: string): string | undefined {
  if (/^(?:please\s+)?from now on\b/i.test(text.trim())) return text.trim().replace(/^please\s+/i, '');
  const input = text.trim().replace(/^(?:can|could|would|will) you (?:please )?(?=remember\s+(?:this|that)\b)/i, '');
  const match = input.match(/^(?:please\s+|(?:i want|i'd like) you to\s+)?(?:remember\b(?!\s+(?:when|how|what|why|whether)\b)|save\s+(?:this|that)\s+(?:as\s+(?:a\s+)?)?(?:memory|to\s+memory)\b|keep\s+(?:this|that)\s+in\s+mind\b)\s*([\s\S]*)$/i);
  if (!match) return undefined;
  return match[1].replace(/^(?:this|that)\b\s*/i, '').replace(/^(?:for\s+(?:future\s+(?:chats|conversations)|later)|about\s+me)\s*/i, '').replace(/^[:;,\-]\s*/, '').trim();
}

// Apply only the supported greeting preference, never arbitrary instructions in notes.
export function savedGreeting(memories: MemoryNote[]): string | undefined {
  for (const note of [...memories].reverse()) {
    const match = note.text.match(/\bgreet\s+me\s+with\s+["“]([^"”\n]{1,200})["”]/i);
    if (match && /\b(?:new|fresh)\s+(?:chat|conversation)|from now on/i.test(note.text)) return match[1];
  }
}

export function memoryConfirmation(conversation: Conversation, memories: MemoryNote[]): string | undefined {
  const question = conversation.messages.at(-1)?.text ?? '';
  if (!/\b(?:is|was)\s+(?:that|this|it)\s+(?:really\s+)?saved\b|\b(?:that|this|it)\s+is\s+(?:really\s+)?saved\b|\b(?:did|have)\s+you\s+(?:actually\s+)?save\b/i.test(question)) return undefined;
  const previous = conversation.messages.slice(0, -1).reverse().find(message => message.role === 'user' && memoryCommand(message.text) !== undefined);
  const value = previous ? memoryToSave({ ...conversation, messages: conversation.messages.slice(0, conversation.messages.indexOf(previous) + 1) }) : undefined;
  const saved = !!value && memories.some(note => note.text.trim().toLocaleLowerCase() === value.toLocaleLowerCase());
  return saved ? `Yes, it is saved in local memory: ${value}` : 'I cannot confirm that request is saved in local memory. Open Memory to check, or say “remember this:” followed by the information to save.';
}

export function memoryToSave(conversation: Conversation): string | undefined {
  const command = memoryCommand(conversation.messages.at(-1)?.text ?? '');
  if (command === undefined) return undefined;
  if (command) return validateMemory(command);
  // "Remember this" refers to the immediately preceding completed turn, never another chat.
  const previous = conversation.messages.slice(0, -1).reverse().find(message => message.text.trim());
  return previous ? validateMemory(previous.text) : '';
}

export function upsertMemory(memories: MemoryNote[], text: string, id?: string): MemoryNote[] {
  const value = validateMemory(text);
  if (id) {
    if (!memories.some(note => note.id === id)) throw new Error('This memory no longer exists.');
    return memories.map(note => note.id === id ? { ...note, text: value } : note);
  }
  // Retrying a saved command must not create duplicate notes.
  if (memories.some(note => note.text.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) return memories;
  return [...memories, { id: crypto.randomUUID(), text: value }];
}

const stopWords = new Set('a an and are as at be been can could did do does for from had has have how i if in is it its me my of on or our please remember saved say should so some tell that the their them then there these they this to us was were what when where which who why will with would you your again know information about'.split(' '));
const aliases: Record<string, string> = {
  favourite: 'favorite', colour: 'color', colours: 'color', colors: 'color',
  nickname: 'name', called: 'name', call: 'name', named: 'name', codename: 'codename',
  residence: 'live', reside: 'live', located: 'live', location: 'live', hometown: 'live',
  pets: 'pet', dog: 'pet', dogs: 'pet', cat: 'pet', cats: 'pet', turtle: 'pet',
  prefer: 'preference', prefers: 'preference', preferences: 'preference', preferred: 'preference',
  allergies: 'allergy', allergic: 'allergy', projects: 'project',
};
function terms(text: string): string[] {
  return [...new Set((text.toLocaleLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(word => !stopWords.has(word)).flatMap(word => aliases[word] ? [word, aliases[word]] : [word]))];
}
interface Index { postings: Map<string, Map<number, number>>; lengths: number[]; average: number }
const indexes = new WeakMap<MemoryNote[], Index>();
function indexFor(memories: MemoryNote[]): Index {
  const cached = indexes.get(memories); if (cached) return cached;
  const postings = new Map<string, Map<number, number>>();
  const lengths = memories.map((note, index) => {
    const words = terms(note.text);
    for (const word of words) {
      const list = postings.get(word) ?? new Map<number, number>();
      list.set(index, 1); postings.set(word, list);
    }
    return Math.max(1, words.length);
  });
  const value = { postings, lengths, average: lengths.reduce((a, b) => a + b, 0) / Math.max(1, memories.length) };
  indexes.set(memories, value); return value;
}

// Local inverted index: scoring visits matching postings, not every note on each reply.
// The index is rebuilt only after a memory edit/reload, with no network or embedding runtime.
export function relevantMemories(conversation: Conversation, memories: MemoryNote[]): MemoryNote[] {
  const question = conversation.messages.at(-1)?.text ?? '';
  let query = terms(question);
  if (!query.length && /\b(it|that|again)\b/i.test(question)) {
    query = terms(conversation.messages.slice(0, -1).filter(message => message.role === 'user').slice(-2).map(message => message.text).join(' '));
  }
  // Numbers in ordinary arithmetic/date questions are not a personal-memory lookup.
  // Keep them for explicit recall; otherwise require a matching descriptive term.
  if (!/\b(my|our|remember|saved|memory|me)\b/i.test(question)) query = query.filter(word => /\p{L}/u.test(word));
  const index = indexFor(memories); const scores = new Map<number, number>();
  for (const word of query) {
    const matches = index.postings.get(word); if (!matches) continue;
    const idf = Math.log(1 + (memories.length - matches.size + .5) / (matches.size + .5));
    for (const [i, frequency] of matches) {
      const score = idf * frequency * 2.2 / (frequency + 1.2 * (.25 + .75 * index.lengths[i] / index.average));
      scores.set(i, (scores.get(i) ?? 0) + score);
    }
  }
  // Explicit requests to list memory get a bounded recent selection, never the entire database.
  const candidates = /\b(?:what do you remember|list (?:my |saved )?memor|what have you saved)\b/i.test(question) && !scores.size
    ? memories.map((_, i) => i).reverse().slice(0, 5)
    : [...scores].sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([i]) => i);
  const selected: MemoryNote[] = []; let remaining = 2000;
  for (const i of candidates) {
    // Legacy notes can exceed the new note limit. Bound their prompt contribution too.
    let text = ''; let size = 0;
    for (const character of memories[i].text) {
      const bytes = encoder.encode(character).length;
      if (size + bytes > Math.min(MEMORY_BYTES, remaining - 1)) break;
      text += character; size += bytes;
    }
    if (text) { selected.push({ ...memories[i], text }); remaining -= size + 1; }
    if (selected.length >= 5 || remaining < 40) break;
  }
  return selected;
}
