# Persistent local memory

The portable NhomeAI web/PWA app uses its existing saved-memory schema with a separate durable local browser store and selective retrieval. The iPhone Swift reference app is unchanged. Both portable local runtimes (Ollama and WebLLM) use the same memory/context layer.

## Use

- Say `Remember this: my dog's name is Maple.` or `Please remember that my favorite color is teal.` NhomeAI saves the note before acknowledging. No internet or loaded model is needed to save it.
- `Can you please remember that ...`, `Keep this in mind: ...`, and `Save this to memory: ...` also save. Questions such as `Do you remember my name?` remain ordinary local AI questions.
- A bare `Remember this` saves the immediately preceding message in the current chat. With no preceding message, the app asks what to save. For clarity, include the fact directly after the command.
- Start a completely new chat and ask a question about the saved fact. Relevant notes are supplied to the local AI even when no earlier conversation messages are present.
- Open **Memory** to add, find, view, edit, or delete notes. Each note is limited to 1,200 UTF-8 bytes; long information can be split into specific notes. Large lists render in batches of 50.
- Edit an existing note when a fact changes. Identical command retries do not duplicate notes. Deletion removes the note from long-term retrieval; existing chat messages containing that fact remain in their original conversations.

## Storage and privacy

`nhomeai.memories.v1` stores `{schemaVersion: 1, notes: MemoryNote[]}` in localStorage. `nhomeai.state.v1` retains chats and other app data. Existing inline schema-v1 memories remain readable and are migrated to the separate memory entry on the next save, before their duplicate is removed from chat state. No legacy notes are discarded or replaced with test data.

Ordinary chat/streaming writes do not rewrite the memory entry. Cached decoded notes retain their array identity, allowing the retrieval index to survive chat updates. Chat writes preserve the latest saved notes, even if another tab has added, edited, or deleted them; storage events refresh open tabs. Memory save errors are shown rather than falsely acknowledged. The feature has no cloud sync, external memory service, embedding download, or paid API. Selected notes are sent only to the chosen local AI; search queries contain the current question, never added saved notes/history.

Normal browser/app/Mac restarts retain localStorage in the same browser profile and origin. Use the same address, e.g. `http://127.0.0.1:4173/`; `localhost`, a different port, another browser/profile or a private session has different storage. Clearing site data removes notes. Browser storage quotas still apply; failed writes report errors. No browser-independent native database or backup/export is claimed by this implementation.

## Retrieval

A provider-neutral local inverted index uses normalized keywords, a small set of common aliases (e.g. colour/color, named/name, dog/pet), and document-frequency/length ranking. It is built once per loaded/edited note collection and visits matching postings for each question. Only up to five matching notes, with a total 2,000 UTF-8 byte budget, enter the prompt; each note contribution is also bounded. Ordinary unrelated questions receive no matching notes. A short referential follow-up can use the previous two user turns for matching. An explicit broad memory-list question gets a bounded recent selection; the Memory panel is the full list.

This is lexical retrieval with common variants, not unrestricted semantic embedding search. Strong paraphrases with no shared words/aliases may miss a note. Qwen still generates answers and can make mistakes; it is instructed to use provided saved user facts and to prioritize edited notes over conflicting older chat statements.

## Mac validation, 2026-10-02

- `pnpm --dir web test`: **64 unit/HTTP/persistence tests passed**, including save-before-acknowledgement, separate-chat recall, reopening stored state, edit/delete persistence, legacy migration, stale-tab write protection, no memory rewrites during chat updates, cancellation, failed saves, deduplication, private search-query boundaries, bounded prompts and relevant retrieval from **10,001 notes**. Opt-in live tests are skipped in this command.
- `web/tests/memory-process.test.mjs` compiles the production storage/memory/context modules into a temporary harness. One Node process saves a note to isolated disk-backed storage; another process reopens it and builds a matching new-chat prompt without prior chat/runtime state. This is a storage-process regression, not a full browser reboot simulation.
- Opt-in real Qwen3.5 4B Q4_K_M/Ollama memory test passed: new-chat recall of Juniper Beacon 9376, edited recall of Aspen Signal 4821, and no recall of either value after deleting the note. Search was disabled and would throw if invoked.
- Six targeted existing live regressions passed: capital of Oklahoma, 180 miles at 60 mph, Tulsa weather right now, the owner's Tulsa today forecast phrasing, cached Trump article/subject follow-ups, and a real NASA article followed up offline. Other opt-in live cases were not rerun for this change.
- Mac UI: saved the fictional lighthouse note without connecting a model; manually added a separate fictional color note; recalled the lighthouse in a new chat; edited the lighthouse and filtered/deleted the color note. After restarting the local app server and closing/reopening the app tab, a completely new chat with search **Off** answered: `Your fictional lighthouse name is Aspen Signal 4821.` The edited note remained visible in Memory, and the deleted color note stayed absent. Internet search was restored to Auto afterward.
- Production TypeScript/Vite build passed. Existing large WebLLM bundle warning remains. No dependency was added.

A full browser-process quit/relaunch, Mac reboot, and physical other-platform tests were not performed. The browser-tab reopening and actual local-server process restart are the tested UI restart scopes. No push or merge was performed.

## Greeting preference fix, 2026-10-02

The owner's natural request `from now on when i start a new chat session you will greet me with "Hello Joe!"` was previously handled as conversation without a real save; a model promise incorrectly claimed persistence. “From now on” requests now enter the explicit save path. Questions such as “ok so that is saved?” verify the prior request against actual stored notes and cannot confirm an unsaved model promise.

A quoted `greet me with "…"` preference for new chats is a supported application action. It supplies an immediate greeting on New chat and consistent hello/hi/hey replies. It uses the most recently stored matching note; editing or deleting notes changes future greeting behavior. Other saved text remains untrusted context, never arbitrary executable instructions. This narrowly implements greetings, not a general workflow automation engine.

67 unit/HTTP/persistence tests passed and the production build passed. The exact owner request, actual saved confirmation, separate-chat hello, greeting edits/deletion, and unbacked model promises have regression coverage. Mac UI verified Hello Joe! on a completely new chat after tab close/reopen with no model connected. Requests that were never saved by an older version need to be repeated once after refreshing the app; old model promises are not migrated into memory automatically.
