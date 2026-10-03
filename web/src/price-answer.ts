import type { SearchEvidence } from './search';
export function validPriceAnswer(text:string,evidence:SearchEvidence) {
 const facts=evidence.currentPrice?.facts || [];
 if(/\b(?:on sale|discount|deal|save)\b/i.test(text) && !facts.some(fact=>fact.saleVerified))return false;
 const models=text.match(/\b[A-Za-z]+-?\d[\w-]*\b/g) || [];
 if(models.some(model=>!facts.some(fact=>fact.name.replace(/\W/g,'').toLowerCase().includes(model.replace(/\W/g,'').toLowerCase()))))return false;
 if(facts.some(fact=>fact.priceKind==='starting-at') && !facts.some(fact=>fact.priceKind!=='starting-at') && !/\b(?:starts? at|starting|from|as low as)\b/i.test(text))return false;
 const amounts=[...text.matchAll(/(?:[$£€]|USD|GBP|EUR)\s*(\d[\d,.]*)/g)].map(match=>+match[1].replace(/,/g,''));
 return amounts.length>0 && amounts.every(amount=>facts.some(fact=>[fact.price,fact.previousPrice].some(value=>value!==undefined && Math.abs(amount-Number(value))<0.005)));
}
export function supportedPriceAnswer(evidence:SearchEvidence) {
 return evidence.currentPrice!.facts.slice(0,2).map(fact=>`${fact.seller} currently lists ${fact.name} ${fact.priceKind==='starting-at'?'starting at':'at'} ${fact.currency} ${fact.price}${fact.previousPrice?` (previously ${fact.currency} ${fact.previousPrice})`:''}.`).join(' ');
}
export function retrievalOutcome(evidence?:SearchEvidence) {
 if(evidence?.currentPrice?.status==='unverified')return 'I searched live sources, but could not verify a current retailer price or active sale.';
 if(evidence?.newsStatus==='no-reports-today')return `I checked live news sources, but found no matching reports published on ${evidence.searchedDay} yet.`;
}
