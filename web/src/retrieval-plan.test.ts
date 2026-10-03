import {describe,it,expect,vi} from 'vitest';
import {parseRetrievalPlan,planRetrieval} from './retrieval-plan';
import {isSuppliedArithmetic} from './search';
import {answerConversation} from './chat-service';
import {deviceContext} from './device-context';
import type {ChatProvider,ChatRequest} from './provider';
const clock=()=>deviceContext(new Date('2026-10-03T01:00:00Z'),'America/Chicago');
const c=(text:string)=>({id:'c',title:'test',messages:[{id:'q',role:'user' as const,text,createdAt:''}]});
describe('semantic retrieval planning',()=>{
 it('requires valid decisions and bounded queries',()=>{
  expect(parseRetrievalPlan('{"retrieve":false,"queries":[],"terms":[]}').retrieve).toBe(false);
  expect(()=>parseRetrievalPlan('{"retrieve":true,"queries":[],"terms":[]}')).toThrow();
  expect(()=>parseRetrievalPlan('{"retrieve":"yes","queries":[],"terms":[]}')).toThrow();
 });
 it('routes an arbitrary intent the lexical detector does not know, before summarizing evidence',async()=>{
  const plan={retrieve:true,queries:['subject keyword request'],terms:['subject']};
  const planner=vi.fn(async()=>plan), generate=vi.fn(async()=> 'Retrieved conversational answer.');
  const search=vi.fn(async()=>({query:'subject',provider:'fixture',fetchedAt:clock().isoTime,timeZone:'America/Chicago',scope:'web' as const,sources:[{title:'subject',url:'https://example.org/subject',excerpt:'Supported detail.'}]}));
  await answerConversation(c('Can you check the external situation for me?'),[{id:'note',text:'private personal note'}],{planRetrieval:planner,generate} as unknown as ChatProvider,{mode:'auto',clock,signal:new AbortController().signal,search,onUpdate(){},onActivity(){}});
  expect(planner).toHaveBeenCalledExactlyOnceWith('Can you check the external situation for me?',clock(),expect.any(AbortSignal));
  expect(search.mock.calls[0]).toHaveLength(6);
  expect(search.mock.invocationCallOrder[0]).toBeLessThan(generate.mock.invocationCallOrder[0]);
  expect(generate.mock.calls[0]).toHaveLength(3);
 });
 it('keeps stable local decisions local and skips the planner in Off mode and for supplied arithmetic',async()=>{
  const planner=vi.fn(async()=>({retrieve:false,queries:[],terms:[]}));
  const generate=vi.fn(async()=> 'Local reply'),search=vi.fn();
  const provider={planRetrieval:planner,generate} as unknown as ChatProvider;
  const opts={mode:'auto' as const,clock,signal:new AbortController().signal,search,onUpdate(){},onActivity(){}};
  await answerConversation(c('Write a limerick about a cat'),[],provider,opts);
  expect(planner).toHaveBeenCalledOnce();expect(search).not.toHaveBeenCalled();
  await answerConversation(c('Write a poem'),[],provider,{...opts,mode:'off'});
  await answerConversation(c('Calculate 25% of 120'),[],provider,opts);
  expect(planner).toHaveBeenCalledOnce();expect(search).not.toHaveBeenCalled();
 });
 it('never streams planner JSON or sends saved notes to the planner',async()=>{
  const generate=vi.fn(async(_request:ChatRequest)=>'{"retrieve":true,"queries":["subject"],"terms":["subject"]}');
  const p=await planRetrieval({generate} as unknown as ChatProvider,'Current user question',clock(),new AbortController().signal);
  expect(p.retrieve).toBe(true);expect(generate.mock.calls[0][0]).toMatchObject({prompt:'Current user question',responseKind:'retrieval-plan'});
 });
 it('cancels before answering if planning is interrupted',async()=>{
  const abort=new AbortController();const generate=vi.fn();
  const planner=vi.fn(async()=>{abort.abort();throw new DOMException('Stopped','AbortError');});
  await expect(answerConversation(c('External facts?'),[],{planRetrieval:planner,generate} as unknown as ChatProvider,{mode:'auto',signal:abort.signal,onUpdate(){},onActivity(){}})).rejects.toMatchObject({name:'AbortError'});
  expect(generate).not.toHaveBeenCalled();
 });
});

it('recovers a false-negative plan when local inference requests live access',async()=>{
 const planner=vi.fn(async()=>({retrieve:false,queries:[],terms:[]}));
 const generate=vi.fn().mockResolvedValueOnce("I don't have real-time access to answer that.").mockResolvedValueOnce('The retrieved source describes the requested update.');
 const search=vi.fn(async()=>({query:'external',provider:'fixture',fetchedAt:clock().isoTime,timeZone:'America/Chicago',scope:'web' as const,sources:[{title:'External update',url:'https://example.org/update',excerpt:'A supported external update.'}]}));
 const result=await answerConversation(c('Could you check that situation for me?'),[],{planRetrieval:planner,generate} as unknown as ChatProvider,{mode:'auto',clock,signal:new AbortController().signal,search,onUpdate(){},onActivity(){}});
 expect(search).toHaveBeenCalledOnce();expect(generate).toHaveBeenCalledTimes(2);
 expect(generate.mock.calls[1][0].evidence).toBe(result.evidence);expect(result.text).toContain('retrieved source');
});
it('never escalates a capability refusal into a network request while offline',async()=>{
 vi.stubGlobal('navigator',{onLine:false});
 try {
  const search=vi.fn();const planner=vi.fn();const generate=vi.fn(async()=>"I don't have live access.");
  await answerConversation(c('An unspecified situation?'),[],{planRetrieval:planner,generate} as unknown as ChatProvider,{mode:'auto',clock,signal:new AbortController().signal,search,onUpdate(){},onActivity(){}});
  expect(search).not.toHaveBeenCalled();expect(planner).not.toHaveBeenCalled();
 } finally {vi.unstubAllGlobals();}
});

it('retrieves on an unknown planner decision instead of silently disabling Auto',async()=>{
 const planner=vi.fn(async()=>{throw new Error('Invalid model JSON');});
 const generate=vi.fn(async(_request:ChatRequest)=> 'Supported answer.');
 const search=vi.fn(async()=>({query:'external',provider:'fixture',fetchedAt:clock().isoTime,timeZone:'America/Chicago',scope:'web' as const,sources:[{title:'External update',url:'https://example.org/update',excerpt:'Supported answer.'}]}));
 const result=await answerConversation(c('Could you check that situation for me?'),[],{planRetrieval:planner,generate} as unknown as ChatProvider,{mode:'auto',clock,signal:new AbortController().signal,search,onUpdate(){},onActivity(){}});
 expect(search).toHaveBeenCalledOnce();expect(generate.mock.calls[0][0].evidence).toBe(result.evidence);
});

it('does not mistake model identifiers for arithmetic operands',()=>{
 expect(isSuppliedArithmetic('Discounts on HX-900Z5 headphones?')).toBe(false);
 expect(isSuppliedArithmetic('Calculate a 10 percent discount on 250.')).toBe(true);
 expect(isSuppliedArithmetic('Calculate 25% of 120')).toBe(true);
});

it('preserves semantic shopping intent without requiring a specific retailer or wording',()=>{
 expect(parseRetrievalPlan('{"retrieve":true,"kind":"web","intent":"sale-event","queries":["retailer promotion announcements"],"terms":["retailer"]}').intent).toBe('sale-event');
});

it('repairs a mistaken sale-event classification for an explicit product discount request',async()=>{
 const generate=vi.fn(async()=>'{"retrieve":true,"kind":"web","intent":"sale-event","queries":["Example headphones sale"],"terms":["Example"]}');
 const plan=await planRetrieval({generate} as unknown as ChatProvider,'Are Example headphones on sale now?',clock(),new AbortController().signal);
 expect(plan.intent).toBe('product-price');
});
