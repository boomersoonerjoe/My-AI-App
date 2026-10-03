import { useState } from 'react';
import type { MemoryNote } from './types';

export function MemoryPanel({ memories, disabled, onSave, onDelete }: {
  memories: MemoryNote[]; disabled: boolean;
  onSave(text: string, id?: string): void; onDelete(id: string): void;
}) {
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [limit, setLimit] = useState(50);
  const matches = memories.filter(note => note.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function cancel() { setEditing(undefined); setText(''); setError(''); }
  return <div className="memory-panel">
    <h2>Saved memories</h2>
    <p>Say “remember this: …” in chat or add a note here. Notes stay in this browser on this device and are available across chats. Only relevant notes are sent to your local AI. Use the same browser profile and app address after restarting; clearing site data removes saved notes.</p>
    <form onSubmit={event => {
      event.preventDefault(); setError(''); setNotice('');
      try { onSave(text, editing); setNotice(editing ? 'Memory updated.' : 'Memory saved.'); cancel(); }
      catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    }}>
      <label>{editing ? 'Edit memory' : 'New memory'}<textarea aria-label={editing ? 'Edit memory' : 'New memory'} value={text} disabled={disabled} onChange={event => setText(event.target.value)} placeholder="For example: My dog's name is Maple." /></label>
      <button disabled={disabled || !text.trim()}>{editing ? 'Save changes' : 'Save memory'}</button>
      {editing && <button type="button" disabled={disabled} onClick={cancel}>Cancel edit</button>}
    </form>
    <label>Find a memory <input aria-label="Find a memory" value={query} onChange={event => { setQuery(event.target.value); setLimit(50); }} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!memories.length && <p>No saved memories yet.</p>}
    {!!memories.length && !matches.length && <p>No matching memories.</p>}
    <ul className="memory-list">{matches.slice(0, limit).map((note, index) => <li key={note.id}>
      <p>{note.text}</p>
      <button aria-label={`Edit memory ${index + 1}`} disabled={disabled} onClick={() => { setEditing(note.id); setText(note.text); setError(''); setNotice(''); }}>Edit</button>
      <button aria-label={`Delete memory ${index + 1}`} disabled={disabled} onClick={() => {
        setError(''); setNotice('');
        try { onDelete(note.id); if (editing === note.id) cancel(); setNotice('Memory deleted.'); }
        catch (error) { setError(error instanceof Error ? error.message : String(error)); }
      }}>Delete</button>
    </li>)}</ul>
    {matches.length > limit && <button onClick={() => setLimit(limit + 50)}>Show more memories</button>}
  </div>;
}
