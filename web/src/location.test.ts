import type { searchInternet } from './search';
import { describe,it,expect,vi } from 'vitest';
import { statedLocation, resolveLocation, locatedQuery, localRequest, explicitPlace } from './location';
import { BrowserLocationProvider } from './browser-location';
import { answerConversation } from './chat-service';
import { deviceContext } from './device-context';
import { systemInstructions } from './inference-context';
import type { Conversation } from './types';
import type { ChatProvider } from './provider';
const signal = () => new AbortController().signal;
const chat = (...texts:string[]):Conversation => ({id:'c',title:'c',messages:texts.map((text,i)=>({id:String(i),role:'user',text,createdAt:''}))});
function setup() {
 const search = vi.fn(async (..._args:Parameters<typeof searchInternet>) => ({query:'fixture',provider:'fixture',scope:'weather' as const,timeZone:'America/Chicago',fetchedAt:'',sources:[{title:'Tulsa',url:'https://example.org/weather',excerpt:'Tulsa 70°F.'}]}));
 const generate = vi.fn(async () => 'Tulsa is 70°F.');
 return {search,generate,provider:{generate} as unknown as ChatProvider,options:{mode:'auto' as const,clock:()=>deviceContext(new Date(),'America/Chicago'),search,onUpdate:vi.fn(),onActivity:vi.fn(),signal:signal()}};
}
describe('location context and user control',()=>{
 it('reads user statements only, reuses the latest city, and never uses the clock zone',async()=>{
  expect(statedLocation('I’m in Tulsa, OK.')).toBe('Tulsa, OK');
  expect(statedLocation('I live in Boston, MA')).toBe('Boston, MA');
  expect(statedLocation('I am in trouble')).toBeUndefined();
  expect(await resolveLocation(chat('I’m in Tulsa, OK','I am now in Austin, TX'),[],'',undefined,signal())).toMatchObject({place:'Austin, TX',source:'conversation'});
  const s=setup();await answerConversation(chat("What's the weather outside?"),[],s.provider,s.options);
  expect(s.options.onUpdate).toHaveBeenCalledWith(expect.stringContaining('What city'));expect(s.search).not.toHaveBeenCalled();expect(s.generate).not.toHaveBeenCalled();
  expect(systemInstructions({prompt:''})).toContain('America/Chicago is a clock zone');
 });
 it('reuses manually stated location for weather and nearby requests; explicit cities override context',async()=>{
  for(const q of ["What's the weather outside?",'Will it rain here today?','Find nearby coffee shops','What restaurants are near me?']) {
   const s=setup();await answerConversation(chat('I’m in Tulsa, OK',q),[],s.provider,s.options);
   expect(s.search.mock.calls[0][0]).toContain('Tulsa, OK');expect(s.generate).toHaveBeenCalledOnce();
  }
  const s=setup();await answerConversation(chat('I’m in Tulsa, OK','What is the weather in Boston, MA?'),[],s.provider,s.options);
  expect(s.search.mock.calls[0][0]).toBe('What is the weather in Boston, MA?');
  expect(locatedQuery('Find coffee shops near me. Give me a short answer.',{source:'saved',place:'Tulsa, OK'})).toBe('Find coffee shops nearby in Tulsa, OK');
  expect(localRequest('How does weather forecasting work?')).toBe(false);
  expect(explicitPlace('Tulsa weather right now')).toBe(true);
 });
 it('uses saved memory across chats and manual settings after restart; denied auto falls back',async()=>{
  const denied={current:vi.fn(async()=>undefined)};
  expect(await resolveLocation(chat('weather outside'),[{id:'m',text:'Remember this: I live in Tulsa, OK'}],'',denied,signal())).toMatchObject({place:'Tulsa, OK'});
  expect(await resolveLocation(chat('weather outside'),[],'Tulsa, OK',denied,signal())).toMatchObject({place:'Tulsa, OK'});
  expect(await resolveLocation(chat('weather outside'),[],'',denied,signal())).toBeUndefined();
  expect(await resolveLocation(chat('weather outside'),[],'Tulsa, OK',{current:async()=>{throw new Error('Permission denied');}},signal())).toMatchObject({place:'Tulsa, OK'});
 });
 it('passes permitted approximate device coordinates only for implicit location requests',async()=>{
  const locationProvider={current:vi.fn(async()=>({latitude:36.15,longitude:-95.99}))};
  const s=setup();await answerConversation(chat("What's the weather outside?"),[],s.provider,{...s.options,locationProvider});
  expect(s.search.mock.calls[0][4]).toEqual({latitude:36.15,longitude:-95.99});
  expect(locatedQuery('Find nearby cafes',{source:'device',coordinates:{latitude:36.15,longitude:-95.99}})).toContain('latitude 36.15');
  for(const q of ['What is the capital of Oklahoma?','What is the weather in Tulsa, OK?']){
   const t=setup();locationProvider.current.mockClear();await answerConversation(chat(q),[],t.provider,{...t.options,locationProvider});expect(locationProvider.current).not.toHaveBeenCalled();
  }
 });
 it('does not send private notes beyond the selected location',async()=>{
  const s=setup();await answerConversation(chat('Weather outside?'),[{id:'a',text:'I live in Tulsa, OK'},{id:'b',text:'secret number 8531'}],s.provider,s.options);
  expect(s.search.mock.calls[0][0]).toContain('Tulsa, OK');expect(s.search.mock.calls[0][0]).not.toContain('8531');
 });
});
describe('foreground browser adapter',()=>{
 const permissions=(state:string)=>({query:vi.fn(async()=>({state}))}) as unknown as Permissions;
 const geo=(success=true)=>({getCurrentPosition:vi.fn((ok:PositionCallback,no:PositionErrorCallback)=>success?ok({coords:{latitude:36.1539,longitude:-95.9928}} as GeolocationPosition):no({code:1} as GeolocationPositionError))}) as unknown as Geolocation;
 it('never prompts unless the user opts in; handles granted, denied and unavailable',async()=>{
  const g=geo();expect(await new BrowserLocationProvider(g,permissions('prompt'),()=>true,()=>true).current(signal())).toBeUndefined();expect(g.getCurrentPosition).not.toHaveBeenCalled();
  expect(await new BrowserLocationProvider(g,permissions('prompt'),()=>true,()=>true).current(signal(),true)).toEqual({latitude:36.15,longitude:-95.99});
  expect(g.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function),expect.any(Function),{enableHighAccuracy:false,maximumAge:60000,timeout:45000});
  expect(await new BrowserLocationProvider(geo(false),permissions('granted'),()=>true,()=>true).current(signal())).toBeUndefined();
  expect(await new BrowserLocationProvider(g,permissions('denied'),()=>true,()=>true).current(signal())).toBeUndefined();
 });
 it('does not access location in the background/insecure context; supports cancellation',async()=>{
  const g=geo();expect(await new BrowserLocationProvider(g,permissions('granted'),()=>false,()=>true).current(signal(),true)).toBeUndefined();
  expect(await new BrowserLocationProvider(g,permissions('granted'),()=>true,()=>false).current(signal(),true)).toBeUndefined();expect(g.getCurrentPosition).not.toHaveBeenCalled();
  const controller=new AbortController();const slow={getCurrentPosition:vi.fn()} as unknown as Geolocation;
  const pending=new BrowserLocationProvider(slow,permissions('granted'),()=>true,()=>true).current(controller.signal,true);controller.abort();await expect(pending).rejects.toThrow();
 });
});

describe('owner real-Mac location failure regressions',()=>{
 it('honors persisted user opt-in across adapter restart when permission-status querying is unsupported',async()=>{
  const geo={getCurrentPosition:vi.fn((ok:PositionCallback)=>ok({coords:{latitude:36.15,longitude:-95.99}} as GeolocationPosition))} as unknown as Geolocation;
  const permissions={query:async()=>{throw new Error('Unsupported');}} as unknown as Permissions;
  const adapter=new BrowserLocationProvider(geo,permissions,()=>true,()=>true,()=>{},()=>true);
  expect(await adapter.current(signal())).toEqual({latitude:36.15,longitude:-95.99});
 });
 it('routes direct location questions without a model or web search and answers saved fallback offline',async()=>{
  for(const q of ['Where am I?','What is my current location?','What’s my location?','What city am I in?']){
   const s=setup();const result=await answerConversation(chat(q),[],s.provider,{...s.options,mode:'off',manualLocation:'Tulsa, OK'});
   expect(result.text).toBe('Your saved location is Tulsa, OK.');expect(s.generate).not.toHaveBeenCalled();expect(s.search).not.toHaveBeenCalled();
  }
 });
 it('converts received coordinates into a direct city answer and falls back when conversion fails',async()=>{
  const locationProvider={current:vi.fn(async()=>({latitude:36.15,longitude:-95.99}))};
  const lookupCity=vi.fn(async()=> 'Tulsa, OK');const s=setup();
  const result=await answerConversation(chat('Where am I?'),[],s.provider,{...s.options,locationProvider,lookupCity});
  expect(result.text).toBe('Your device location resolves to Tulsa, OK.');expect(lookupCity).toHaveBeenCalledWith({latitude:36.15,longitude:-95.99},s.options.signal);expect(s.search).not.toHaveBeenCalled();
  for(const q of ['Where am I?',"What's the weather outside?",'Find coffee shops near me']){
   const t=setup();const r=await answerConversation(chat(q),[],t.provider,{...t.options,manualLocation:'Tulsa, OK',locationProvider,lookupCity:async()=>{throw new Error('Lookup unavailable');}});
   if(q==='Where am I?') expect(r.text).toBe('Your saved location is Tulsa, OK.');else {expect(t.search.mock.calls[0][0]).toContain('Tulsa, OK');expect(t.search.mock.calls[0][4]).toBeUndefined();}
  }
 });
 it('reuses a real successful callback within the session even when Permissions API is unsupported or says prompt',async()=>{
  for(const state of ['prompt','unsupported']){
   const geo={getCurrentPosition:vi.fn((ok:PositionCallback)=>ok({coords:{latitude:36.1539,longitude:-95.9928}} as GeolocationPosition))} as unknown as Geolocation;
   const permissions={query:async()=>{if(state==='unsupported') throw new Error('Not supported');return {state};}} as unknown as Permissions;
   const report=vi.fn();const adapter=new BrowserLocationProvider(geo,permissions,()=>true,()=>true,report);
   expect(await adapter.current(signal())).toBeUndefined();
   expect(await adapter.current(signal(),true)).toEqual({latitude:36.15,longitude:-95.99});
   expect(await adapter.current(signal())).toEqual({latitude:36.15,longitude:-95.99});
   expect(report).toHaveBeenCalledWith(expect.stringContaining('Device coordinates received'));
  }
 });
});
