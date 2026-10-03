import type { Conversation } from './types';
import type { SearchEvidence } from './search';
export function isRetrievalFollowUp(question: string) {
  return /\b(?:the|that|this)\s+(?:article|story|report|source|piece|interview|transcript|headline)\b|\b(?:what did it say|what was it about|summarize it|explain it|tell me more|what else|what did he|what did she|he built|she built|paywall)\b|^(?:show (?:me )?)?(?:the )?(?:sources|citations|links)[?.!]*$/i.test(question);
}
export function recalledEvidence(conversation: Conversation): SearchEvidence | undefined {
  const question = conversation.messages.at(-1)!.text;
  if (!isRetrievalFollowUp(question) || /\b(?:search|browse|look up|refresh|new search|latest update)\b/i.test(question)) return;
  const replies = [...conversation.messages.slice(0,-1)].reverse().filter(m => m.role === 'assistant');
  const explicitArticle = /article|story|report|piece|interview|transcript|paywall/i.test(question);
  const previous = explicitArticle ? replies.find(m=>m.evidence?.sources.length && m.evidence.scope !== 'weather') : replies[0];
  if (!previous?.evidence?.sources.length) return;
  const words = new Set(`${previous.text} ${question}`.toLowerCase().match(/[a-z]{4,}/g) || []);
  const score = (title:string) => (title.toLowerCase().match(/[a-z]{4,}/g) || []).filter(word=>words.has(word)).length;
  const sources = [...previous.evidence.sources].sort((a,b)=>score(b.title)-score(a.title));
  return {...previous.evidence,sources};
}

export function articleContext(text: string, question: string) {
  if (text.length <= 4000) return text;
  const words=[...new Set(question.toLowerCase().match(/[a-z]{4,}/g) || [])].filter(w=>!['what','that','this','article','story','about','thing','pointed','main','said','sources'].includes(w));
  const chunks=[];
  for(let start=0;start<text.length;start+=700) {
    const content=text.slice(start,start+900);const lower=content.toLowerCase();
    chunks.push({start,content,score:words.filter(w=>lower.includes(w)).length});
  }
  const relevant=chunks.filter(c=>c.score>0).sort((a,b)=>b.score-a.score).slice(0,3).sort((a,b)=>a.start-b.start);
  if (!relevant.length) return text.slice(0,4000);
  return `${text.slice(0,600)}\n[Selected saved article passages]\n${relevant.map(c=>c.content).join('\n[…]\n')}`.slice(0,4000);
}
