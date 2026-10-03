import type { Conversation, Message } from './types';
import type { SearchEvidence } from './search';

// The user turn is already durable. Streaming previews must never look completed on disk.
export function replyPersistence(conversation: Conversation, response: Message, preview: (value: Conversation) => void, commit: (value: Conversation) => void) {
  const withReply = (text: string, evidence?: SearchEvidence): Conversation => ({
    ...conversation, messages: [...conversation.messages, { ...response, text, ...(evidence ? { evidence } : {}) }],
  });
  return {
    preview: (text: string, evidence?: SearchEvidence) => preview(withReply(text, evidence)),
    complete: (text: string, evidence?: SearchEvidence) => commit(withReply(text, evidence)),
    discard: () => preview(conversation),
  };
}
