import type { SearchEvidence } from './search';
// Guard structured forecast facts after local synthesis, independent of question wording.
export function forecastFacts(evidence?: SearchEvidence) {
 if(evidence?.scope !== 'weather') return;
 const match=evidence.sources[0]?.excerpt.match(/^(.+?): forecast for (\d{4}-\d{2}-\d{2}) \([^)]*\)\. High (-?[\d.]+)(°[CF]); low (-?[\d.]+)°[CF]; chance of precipitation ([\d.]+)%/);
 if(!match) return;
 return {place:match[1],date:match[2],high:+match[3],unit:match[4],low:+match[5],rain:+match[6]};
}
export function validForecastAnswer(text:string,evidence?:SearchEvidence) {
 const facts=forecastFacts(evidence);if(!facts)return true;
 if(/feel|right now|currently|won['’]t rain|will not rain|no rain|will be dry/i.test(text))return false;
 const cleaned=text.replace(/\b\d{4}-\d{2}-\d{2}\b/g,'').replace(/\[\d+\]/g,'');
 const numbers=[...cleaned.matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>+m[0]);
 return numbers.length>0 && numbers.every(n=>[facts.high,facts.low,facts.rain].some(value=>Math.abs(n-value)<=0.55));
}
export function supportedForecastAnswer(evidence:SearchEvidence) {
 const facts=forecastFacts(evidence);if(!facts)throw new Error('No structured forecast');
 return `The forecast for ${facts.place} on ${facts.date} is a high of ${facts.high}${facts.unit} and a low of ${facts.low}${facts.unit}, with a ${facts.rain}% chance of precipitation.`;
}

export function currentWeatherFacts(evidence?:SearchEvidence) {
 if(evidence?.scope!=='weather' || forecastFacts(evidence))return;
 const excerpt=evidence.sources[0]?.excerpt || '';
 const values=excerpt.match(/Temperature (-?[\d.]+)(°[CF]); feels like (-?[\d.]+)°[CF]/);
 if(!values)return;
 return {place:excerpt.split(':')[0],temperature:+values[1],unit:values[2],feelsLike:+values[3],humidity:Number(excerpt.match(/humidity ([\d.]+)%/)?.[1]),wind:Number(excerpt.match(/wind ([\d.]+)/)?.[1])};
}
export function validWeatherAnswer(text:string,evidence:SearchEvidence) {
 if(forecastFacts(evidence))return validForecastAnswer(text,evidence);
 const facts=currentWeatherFacts(evidence);if(!facts)return true;
 if(/tomorrow|next|yesterday|forecast|high|low|rain|snow/i.test(text))return false;
 const numbers=[...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(match=>+match[0]);
 return numbers.length>0 && numbers.every(number=>[facts.temperature,facts.feelsLike,facts.humidity,facts.wind].filter(Number.isFinite).some(value=>Math.abs(value-number)<=0.55));
}
export function supportedWeatherAnswer(evidence:SearchEvidence) {
 if(forecastFacts(evidence))return supportedForecastAnswer(evidence);
 const facts=currentWeatherFacts(evidence);if(!facts)throw new Error('No structured weather');
 return `It is currently ${facts.temperature}${facts.unit} in ${facts.place}, and feels like ${facts.feelsLike}${facts.unit}.`;
}
