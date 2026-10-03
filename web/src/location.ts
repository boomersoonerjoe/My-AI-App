import type { Conversation, MemoryNote } from './types';
export interface Coordinates { latitude: number; longitude: number }
export type UserLocation = { source: 'conversation' | 'saved' | 'device'; place?: string; coordinates?: Coordinates };
// Platform adapters must use foreground, one-shot access. Never request background/Always access.
export interface LocationProvider { current(signal: AbortSignal, requestPermission?: boolean): Promise<Coordinates | undefined> }
export function validCoordinates(c: Coordinates) { return Number.isFinite(c.latitude) && Math.abs(c.latitude) <= 90 && Number.isFinite(c.longitude) && Math.abs(c.longitude) <= 180; }
export function statedLocation(text: string): string | undefined {
  const match = text.replace(/[’]/g,"'").match(/\b(?:i(?:'m| am) (?:currently |now )?(?:in|located in|living in|based in)|i live in|my (?:current |home )?location is)\s+([^.!?;\n]+)/i);
  const place = match?.[1].replace(/\s+(?:and|but|please|for now)\b.*$/i,'').trim();
  return place && place.length <= 120 && /^[\p{L}\p{N} .,'’-]+$/u.test(place) && !/^(?:a |the |my |your |this |that |love|trouble|pain|charge|bed|here|there|home|town|a hurry)\b/i.test(place) ? place : undefined;
}
export function isLocationQuestion(question: string) {
  return /\bwhere\s+am\s+i\b|\b(?:what(?:['’]s| is)|tell me|show me|identify|determine)\s+(?:my\s+)?(?:current\s+|physical\s+|device\s+)?location\b|\bwhat\s+(?:city|town)\s+am\s+i\s+in\b/i.test(question);
}
export async function lookupDeviceCity(coordinates: Coordinates, signal: AbortSignal): Promise<string> {
  const response = await fetch('/api/location',{method:'POST',signal,headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({coordinates})});
  const data = await response.json();
  if (!response.ok || typeof data.place !== 'string' || !data.place.trim() || data.place.length > 200) throw new Error('Device coordinates could not be converted to a city.');
  return data.place;
}
export function localRequest(question: string) {
  if (isLocationQuestion(question)) return true;
  const q = question.replace(/[’]/g,"'");
  if (/\b(?:nearby|near me|around me|in my area|local to me)\b/i.test(q)) return true;
  return /\b(?:weather|forecast|temperature|rain)\b/i.test(q) && !/\b(?:explain|how does|how do|what is (?:a |the )?(?:weather|forecast|temperature|rain)\??$|history|historical|in \d{4})\b/i.test(q);
}
export function explicitPlace(question: string) {
  return /\b(?:weather|forecast|temperature|rain)\s+(?:in|for|at)\s+(?!my (?:area|location)\b|here\b|my place\b)[\p{L}]/iu.test(question) || /\b(?:nearby|near me|around me)\b.*\b(?:in|at)\s+[\p{L}]/iu.test(question) || /\b(?:in|at)\s+[\p{L}].*\b(?:weather|forecast|nearby)\b/iu.test(question) || /^(?!what|how|is|will|the|current|today|local|show|tell|give)(?:[\p{L}]+[, ]+){1,4}(?:weather|forecast)\b/iu.test(question);
}
export async function resolveLocation(c: Conversation, memories: MemoryNote[], manual: string, provider: LocationProvider | undefined, signal: AbortSignal): Promise<UserLocation | undefined> {
  for (const m of [...c.messages].reverse()) if (m.role === 'user') { const place = statedLocation(m.text); if (place) return {source:'conversation',place}; }
  if (provider) {
    try { const c = await provider.current(signal); signal.throwIfAborted(); if (c && validCoordinates(c)) return {source:'device',coordinates:{latitude:Math.round(c.latitude*100)/100,longitude:Math.round(c.longitude*100)/100}}; }
    catch { signal.throwIfAborted(); }
  }
  if (manual.trim()) return {source:'saved',place:manual.trim()};
  for (const m of [...memories].reverse()) { const place = statedLocation(m.text); if (place) return {source:'saved',place}; }
}
export function locatedQuery(question: string, location: UserLocation) {
  const where = location.place ?? `latitude ${location.coordinates!.latitude.toFixed(2)} longitude ${location.coordinates!.longitude.toFixed(2)}`;
  if (/weather|forecast|temperature|rain/i.test(question)) return `Weather in ${where}? ${question}`;
  const topic = question.replace(/\b(?:give|show|provide|write)\s+(?:me\s+)?(?:a\s+|the\s+)?(?:short|brief|concise)\s+(?:answer|summary|response).*$/i,'').replace(/[.!?\s]+$/,'');
  return `${topic.replace(/\b(?:near me|around me|in my area|local to me)\b/gi,'nearby')} in ${where}`;
}
