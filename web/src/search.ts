import type { RetrievalPlan } from './retrieval-plan';
import type { Coordinates } from './location';
import type { DeviceContext } from './device-context';
export type SearchMode = 'auto' | 'always' | 'web' | 'off';
export interface SearchSource { title: string; url: string; excerpt: string; publisher?: string; publishedAt?: string; publishedDay?:string;publicationTimeZone?:string; article?: {pageTitle?:string;status:'retrieved'|'restricted'|'unavailable'; text?:string; fetchedAt:string; url:string; publishedAt?:string; productLinks?:{title:string;url:string}[]; pageKind?:'merchant'|'editorial'|'other'; offers?:PriceFact[]} }
export interface PriceFact {name:string;price:string;currency:string;previousPrice?:string;priceKind?:'starting-at';saleVerified?:boolean;url?:string;seller?:string}
export interface SearchEvidence {
  retrievalIntent?:'product-price'|'sale-event'|'other';
  currentPrice?:{status:'verified-live'|'unverified';checkedAt:string;facts:PriceFact[]};
  newsStatus?:'no-reports-today';searchedDay?:string;
  query: string; provider: string; fetchedAt: string; timeZone: string;
  scope: 'today' | 'recent' | 'web' | 'weather'; sources: SearchSource[];
}
export function wantsSources(text: string) {
  return /\b(sources?|citations?|references?)\b|\b(?:show|include|give|provide)\b.*\blinks?\b|\bcite\b/i.test(text);
}
export function isSuppliedArithmetic(text: string) {
  // Embedded model/version digits are identifiers, not supplied operands.
  return (text.match(/(?<![\p{L}\p{N}_])\d+(?:,\d{3})*(?:\.\d+)?(?![\p{L}\p{N}_])/gu)?.length ?? 0) >= 2 &&
    /\b(discounts?|adds?|subtract|multiply|divide|sales tax|percent|calculate)\b|\d\s*[+*/]\s*\d/i.test(text);
}
export function needsCurrentInformation(text: string) {
  const explicit = /\b(search|browse|google)\b|\blook\s+up\b/i.test(text);
  if (explicit) return true;

  const currentTime = /\b(current(?:ly)?|latest|recent(?:ly)?|live|now|today|tonight|tomorrow|yesterday|ongoing|up[- ]to[- ]date)\b|\b(?:this|next|last) (?:morning|afternoon|evening|week|weekend|month|year)\b/i.test(text);
  // Supplied numbers belong to local calculations unless fresh facts are requested.
  if (isSuppliedArithmetic(text) && !currentTime && !/\b(news|weather)\b/i.test(text)) return false;
  if (/\b(?:nearby|near me|around me|in my area)\b/i.test(text)) return true;

  // Past tense alone is not historical: "What happened in the news today?" is live.
  const historical = /\b(?:history|historical|in \d{4}|was|were)\b/i.test(text);
  if (historical && !currentTime) return false;
  const conceptual = /\b(?:what (?:is|are)|how (?:does|do)|explain|define)\b.*\b(?:weather|forecast(?:ing)?|stock market|exchange rates?|news|price elasticity|sales tax|sales|discounts?|inflation|interest rates?)\b/i.test(text)
    && !currentTime && !/\b(?:in|for|at|on)\b/i.test(text);
  if (conceptual && !/\b(?:mortgage|dollars?|euros?|yen|pounds?)\b/i.test(text)) return false;

  const liveTopic = /\b(news|headlines?|breaking|weather|forecast|stock prices?|stock market|exchange rates?|interest rates?|inflation|opening hours|availability|current events|elections?|traffic|flight status|status of (?:the )?flight|sports scores?)\b/i.test(text);
  const shopping = /\b(prices?|pricing|costs?|deals?|sales|on sale|discounts?|promotions?|coupons?|in stock|out of stock|restock(?:ed|s)?)\b|\bhow much (?:is|are|does|do|will|would)\b|\b(?:buy|shop for|recommend|compare)\b.*\b(?:products?|cameras?|phones?|laptops?|tablets?|tvs?|headphones?|doorbells?)\b/i.test(text);
  const productInformation = /\b(?:specs|specifications|compatibility|supported devices)\b|\b(?:best|newest|new|latest)\b.*\b(?:products?|cameras?|phones?|laptops?|tablets?|tvs?|headphones?|doorbells?)\b/i.test(text);
  const changingQuestion = /\b(?:latest|up[- ]to[- ]date)\b|\bwho (?:is|are)\b.*\b(?:president|mayor|governor|prime minister|ceo)\b|\bis .+ (?:open|available|released)\b/i.test(text);
  // Tie time words to changing external facts so "electric current" and mood stay local.
  const timelyTopic = currentTime && /\b(sales?|products?|cameras?|phones?|laptops?|versions?|releases?|updates?|events?|happen(?:ing|ed)?|conditions?|temperatures?|rain|snow|president|mayor|governor|ceo|results?|status|scores?|schedules?|concerts?|games?|flights?|hours|open|available|released|release|cost|worth|trending|rules?|laws?|regulations?)\b/i.test(text);
  return liveTopic || shopping || productInformation || changingQuestion || timelyTopic;
}
export function safeSourceURL(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname);
  } catch { return false; }
}
export async function searchInternet(query: string, clock: DeviceContext, signal: AbortSignal, kindOverride?: 'web' | 'news', coordinates?: Coordinates, plan?: RetrievalPlan): Promise<SearchEvidence> {
  if (globalThis.navigator?.onLine === false) throw new Error('Your device reports it is offline.');
  const kind = kindOverride ?? (plan?.kind ? plan.kind === 'news' ? 'news' : 'web' : (/\b(news|headlines?|breaking)\b/i.test(query) ? 'news' : 'web'));
  const today = /\b(today|tonight|this morning)\b/i.test(query);
  const response = await fetch('/api/search', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ query, kind, today, day: clock.localDate, timeZone: clock.timeZone, ...(coordinates ? {coordinates} : {}), ...(plan ? {searchQueries:plan.queries,requiredTerms:plan.terms,retrievalIntent:plan.intent} : {}) }),
  });
  const evidence = await response.json() as SearchEvidence & { error?: string };
  if (!response.ok) throw new Error(evidence.error || `Search returned HTTP ${response.status}.`);
  if (!Array.isArray(evidence.sources) || (!evidence.sources.length && evidence.newsStatus !== 'no-reports-today') || evidence.sources.some(s => !safeSourceURL(s.url))) throw new Error('Search returned no usable sources.');
  return evidence;
}

export async function readSourceArticle(source: SearchSource, signal: AbortSignal): Promise<SearchSource> {
  if (source.article || !safeSourceURL(source.url)) return source;
  try {
    const response = await fetch('/api/article',{method:'POST',signal,headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({url:source.url})});
    if (!response.ok) throw new Error('Article unavailable');
    const article = await response.json() as NonNullable<SearchSource['article']>;
    if (!['retrieved','restricted','unavailable'].includes(article.status) || !safeSourceURL(article.url)) throw new Error('Invalid article response');
    return {...source,article:{...article,text:article.text?.slice(0,12000)}};
  } catch {signal.throwIfAborted();return {...source,article:{status:'unavailable',url:source.url,fetchedAt:new Date().toISOString()}};}
}

// Detect an execution/capability failure, independent of user-question wording.
export function isLiveAccessRefusal(text: string) {
  return /(?:cannot|can't|unable to|do not|don't|without|no|lack).{0,45}(?:(?:browse|search|access|check) (?:the )?(?:live )?(?:web|internet)|(?:live|real[- ]time) (?:access|data|information|browsing))|(?:need|requires?).{0,20}(?:live|real[- ]time|web|internet) (?:search|access|data)/i.test(text);
}
