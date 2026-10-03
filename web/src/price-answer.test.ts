import {it,expect,vi} from 'vitest';
import {answerConversation} from './chat-service';
import {validPriceAnswer} from './price-answer';
import type {SearchEvidence} from './search';
import type {ChatProvider} from './provider';
const e:SearchEvidence={query:'current price',provider:'fixture',scope:'web',fetchedAt:'',timeZone:'UTC',sources:[{title:'Product',url:'https://store.example/shop/item',excerpt:'Verified listing'}],currentPrice:{status:'verified-live',checkedAt:'',facts:[{name:'Example Device',price:'420',currency:'USD',seller:'store.example'}]}};
it('rejects invented monetary amounts and unverified discount claims',()=>{
 expect(validPriceAnswer('It is $420.',e)).toBe(true);expect(validPriceAnswer('It is $318.95.',e)).toBe(false);expect(validPriceAnswer('On sale for $420.',e)).toBe(false);
});
it('never supplies stale prices to inference when current pricing is unverified',async()=>{
 const generate=vi.fn(async()=> 'Old price $318.95');const updates:string[]=[];
 const result=await answerConversation({id:'q',title:'Test',messages:[{id:'q',role:'user',createdAt:'',text:'What is the current price of Example Device?'}]},[],{generate} as unknown as ChatProvider,{mode:'auto',signal:new AbortController().signal,search:async()=>({...e,currentPrice:{status:'unverified',checkedAt:'',facts:[]}}),onUpdate:text=>updates.push(text),onActivity(){}});
 expect(generate).not.toHaveBeenCalled();expect(result.text).toContain('could not verify');expect(result.text).not.toContain('318.95');expect(result.retryable).toBe(false);
});
it('returns a date-specific checked-news outcome instead of an internet-access failure',async()=>{
 const generate=vi.fn();
 const result=await answerConversation({id:'q',title:'Test',messages:[{id:'q',role:'user',createdAt:'',text:'What happened in Example City today?'}]},[],{generate} as unknown as ChatProvider,{mode:'auto',signal:new AbortController().signal,search:async()=>({...e,scope:'today',sources:[],currentPrice:undefined,newsStatus:'no-reports-today',searchedDay:'2026-10-03'}),onUpdate(){},onActivity(){}});
 expect(generate).not.toHaveBeenCalled();expect(result.text).toContain('2026-10-03');expect(result.retryable).toBe(false);
});

it('does not turn an old supplied article into a verified current price',async()=>{
 const generate=vi.fn();
 const result=await answerConversation({id:'q',title:'Test',messages:[{id:'q',role:'user',createdAt:'',text:'Read https://publisher.example/article and tell me the current price of Example Device.'}]},[],{generate} as unknown as ChatProvider,{mode:'auto',signal:new AbortController().signal,readArticle:async source=>({...source,article:{status:'retrieved',url:source.url,fetchedAt:new Date().toISOString(),pageKind:'editorial',text:'January article reports $318.95.'}}),onUpdate(){},onActivity(){}});
 expect(generate).not.toHaveBeenCalled();expect(result.text).toContain('could not verify');expect(result.text).not.toContain('318.95');
});

it('preserves the qualification on a verified family starting price',()=>{
 const family={...e,currentPrice:{...e.currentPrice!,facts:[{...e.currentPrice!.facts[0],priceKind:'starting-at' as const}]}};
 expect(validPriceAnswer('It costs $420.',family)).toBe(false);
 expect(validPriceAnswer('It starts at $420.',family)).toBe(true);
});
