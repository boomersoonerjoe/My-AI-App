import {it,expect,vi} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {answerConversation} from '../src/chat-service';
import {deviceContext} from '../src/device-context';
import {OllamaChatProvider} from '../src/ollama-provider';
import {searchInternet} from '../src/search';
import {retrieveSearch} from '../scripts/search-service.mjs';
const input=process.env.NHOMEAI_QUESTION_FILE;
const questions=input ? JSON.parse(await readFile(input,'utf8')) : [];
it.skipIf(!input)('routes unseen questions through real retrieval and local Ollama',async()=>{
 const nativeFetch=globalThis.fetch;
 if(process.env.NHOMEAI_USE_LOCAL_API==='1')vi.stubGlobal('fetch',(url,options)=>nativeFetch(typeof url==='string' && url.startsWith('/') ? `http://127.0.0.1:4173${url}` : url,options));
 const provider=new OllamaChatProvider();await provider.prepare(()=>{});
 const reports=[];
 for(const entry of questions){
  const question=typeof entry === 'string' ? entry : entry.question;
  const expectedSearch=typeof entry === 'string' ? true : entry.search !== false;
  const mode=typeof entry === 'string' ? 'auto' : entry.mode || 'auto';
  const started=performance.now(), timings=[];const clock=deviceContext(new Date(),'America/Chicago');const calls=[];let plan,planError;
  const planner=provider.planRetrieval.bind(provider);
  provider.planRetrieval=async(...args)=>{try {plan=await planner(...args);return plan;} catch(error) {planError=String(error);throw error;}};
  let received;
  const generate=provider.generate.bind(provider);
  provider.generate=async(request,...args)=>{if(request.evidence) received=request.evidence;const start=performance.now();try{return await generate(request,...args);}finally{timings.push({stage:request.responseKind || 'answer',ms:Math.round(performance.now()-start)});}};
  let result;
  try { result=await answerConversation({id:'unseen',title:'Unseen',messages:[{id:'q',role:'user',text:question,createdAt:clock.isoTime}]},[],provider,{
   manualLocation:typeof entry === 'string' ? undefined : entry.location,mode,clock:()=>clock,signal:AbortSignal.timeout(180000),onUpdate(){},onActivity(){},
   search:async(query,device,signal,kind,coordinates,searchPlan)=>{
    const start=performance.now();calls.push({query,searchPlan});try {
    if(process.env.NHOMEAI_USE_LOCAL_API==='1')return await searchInternet(query,device,signal,kind,coordinates,searchPlan);
    return await retrieveSearch({query,kind:kind || (searchPlan?.kind === 'news' ? 'news' : (/\bnews|headlines\b/i.test(query)?'news':'web')),today:/\btoday\b/i.test(query),day:device.localDate,timeZone:device.timeZone,...(coordinates?{coordinates}:{}),...(searchPlan?{searchQueries:searchPlan.queries,requiredTerms:searchPlan.terms}:{})},signal);
    } finally {timings.push({stage:'retrieval',ms:Math.round(performance.now()-start)});}
   }
  }); } catch(error) { result={text:'',retryable:true,error:String(error)}; }
  reports.push({question,elapsedMs:Math.round(performance.now()-started),timings,plan,planError,calls,answer:result.text,evidence:result.evidence,error:result.error,retryable:result.retryable,received:!!received,expectedSearch});
  console.log(JSON.stringify({question,plan,answer:result.text,error:result.error,provider:result.evidence?.provider,sources:result.evidence?.sources.map(s=>({title:s.title,url:s.url}))}));
  if(process.env.NHOMEAI_REPORT_FILE)await writeFile(process.env.NHOMEAI_REPORT_FILE,JSON.stringify(reports,null,2));
  provider.planRetrieval=planner;provider.generate=generate;
 }
 vi.unstubAllGlobals();
 for(const report of reports) {
  expect(report.calls.length,report.question).toBe(report.expectedSearch ? 1 : 0);
  const outcomeOnly=report.evidence?.currentPrice?.status==='unverified' || report.evidence?.newsStatus==='no-reports-today';
  expect(report.received,report.question).toBe(report.expectedSearch && !outcomeOnly);
  expect(report.retryable,report.question + ': ' + report.error).toBe(false);
  expect(report.answer,report.question).not.toMatch(/(?:cannot|can't|unable to|do not|don't).{0,35}(?:browse|search|access).{0,15}(?:live|real[- ]time|internet|web)/i);
 }
},1200000);
