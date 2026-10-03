# Saved retrieval context — 2026-10-02

## Fix and investigation

The chat service previously returned evidence only when sources were requested. The normal answer therefore discarded retrieval data before the message was saved. The prompt builder also used only message text, with a 700-byte history budget, and did not reattach saved source evidence. Search retrieved headlines/snippets, not article bodies. Those were confirmed code defects.

The screenshot's Vance reference is a model-generated name substitution; no app code translates Trump into Vance. Missing evidence contributed to an unreliable follow-up path, but the screenshot alone cannot prove the model's precise internal cause or recover the original discarded source URL. The fix anchors references in the selected source title/text and gives those priority over a mistaken prior assistant name. Retrieved replies use temperature zero; ordinary local conversation keeps its existing sampling setting. This improves consistency, not a formal guarantee against every model error.

## Current behavior

- Every retrieved result is saved as optional evidence on its assistant message within the existing schema-v1 browser data, independent of whether source cards are visible.
- Article/story/source references reuse prior evidence. Generic follow-ups use the preceding reply; explicit article references can return to earlier retrieval across unrelated turns. Ordinary questions remain local. Explicit new searches still search normally.
- When needed, a follow-up reads the previously used public URL once, then saves the accessible text/status for subsequent turns. A supplied `Read this article: https://…` URL can also be read directly without web search.
- Saved evidence and article text survive reloads and support local follow-ups with search Off. Off does not fetch uncached articles. Source cards/citations remain opt-in per question.
- Recent message context has a 2,000-byte budget with per-message truncation rather than dropping all history at a long preceding reply. Saved article text is bounded to 12,000 characters; up to 4,000 characters of leading/relevant passages are supplied to inference. Very long articles and ambiguous references remain limited by the local context window.
- A failed/blocked article read keeps the saved snippet. The model distinguishes snippets from retrieved article text and does not infer a paywall merely from a blocked request. JavaScript-only pages, opaque news-wrapper URLs and paywalled pages may not yield an article body. No credentials, browser cookies, login or paywall bypass are used.
- New `/api/article` retrieval remains loopback/origin restricted and bounded by existing JSON/body protections, a 10-second deadline, four redirect attempts and a 1 MiB HTML limit. Public-address validation is performed in the DNS lookup used by the actual connection, pinning a validated address; redirected URLs receive the same checks. Private/mapped addresses and nonstandard ports are rejected. HTML script/navigation text is removed. Existing safe source links and free search/RSS/weather tools remain.
- Search sends the question only; article reading sends the selected source URL. Saved notes and other chat turns remain local. Inference stays on Qwen/Ollama or the retained browser adapter. Node/browser APIs are portable; physical Windows/Linux/mobile acceptance remains pending.

Older chats whose sources were discarded cannot recover them without one new retrieval. Chats that already have evidence can reuse it. The new behavior applies to new retrievals going forward.

## Mac validation

All 70 checks passed (50 unit/HTTP and 20 live), and the production build passed. Vite development proxies both search and article endpoints to the loopback server.

- Unit/HTTP cases cover hidden-source persistence, chained offline reuse, one article read without fresh search, context isolation, later relevant article passages, recall across unrelated turns, private targets/redirects, restricted previews and loopback-origin protection. Existing clock, routing, memory/storage, provider and retrieval cases remain.
- Real local Qwen tests use explicitly synthetic Trump article data to check pronoun handling and correction of a prior mistaken Vance reference. They are not presented as real reporting. Both follow-ups preserve the Trump topic with zero searches and zero article reads after cached text is supplied; save/reload is exercised.
- A real public NASA Earth-facts article is read once through `/api/article`, saved with the answer and reused after serialization/reload with search Off. Search count remains zero and article-read count one.
- Existing live weather, forecast, news, product, streaming, recall and Stop/retry checks remain in the full suite. Production build passes with the existing WebLLM bundle-size advisory.
- Mac browser confirms direct NASA article reading, reload and a successful source-free follow-up with search Off; Auto was restored afterward. Screenshot/logs live in ignored `.local-ai/`.

Browser testing also exposed unrelated free-engine relevance limits: leading “Search NASA…” returned Microsoft Search help; another query returned a NASA homepage rather than the desired facts page. The retained evidence correctly exposed the mismatch on follow-up. The grounding prompt now instructs the model not to invent publisher attribution from memory. Free search relevance and generated-answer correctness are still best effort; passing routing/context tests does not guarantee every factual answer.

All work stays local on `codex/cross-platform-foundation`; no push or merge.
