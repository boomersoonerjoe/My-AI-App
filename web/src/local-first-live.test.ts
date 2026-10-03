import { expect, it } from 'vitest';
import { answerConversation } from './chat-service';
import { deviceContext } from './device-context';
import { OllamaChatProvider } from './ollama-provider';
import type { SearchEvidence } from './search';
const enabled = (globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.NHOMEAI_LIVE_TEST === '1';
it.skipIf(!enabled)('retrieves live Tulsa news and uses local Ollama to write cited conversational summaries', async () => {
  const clock = deviceContext();
  const response = await fetch('http://127.0.0.1:4173/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'what happened today in the news in tulsa? give me a short summary and show sources', kind: 'news', today: true, day: clock.localDate, timeZone: clock.timeZone }) });
  expect(response.ok).toBe(true);
  const evidence = await response.json() as SearchEvidence;
  expect(evidence.sources.length).toBeGreaterThan(0);
  const provider = new OllamaChatProvider(); await provider.prepare(() => {});
  const generate = provider.generate.bind(provider); provider.generate = async (...args) => { const raw = await generate(...args); console.log(JSON.stringify({rawAnswer:raw})); return raw; };
  const result = await answerConversation({ id: 'live-news', title: 'News', messages: [{ id: 'q', role: 'user', text: 'what happened today in the news in tulsa? give me a short summary and show sources', createdAt: clock.isoTime }] }, [], provider, { mode: 'auto', signal: AbortSignal.timeout(120000), clock: () => clock, search: async () => evidence, onUpdate() {}, onActivity() {} });
  expect(result.retryable).toBe(false);
  expect(result.text).not.toMatch(/publication date|couldn't validate/i);
  expect(result.text).not.toContain('extractive summary');
  expect(result.text.length).toBeGreaterThan(50);
  console.log(JSON.stringify({ clock, result, evidence }, null, 2));
}, 150000);
for (const query of ['current tulsa weather', 'MacBook Air current price', 'Compare latest budget laptops', 'Current events in Oklahoma', 'Research solar panel efficiency']) {
  it.skipIf(!enabled)(`general web retrieval and local conversational answer: ${query}`, async () => {
    const clock = deviceContext();
    const response = await fetch('http://127.0.0.1:4173/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, kind: 'web', today: /today/i.test(query), day: clock.localDate, timeZone: clock.timeZone }) });
    const evidence = await response.json() as SearchEvidence;
    expect(response.ok, JSON.stringify(evidence)).toBe(true);
    expect(evidence.sources.length).toBeGreaterThan(0);
    if (/weather/i.test(query)) for (const source of evidence.sources) { expect(`${source.title} ${source.url}`).toMatch(/tulsa/i); expect(`${source.title} ${source.url}`).not.toMatch(/waxahachie/i); }
    expect(evidence.provider).toMatch(/web search|Open-Meteo/);
    const provider = new OllamaChatProvider(); await provider.prepare(() => {});
    const generate = provider.generate.bind(provider); provider.generate = async (...args) => { const raw = await generate(...args); console.log(JSON.stringify({rawAnswer:raw})); return raw; };
  const result = await answerConversation({ id: 'live-web', title: query, messages: [{ id: 'q', role: 'user', text: query, createdAt: clock.isoTime }] }, [], provider, { mode: 'auto', signal: AbortSignal.timeout(120000), clock: () => clock, search: async () => evidence, onUpdate() {}, onActivity() {} });
    expect(result.retryable).toBe(false);
    if (result.text.includes("don't contain enough information")) { expect(['Research solar panel efficiency','Current events in Oklahoma']).toContain(query); } else { expect(result.text).not.toMatch(/publication date|couldn't validate/i); }
    expect(result.text).not.toContain('extractive summary');
    expect(result.text).not.toContain('not independently verified');
    expect(result.text.length).toBeGreaterThan(50);
    console.log(JSON.stringify({ query, provider: evidence.provider, sources: evidence.sources, answer: result.text }));
  }, 150000);
}
for (const [query,kind] of [
  ['Current weather in Tulsa, OK in Celsius','web'],
  ['Current weather in Oklahoma City, OK','web'],
  ['Current weather in Waxahachie, TX','web'],
  ['Oklahoma City news today','news'],
  ['United States news today','news'],
  ['iPhone current price','web'],
] as const) {
  it.skipIf(!enabled)(`additional conversational live question: ${query}`,async () => {
    const clock = deviceContext();
    const response = await fetch('http://127.0.0.1:4173/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,kind,today:/today/i.test(query),day:clock.localDate,timeZone:clock.timeZone})});
    const evidence = await response.json() as SearchEvidence;
    expect(response.ok,JSON.stringify(evidence)).toBe(true); expect(evidence.sources.length).toBeGreaterThan(0);
    const provider = new OllamaChatProvider(); await provider.prepare(()=>{});
    const generate = provider.generate.bind(provider); provider.generate = async (...args) => { const raw = await generate(...args); console.log(JSON.stringify({rawAnswer:raw})); return raw; };
  const result = await answerConversation({id:'additional',title:query,messages:[{id:'q',role:'user',text:query,createdAt:clock.isoTime}]},[],provider,{mode:'auto',signal:AbortSignal.timeout(120000),clock:()=>clock,search:async()=>evidence,onUpdate(){},onActivity(){}});
    console.log(JSON.stringify({query,evidence,answer:result.text,retryable:result.retryable}));
    expect(result.retryable).toBe(false); expect(result.text).not.toMatch(/publication date|couldn't validate/i); expect(result.text).not.toContain('extractive summary');
    if (/Celsius/i.test(query)) expect(result.text).toContain('°C');
    if (/Waxahachie/i.test(query)) expect(result.text).toContain('Waxahachie');
    if (/Oklahoma City.*weather|weather.*Oklahoma City/i.test(query)) expect(result.text).toContain('Oklahoma City');
  },150000);
}

for (const [query,expected] of [['What is the capital of Oklahoma?','Oklahoma City'],['If I drive 180 miles at 60 mph, how long will it take?','3 hours'],['What is the weather in Tulsa right now?','Tulsa'],['what is the weather in Tulsa,ok supposed to be today?','Tulsa']] as const) {
  it.skipIf(!enabled)(`owner routing example: ${query}`,async()=>{
    const provider=new OllamaChatProvider(); await provider.prepare(()=>{});
    const clock=deviceContext(); let searched=false;
    const result=await answerConversation({id:'routing',title:query,messages:[{id:'q',role:'user',text:query,createdAt:clock.isoTime}]},[],provider,{mode:'auto',signal:AbortSignal.timeout(120000),clock:()=>clock,search:async(...args)=>{
      searched=true;
      const response=await fetch('http://127.0.0.1:4173/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:args[0],kind:'web',today:false,day:clock.localDate,timeZone:clock.timeZone})});
      expect(response.ok).toBe(true); return response.json();
    },onUpdate(){},onActivity(){}});
    console.log(JSON.stringify({query,answer:result.text,searched}));
    expect(result.text).toContain(expected); if (/supposed to be/.test(query)) expect(result.text).toMatch(/high/i); expect(searched).toBe(/weather/i.test(query)); expect(!!result.evidence).toBe(/weather/i.test(query)); expect(result.text).not.toMatch(/\[\d+\]|publication|couldn't validate|not independently verified/i);
  },150000);
}

it.skipIf(!enabled)('keeps the Trump subject and cached article through offline follow-ups after reload',async()=>{
  const provider=new OllamaChatProvider();await provider.prepare(()=>{});const clock=deviceContext();let searches=0;let reads=0;
  const e:SearchEvidence={query:'fixture news',provider:'Test fixture, not real news',scope:'recent',timeZone:clock.timeZone,fetchedAt:clock.isoTime,sources:[{title:'TEST FIXTURE: What Trump Has Built',url:'https://example.org/test-fixture',excerpt:'Test fixture: Trump built a coalition of voters and allies.',article:{status:'retrieved',text:'This is synthetic test data, not actual reporting. In this fixture, Trump built a coalition of voters and allies. The interview describes organizing those supporters.',fetchedAt:clock.isoTime,url:'https://example.org/test-fixture'}}]};
  let c={id:'follow-up',title:'fixture',messages:[{id:'first',role:'assistant' as const,text:'The interview What Trump Has Built describes Trump. A prior answer mistakenly called the subject J.D. Vance.',createdAt:clock.isoTime,evidence:e},{id:'q',role:'user' as const,text:'what was the main thing the article pointed out that he built?',createdAt:clock.isoTime}]};
  const options={mode:'off' as const,signal:AbortSignal.timeout(120000),clock:()=>clock,search:async()=>{searches++;return e;},readArticle:async(source:SearchEvidence['sources'][number])=>{reads++;return source;},onUpdate(){},onActivity(){}};
  const result=await answerConversation(c,[],provider,options);console.log(JSON.stringify({followup:result.text,searches,reads}));expect(result.text).toMatch(/coalition|voters|allies/i);expect(result.text).not.toMatch(/Vance|cannot access|do not have access/i);
  c=JSON.parse(JSON.stringify({...c,messages:[...c.messages,{id:'a',role:'assistant',text:result.text,evidence:result.evidence,createdAt:clock.isoTime},{id:'q2',role:'user',text:'what did it say?',createdAt:clock.isoTime}]}));
  const next=await answerConversation(c,[],provider,options);console.log(JSON.stringify({chained:next.text,searches,reads}));expect(next.text).toMatch(/coalition|supporters|voters|allies/i);expect(next.text).not.toMatch(/Vance|cannot access|do not have access/i);expect(searches).toBe(0);expect(reads).toBe(0);
},150000);
it.skipIf(!enabled)('reads a real public article then reuses cached content offline without another search',async()=>{
  const url='https://science.nasa.gov/earth/facts/';const clock=deviceContext();const provider=new OllamaChatProvider();await provider.prepare(()=>{});
  const question=`Read this NASA article and give me one fact: ${url}`;
  const c={id:'nasa',title:'Earth',messages:[{id:'q',role:'user' as const,text:question,createdAt:clock.isoTime}]};
  let searches=0;let reads=0;
  const result=await answerConversation(c,[],provider,{mode:'auto',signal:AbortSignal.timeout(120000),onUpdate(){},onActivity(){},search:async()=>{searches++;throw new Error('Must not search');},readArticle:async source=>{
    reads++;const response=await fetch('http://127.0.0.1:4173/api/article',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source.url})});expect(response.ok).toBe(true);return {...source,article:await response.json()};
  }});
  const article=result.evidence!.sources[0].article!;expect(article.status,JSON.stringify(article)).toBe('retrieved');expect(article.text!.length).toBeGreaterThan(500);
  const restored=JSON.parse(JSON.stringify({...c,messages:[...c.messages,{id:'a',role:'assistant',text:result.text,evidence:result.evidence,createdAt:clock.isoTime},{id:'next',role:'user',text:'What did the article say about Earth? Give me one fact.',createdAt:clock.isoTime}]}));
  const next=await answerConversation(restored,[],provider,{mode:'off',signal:AbortSignal.timeout(120000),onUpdate(){},onActivity(){},search:async()=>{throw new Error('Must not search');},readArticle:async()=>{throw new Error('Must use saved text');}});
  console.log(JSON.stringify({articleStatus:article.status,articleCharacters:article.text!.length,first:result.text,followup:next.text,searches,reads}));expect(next.text).toMatch(/Earth/i);expect(next.text).not.toMatch(/cannot access|do not have access/i);expect(searches).toBe(0);expect(reads).toBe(1);
},150000);
