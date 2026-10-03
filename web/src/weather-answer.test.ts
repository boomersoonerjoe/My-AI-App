import {it,expect} from 'vitest';
import {validForecastAnswer,supportedForecastAnswer,validWeatherAnswer,supportedWeatherAnswer} from './weather-answer';
import type {SearchEvidence} from './search';
const evidence:SearchEvidence={query:'forecast',provider:'fixture',fetchedAt:'',timeZone:'UTC',scope:'weather',sources:[{title:'Forecast',url:'https://example.org/',excerpt:'Example City: forecast for 2026-10-03 (UTC). High 23.4°C; low 11.8°C; chance of precipitation 7%.'}]};
it('validates forecast values and rejects invented current or feels-like conditions',()=>{
 expect(validForecastAnswer('High 23°C, low 12°C, with a 7% rain chance.',evidence)).toBe(true);
 expect(validForecastAnswer('It feels like 23°C tomorrow.',evidence)).toBe(false);
 expect(validForecastAnswer('It is 22°C right now.',evidence)).toBe(false);
 expect(validForecastAnswer('It will not rain; 7% chance.',evidence)).toBe(false);
 expect(validForecastAnswer('A high of 35°C.',evidence)).toBe(false);
 expect(validForecastAnswer(supportedForecastAnswer(evidence),evidence)).toBe(true);
});

it('retries unsupported local synthesis and falls back to the retrieved forecast facts',async()=>{
 const {answerConversation}=await import('./chat-service');
 const {vi}=await import('vitest');
 const provider={generate:vi.fn(async()=> 'It feels like 35°C tomorrow.')};
 const updates:string[]=[];
 const result=await answerConversation({id:'test',title:'Forecast',messages:[{id:'q',role:'user',text:'What is the forecast tomorrow?',createdAt:''}]},[],provider as unknown as import('./provider').ChatProvider,{manualLocation:'Example City',mode:'auto',signal:new AbortController().signal,search:async()=>evidence,onUpdate:text=>updates.push(text),onActivity(){}});
 expect(provider.generate).toHaveBeenCalledTimes(2);
 expect(provider.generate.mock.calls[0]).toHaveLength(3);
 expect(result.text).toBe(supportedForecastAnswer(evidence));
 expect(updates).toEqual([result.text]);
});

it('preserves current readings and rejects invented next-day conditions',()=>{
 const current:SearchEvidence={...evidence,sources:[{title:'Current',url:'https://example.org/',excerpt:'Example City: model-based current weather. Temperature 18.5°C; feels like 17.1°C; humidity 50%; wind 5 km/h.'}]};
 expect(validWeatherAnswer('It is 18.5°C and feels like 17°C.',current)).toBe(true);
 expect(validWeatherAnswer('Wind is 5 km/h and humidity is 50%.',current)).toBe(true);
 expect(validWeatherAnswer('It is 18.5°C. Tomorrow will be 25°C.',current)).toBe(false);
 expect(validWeatherAnswer(supportedWeatherAnswer(current),current)).toBe(true);
});
