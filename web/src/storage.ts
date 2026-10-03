import {AppData,emptyData, type MemoryNote} from "./types";
export const STORAGE_KEY="nhomeai.state.v1";
export const MEMORY_STORAGE_KEY="nhomeai.memories.v1";
let memoryCache: { raw: string; notes: MemoryNote[] } | undefined;
function readMemories(raw: string): MemoryNote[] {
  if (memoryCache?.raw === raw) return memoryCache.notes;
  const parsed = JSON.parse(raw) as { schemaVersion: number; notes: MemoryNote[] };
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.notes) || parsed.notes.some(note => typeof note.id !== 'string' || typeof note.text !== 'string')) {
    throw new Error('Saved memory could not be opened. Its data has been left untouched.');
  }
  memoryCache = { raw, notes: parsed.notes }; return parsed.notes;
}
export function loadData():AppData {
  const raw=localStorage.getItem(STORAGE_KEY);
  const parsed=raw ? JSON.parse(raw) as AppData : emptyData();
  if(parsed.schemaVersion!==1) throw new Error("This data was saved by a newer NhomeAI version.");
  const memory = localStorage.getItem(MEMORY_STORAGE_KEY);
  return { ...parsed, memories: memory === null ? parsed.memories : readMemories(memory) };
}
export function saveData(data:AppData, options: { preserveMemories?: boolean } = {}) {
  // Streaming/chat writes from another open tab must not overwrite newer memory edits.
  const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
  const notes = options.preserveMemories ? raw === null ? loadData().memories : readMemories(raw) : data.memories;
  // Migrate the old schema's notes before removing their duplicate from chat storage.
  // Ordinary chat updates never rewrite or reparse the memory collection.
  if (!options.preserveMemories || raw === null) {
    const serialized = JSON.stringify({ schemaVersion: 1, notes });
    if (serialized !== raw) localStorage.setItem(MEMORY_STORAGE_KEY, serialized);
    memoryCache = { raw: serialized, notes };
  }
  const saved = { ...data, memories: notes };
  localStorage.setItem(STORAGE_KEY,JSON.stringify({ ...saved, memories: [] }));
  return saved;
}
