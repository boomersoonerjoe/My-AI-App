import {requiresCurrentPrice,gateCurrentPrices} from '../scripts/price-evidence.mjs';
import {validNewsDates,supportedNewsAnswer} from './news-answer';
import {retrievalOutcome,validPriceAnswer,supportedPriceAnswer} from './price-answer';
import { validWeatherAnswer, supportedWeatherAnswer } from './weather-answer';
import { isLocationQuestion, lookupDeviceCity, localRequest, explicitPlace, resolveLocation, locatedQuery, type LocationProvider } from './location';
import type { Conversation, MemoryNote } from './types';
import type { ChatProvider } from './provider';
import { recalledEvidence } from './retrieval-context';
import { buildPrompt } from './context';
import { memoryToSave, memoryConfirmation, savedGreeting } from './memory';
import { deviceContext, isDeviceClockQuestion, clockAnswer, type DeviceContext } from './device-context';
import { needsCurrentInformation, isLiveAccessRefusal, isSuppliedArithmetic, wantsSources, searchInternet, readSourceArticle, safeSourceURL, type SearchMode, type SearchEvidence } from './search';
interface AnswerOptions {
  lookupCity?: typeof lookupDeviceCity;
  onLocation?: (message: string) => void;
  manualLocation?: string; locationProvider?: LocationProvider;
  mode: SearchMode; signal: AbortSignal;
  onUpdate(text: string, evidence?: SearchEvidence): void;
  onActivity(message: string): void;
  clock?: () => DeviceContext;
  search?: typeof searchInternet;
  readArticle?: typeof readSourceArticle;
  saveMemory?: (text: string) => void;
}
export async function answerConversation(conversation: Conversation, memories: MemoryNote[], provider: ChatProvider, options: AnswerOptions) {
  const prompt = buildPrompt(conversation, memories);
  const question = conversation.messages.at(-1)!.text;
  const clock = (options.clock ?? deviceContext)();
  options.signal.throwIfAborted();
  const memory = memoryToSave(conversation);
  if (memory !== undefined) {
    if (memory && !options.saveMemory) throw new Error('Memory storage is unavailable. Your note was not saved.');
    if (memory) options.saveMemory!(memory);
    const text = memory ? `Saved to local memory: ${memory}` : 'What would you like me to remember? Include the information after “remember this:”.';
    options.onUpdate(text); return { text, retryable: false };
  }
  const confirmation = memoryConfirmation(conversation, memories);
  const greeting = /^(?:hello|hi|hey)[!.\s]*$/i.test(question.trim()) ? savedGreeting(memories) : undefined;
  if (confirmation || greeting) {
    const text = confirmation ?? greeting!;
    options.onUpdate(text); return { text, retryable: false };
  }
  if (isDeviceClockQuestion(question)) {
    const text = clockAnswer(clock); options.onUpdate(text); return { text, retryable: false };
  }
  const useLocation = localRequest(question) && !explicitPlace(question);
  let searchQuestion = question;
  let userLocation;
  if (useLocation) {
    userLocation = await resolveLocation(conversation, memories, options.manualLocation ?? '', options.locationProvider, options.signal);
    if (!userLocation) {
      const text = 'What city and state or country are you in? You can also enable device location in Location settings.';
      options.onUpdate(text); return {text, retryable:false};
    }
    if (userLocation.coordinates) {
      try {
        options.onActivity('Converting device coordinates to a city…');
        if (options.mode === 'off' || globalThis.navigator?.onLine === false) throw new Error('City lookup requires internet.');
        const place = await (options.lookupCity ?? lookupDeviceCity)(userLocation.coordinates,options.signal);
        userLocation = {...userLocation,place};
        options.onLocation?.(`Device coordinates received; city lookup: ${place}.`);
      } catch {
        options.signal.throwIfAborted();
        options.onLocation?.('Device coordinates received, but city lookup failed. Using manual/saved fallback if available.');
        const fallback = await resolveLocation(conversation,memories,options.manualLocation ?? '',undefined,options.signal);
        // Coordinate weather remains usable without reverse geocoding if no fallback exists.
        if (fallback) userLocation = fallback;
      }
    }
    if (isLocationQuestion(question)) {
      const text = userLocation.place ? userLocation.source === 'device' ? `Your device location resolves to ${userLocation.place}.` : `Your ${userLocation.source === 'conversation' ? 'stated' : 'saved'} location is ${userLocation.place}.` : `Your device returned approximate coordinates ${userLocation.coordinates!.latitude.toFixed(2)}, ${userLocation.coordinates!.longitude.toFixed(2)}, but I couldn't resolve a city right now.`;
      options.onUpdate(text); return {text,retryable:false};
    }
    searchQuestion = locatedQuery(question,userLocation);
  }
  let current = needsCurrentInformation(question) || localRequest(question);
  let evidence: SearchEvidence | undefined = recalledEvidence(conversation);
  // Never reuse stored price evidence for a fresh-price request.
  if(evidence && requiresCurrentPrice(question) && /\b(?:now|current|currently|today|latest|on sale)\b/i.test(question)) evidence=undefined;
  else if(evidence?.currentPrice)evidence={...evidence,currentPrice:undefined};
  const recalled = !!evidence;
  const suppliedURL = /\b(?:read|summarize|article)\b/i.test(question) ? question.match(/https?:\/\/[^\s<>]+/i)?.[0].replace(/[).,;!?]+$/, '') : undefined;
  if (suppliedURL && safeSourceURL(suppliedURL) && options.mode !== 'off') {
    options.onActivity('Reading the supplied article…');
    const source = await (options.readArticle ?? readSourceArticle)({title:new URL(suppliedURL).hostname + new URL(suppliedURL).pathname,url:suppliedURL,excerpt:'Article URL supplied by the user.'},options.signal);
    options.signal.throwIfAborted();
    evidence = {query:question,provider:'Public article',scope:'web',fetchedAt:clock.isoTime,timeZone:clock.timeZone,sources:[source]};
    if(requiresCurrentPrice(question) && /\b(?:now|current|currently|today|how much|on sale)\b/i.test(question)) evidence=gateCurrentPrices(evidence);
  }
  let plan;
  if (!evidence && options.mode !== 'off' && globalThis.navigator?.onLine !== false && provider.planRetrieval && !(isSuppliedArithmetic(question) && !current)) {
    options.onActivity('Local AI is planning whether live information is needed…');
    try {
      plan = await provider.planRetrieval(searchQuestion, clock, options.signal);
      // Deterministic live routes remain a safety net if the small local planner misses intent.
      current ||= plan.retrieve;
    } catch {
      options.signal.throwIfAborted();
      // A failed planner is an unknown decision, not a decision to stay offline.
      // Auto may retrieve the current message; never include memory or history.
      current = true;
    }
  }
  if (current && !evidence) {
    try {
      if (options.mode === 'off') throw new Error('Internet search is turned off.');
      options.onActivity('Searching free internet sources…');
      evidence = await (options.search ?? searchInternet)(searchQuestion, clock, options.signal, options.mode === 'web' ? 'web' : undefined, userLocation?.coordinates, ...(plan?.retrieve ? [plan] as const : []));
      options.signal.throwIfAborted();
      if (!evidence.sources.length && evidence.newsStatus !== 'no-reports-today') throw new Error('No usable sources were retrieved.');
    } catch (error) {
      options.signal.throwIfAborted();
      const text = "I couldn't retrieve live information right now. Please try again when internet search is available.";
      options.onUpdate(text); return { text, retryable: true };
    }
  }
  const outcome=retrievalOutcome(evidence);
  if(outcome){options.onUpdate(outcome,evidence);return {text:outcome,evidence,retryable:false};}
  if (recalled && evidence && /article|story|piece|interview|transcript|paywall|what did it say|summarize it/i.test(question) && !evidence.sources[0].article && options.mode !== 'off') {
    options.onActivity('Reading the previously used source…');
    const source = await (options.readArticle ?? readSourceArticle)(evidence.sources[0],options.signal);
    options.signal.throwIfAborted();
    evidence = {...evidence,sources:[source,...evidence.sources.slice(1)]};
  }
  options.onActivity(evidence ? 'Local AI is summarizing retrieved sources…' : 'Local AI is replying…');
  const showSources = wantsSources(question);

  const newNews=!!evidence && !recalled && ['today','recent'].includes(evidence.scope);
  const updateAnswer = (text: string) => { if (!newNews && evidence?.scope !== 'weather' && !evidence?.currentPrice) options.onUpdate(text,evidence); };
  let text = await provider.generate({ prompt, device: clock, evidence, showSources, recalled, reasoning: !evidence && isSuppliedArithmetic(question) }, updateAnswer, options.signal);
  options.signal.throwIfAborted();
  // A small local planner may miss a novel intent. A capability refusal is an
  // execution signal to retrieve, not a final answer or another keyword rule.
  if (!evidence && options.mode !== 'off' && globalThis.navigator?.onLine !== false &&
      isLiveAccessRefusal(text)) {
    options.onActivity('Checking live sources before answering…');
    try {
      evidence = await (options.search ?? searchInternet)(searchQuestion, clock, options.signal, options.mode === 'web' ? 'web' : undefined, userLocation?.coordinates);
      const recoveredOutcome=retrievalOutcome(evidence);
      if(recoveredOutcome){options.onUpdate(recoveredOutcome,evidence);return {text:recoveredOutcome,evidence,retryable:false};}
      if (!evidence.sources.length) throw new Error('No usable sources');
      text = await provider.generate({prompt,device:clock,evidence,showSources}, updateAnswer, options.signal);
    } catch {
      options.signal.throwIfAborted();
      text = "I tried retrieving live information, but the sources were unavailable. Please try again.";
      options.onUpdate(text); return {text,retryable:true};
    }
  }
  // Retry a contradictory capability response with the same retrieved evidence.
  if (evidence && isLiveAccessRefusal(text)) {
    text = await provider.generate({prompt:`${prompt}\nThe application already performed retrieval. Summarize the supplied evidence and identify only specific missing details.`,device:clock,evidence,showSources,recalled}, updateAnswer,options.signal);
  }
  if(newNews && evidence) {
    if(!validNewsDates(text,evidence))text=supportedNewsAnswer(evidence);
    options.onUpdate(text,evidence);
  }
  if(evidence?.currentPrice?.status==='verified-live') {
    if(!validPriceAnswer(text,evidence))text=supportedPriceAnswer(evidence);
    options.onUpdate(text,evidence);
  }
  if (evidence?.scope === 'weather') {
    if (!validWeatherAnswer(text,evidence)) {
      text = await provider.generate({prompt:`${prompt}\nUse only the measurements provided. For a forecast give high, low and rain probability. For current conditions give temperature and feels-like; never invent a forecast.`,device:clock,evidence,showSources},()=>{},options.signal);
      if (!validWeatherAnswer(text,evidence)) text=supportedWeatherAnswer(evidence!);
    }
    options.onUpdate(text,evidence);
  }
  options.signal.throwIfAborted();
  return { text, evidence, retryable: false };
}
