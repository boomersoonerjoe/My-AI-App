import { articleContext } from './retrieval-context';
import { describe, it, expect, vi } from 'vitest';
import { deviceContext, isDeviceClockQuestion, type DeviceContext } from './device-context';
import { answerConversation } from './chat-service';
import { needsCurrentInformation, wantsSources, searchInternet, type SearchEvidence } from './search';
import type { ChatProvider, ChatRequest } from './provider';
import type { Conversation } from './types';
const clock = () => deviceContext(new Date('2026-10-01T21:00:00Z'), 'America/Chicago');
const conversation = (text: string): Conversation => ({ id: 'c', title: 'test', messages: [{ id: 'm', role: 'user', text, createdAt: '' }] });
const evidence: SearchEvidence = { query: 'Tulsa news today', provider: 'fixture RSS', scope: 'today', fetchedAt: '2026-10-01T21:00:00Z', timeZone: 'America/Chicago', sources: [{ title: 'Test headline', excerpt: 'Fixture: a Tulsa library opens a reading room.', url: 'https://example.org/news', publishedAt: '2026-10-01T18:00:00Z' }] };
function setup(reply = 'A local answer') {
  const generate = vi.fn(async (_request: ChatRequest) => reply);
  const provider = { generate } as unknown as ChatProvider;
  const search = vi.fn(async (_query: string, _clock: DeviceContext, _signal: AbortSignal) => evidence);
  const onUpdate = vi.fn(); const onActivity = vi.fn();
  const options = { mode: 'auto' as const, clock, search, onUpdate, onActivity, signal: new AbortController().signal };
  return { provider, generate, search, onUpdate, options };
}
describe('offline device clock', () => {
  it('uses the local date across UTC midnight and DST transitions', () => {
    expect(deviceContext(new Date('2026-10-02T02:00:00Z'), 'America/Chicago')).toMatchObject({ localDate: '2026-10-01', localTime: '21:00:00', weekday: 'Thursday', utcOffset: 'GMT-05:00' });
    expect(deviceContext(new Date('2026-03-08T07:59:00Z'), 'America/Chicago').utcOffset).toBe('GMT-06:00');
    expect(deviceContext(new Date('2026-03-08T08:00:00Z'), 'America/Chicago').localTime).toBe('03:00:00');
  });
  it('recognizes direct clock questions but not event schedules', () => {
    for (const q of ["What's today's date?", 'What time is it?', 'What timezone am I in?', 'What day is today?', 'What is the current date and time?']) expect(isDeviceClockQuestion(q)).toBe(true);
    expect(isDeviceClockQuestion('What time does the concert start today?')).toBe(false);
  });
  it('answers without network or model inference even in always-search mode', async () => {
    const s = setup(); const result = await answerConversation(conversation('What time is it?'), [], s.provider, { ...s.options, mode: 'always' });
    expect(result.text).toContain('2026-10-01'); expect(result.text).toContain('16:00:00'); expect(result.text).toContain('America/Chicago');
    expect(s.generate).not.toHaveBeenCalled(); expect(s.search).not.toHaveBeenCalled();
  });
});

describe('local-first routing and natural replies', () => {
  it('keeps supplied-price arithmetic local while retaining real price searches', async () => {
    const s = setup('$99');
    const question = 'A store discounts a $120 item by 25%, then adds 10% sales tax. What is the final price? Explain briefly.';
    await answerConversation(conversation(question), [], s.provider, s.options);
    expect(s.search).not.toHaveBeenCalled(); expect(s.generate).toHaveBeenCalledOnce(); expect(s.generate.mock.calls[0][0].reasoning).toBe(true);
    expect(needsCurrentInformation('MacBook Air current price')).toBe(true);
    expect(needsCurrentInformation('Search a $120 item with a 25% discount')).toBe(true);
  });
  it('answers ordinary questions through the local model in every enabled mode', async () => {
    for (const question of ['What is the capital of Oklahoma?', 'If I drive 180 miles at 60 mph, how long will it take?', 'Who is Shakespeare?', 'Compare cats and dogs', 'Research solar panel efficiency', 'How does weather forecasting work?', 'What is the stock market?', 'Tell me a joke', 'What is electric current?', 'Help me describe my current mood', 'What is price elasticity?', 'Explain weather forecasting']) {
      expect(needsCurrentInformation(question),question).toBe(false);
      for (const mode of ['auto','always','web','off'] as const) {
        const s = setup(); await answerConversation(conversation(question),[],s.provider,{...s.options,mode});
        expect(s.search).not.toHaveBeenCalled(); expect(s.generate.mock.calls[0][0].evidence).toBeUndefined();
      }
    }
  });
  it('searches live questions and explicit search requests', () => {
    for (const q of ['What is the weather in Tulsa right now?', 'Tulsa news today', 'Latest Firefox version', 'Who is the mayor of Tulsa?', 'Search for hiking trails', 'Look up the capital of Oklahoma', 'MacBook Air current price']) expect(needsCurrentInformation(q),q).toBe(true);
    expect(needsCurrentInformation('What was the weather in Tulsa in 1900?')).toBe(false);
  });
  it('streams normal retrieved prose without validation gates, warnings or sources by default', async () => {
    const s = setup('Tulsa is at 70°F, feeling like 74°F.');
    const result = await answerConversation(conversation('What is the weather in Tulsa right now?'),[],s.provider,s.options);
    expect(result.text).toBe('Tulsa is at 70°F, feeling like 74°F.'); expect(result.evidence).toEqual(evidence); expect(result.retryable).toBe(false);
    expect(s.generate).toHaveBeenCalledTimes(1); expect(s.generate.mock.calls[0][0]).toMatchObject({evidence,showSources:false}); expect(s.generate.mock.calls[0][0].responseKind).toBeUndefined();
  });
  it('only exposes sources when requested and keeps notes/history out of search', async () => {
    const s = setup('A Tulsa library opens a reading room. [1]');
    const c=conversation('Tulsa news today. Show sources.'); c.messages.unshift({id:'old',role:'assistant',text:'Private earlier turn',createdAt:''});
    const result=await answerConversation(c,[{id:'secret',text:'Private memory'}],s.provider,s.options);
    expect(s.search.mock.calls[0][0]).toBe('Tulsa news today. Show sources.'); expect(result.evidence).toEqual(evidence); expect(s.generate.mock.calls[0][0].showSources).toBe(true);
    expect(wantsSources('Give me sources')).toBe(true); expect(wantsSources('What is the weather?')).toBe(false);
  });
  it('does not fabricate live data when search is unavailable', async () => {
    const s=setup(); s.search.mockRejectedValueOnce(new Error('Offline'));
    const result=await answerConversation(conversation('Tulsa weather right now'),[],s.provider,s.options);
    expect(result.text).toContain("couldn't retrieve live information"); expect(result.text).not.toMatch(/validat|publication/); expect(s.generate).not.toHaveBeenCalled();
  });
  it('preserves retrieval cancellation', async () => {
    const s=setup(); const abort=new AbortController();
    s.search.mockImplementationOnce(async()=>{abort.abort(); throw new DOMException('Stopped','AbortError');});
    await expect(answerConversation(conversation('Tulsa news today'),[],s.provider,{...s.options,signal:abort.signal})).rejects.toMatchObject({name:'AbortError'}); expect(s.onUpdate).not.toHaveBeenCalled();
  });
});


it('retains evidence without visible sources and reuses article content through chained offline follow-ups', async () => {
  const e={...evidence,sources:[{title:'What Trump Has Built',url:'https://example.org/trump',excerpt:'Trump discusses a political coalition.',article:{status:'retrieved' as const,text:'Trump built a political coalition of voters and allies.',url:'https://example.org/trump',fetchedAt:clock().isoTime}}]};
  const c=conversation('what was the main thing the article pointed out that he built?');
  c.messages.unshift({id:'a',role:'assistant',text:'TIME published What Trump Has Built.',createdAt:'',evidence:e});
  const s=setup('Trump built a political coalition.');const readArticle=vi.fn();
  const result=await answerConversation(c,[],s.provider,{...s.options,mode:'off',readArticle});
  expect(s.search).not.toHaveBeenCalled();expect(readArticle).not.toHaveBeenCalled();expect(result.evidence?.sources[0].article?.text).toContain('coalition');expect(s.generate.mock.calls[0][0]).toMatchObject({recalled:true,showSources:false});
  c.messages.push({id:'b',role:'assistant',text:result.text,createdAt:'',evidence:result.evidence},{id:'c',role:'user',text:'what did it say?',createdAt:''});
  await answerConversation(c,[],s.provider,s.options);expect(s.search).not.toHaveBeenCalled();
});
it('reads the referenced source once without a fresh search and retains it on the message', async()=>{
  const c=conversation('Tell me more about that story.');c.messages.unshift({id:'a',role:'assistant',text:'A Tulsa library opens a reading room.',createdAt:'',evidence});
  const s=setup();const readArticle=vi.fn(async source=>({...source,article:{status:'retrieved' as const,text:'The library reading room is open to residents.',url:source.url,fetchedAt:clock().isoTime}}));
  const result=await answerConversation(c,[],s.provider,{...s.options,readArticle});expect(readArticle).toHaveBeenCalledTimes(1);expect(s.search).not.toHaveBeenCalled();expect(result.evidence?.sources[0].article?.text).toContain('residents');
  const unrelated=conversation('What is the capital of Oklahoma?');unrelated.messages.unshift(...c.messages.slice(0,-1));await answerConversation(unrelated,[],s.provider,s.options);expect(s.generate.mock.calls.at(-1)![0].evidence).toBeUndefined();
});

it('includes relevant saved article passages beyond the first context window',()=>{
 const text='Opening paragraph. '+ 'General background. '.repeat(400)+'The spacecraft discovered methane near the end of the article.';
 const selected=articleContext(text,'What did the article say about methane?');expect(selected).toContain('discovered methane');expect(selected.length).toBeLessThanOrEqual(4000);
});

it('reads an explicitly supplied public article URL without searching, then saves its text',async()=>{
 const s=setup();const readArticle=vi.fn(async source=>({...source,article:{status:'retrieved' as const,text:'A public article body.',url:source.url,fetchedAt:clock().isoTime}}));
 const result=await answerConversation(conversation('Read this article: https://example.org/story'),[],s.provider,{...s.options,readArticle});expect(s.search).not.toHaveBeenCalled();expect(readArticle).toHaveBeenCalledTimes(1);expect(result.evidence?.sources[0].article?.text).toContain('article body');
});

it('recalls an explicit article reference across unrelated turns without reusing it for generic math follow-ups',async()=>{
 const s=setup();const c=conversation('What did that article say?');c.messages.unshift({id:'source',role:'assistant',text:'A news story.',createdAt:'',evidence:{...evidence,sources:evidence.sources.map(source=>({...source,article:{status:'retrieved' as const,text:'Saved story text.',url:source.url,fetchedAt:clock().isoTime}}))}},{id:'math',role:'assistant',text:'3 hours.',createdAt:''});
 await answerConversation(c,[],s.provider,{...s.options,mode:'off'});expect(s.generate.mock.calls.at(-1)![0].recalled).toBe(true);
 c.messages.at(-1)!.text='Tell me more';await answerConversation(c,[],s.provider,s.options);expect(s.generate.mock.calls.at(-1)![0].evidence).toBeUndefined();
});


describe('Auto current-information regression coverage', () => {
  const questions = [
    'Are there any sales currently going on at Best Buy for Ring cameras?',
    'Are Ring cameras on sale at Best Buy?',
    'Does Best Buy have any discounts on Ring cameras?',
    'How much does a Ring camera cost at Best Buy?',
    'What is the price of a Ring camera?',
    'Is the Ring Battery Doorbell in stock?',
    'Compare the best cameras to buy',
    'What are the specs for the Ring Battery Doorbell?',
    'What new Ring products are available this year?',
    'What happened in the news today?',
    'What were the election results yesterday?',
    'What are the current events in France?',
    'Will it rain in Tulsa tomorrow?',
    'What is the forecast for Tulsa?',
    'What is the latest Firefox release?',
    'What are mortgage interest rates?',
    'What is the exchange rate for dollars to euros?',
    'What is the status of flight AA123?',
    'What are the current travel rules for Japan?',
    'Who is the CEO of Best Buy?',
    'What time does the concert start today?',
  ];
  it.each(questions)('retrieves before generating for: %s', async question => {
    const s = setup();
    expect(needsCurrentInformation(question)).toBe(true);
    const result = await answerConversation(conversation(question), [], s.provider, s.options);
    expect(s.search).toHaveBeenCalledExactlyOnceWith(question, clock(), s.options.signal, undefined, undefined);
    expect(s.search.mock.invocationCallOrder[0]).toBeLessThan(s.generate.mock.invocationCallOrder[0]);
    expect(s.generate.mock.calls[0][0].evidence).toEqual(evidence);
    expect(result.evidence).toEqual(evidence);
  });
  it.each([
    'Explain how sales tax works', 'What are sales?', 'Define discounts',
    'What is an exchange rate?', 'What is inflation?',
    'What were Ring camera prices in 2020?', 'What was the weather in Tulsa in 1900?',
    'Explain the history of elections', 'Help me describe my current mood',
    'A camera costs $100 with a 20% discount. Calculate the price.',
  ])('preserves local routing for: %s', async question => {
    const s = setup();
    expect(needsCurrentInformation(question)).toBe(false);
    await answerConversation(conversation(question), [], s.provider, s.options);
    expect(s.search).not.toHaveBeenCalled();
    expect(s.generate).toHaveBeenCalledOnce();
  });
  it('respects Off for the reported sales question', async () => {
    const s = setup();
    const result = await answerConversation(conversation(questions[0]), [], s.provider, {...s.options, mode:'off'});
    expect(s.search).not.toHaveBeenCalled();
    expect(s.generate).not.toHaveBeenCalled();
    expect(result.retryable).toBe(true);
  });
});
