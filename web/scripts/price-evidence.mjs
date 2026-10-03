// Current prices require a live merchant listing, never an editorial report.
export function requiresCurrentPrice(query, intent) {
 const explicitPrice=/\b(?:prices?|pricing|costs?|how much)\b/i.test(query);
 if(!explicitPrice && !/\bon sale\b/i.test(query) && intent==='sale-event')return false;
 const shopping=/\b(?:prices?|pricing|costs?|how much|sales?|deals?|discounts?|on sale)\b/i.test(query);
 const eventDate=/\b(?:when|dates?|starts?|begins?|ends?)\b/i.test(query) && !/\b(?:price|pricing|cost|how much)\b/i.test(query);
 const historical=/\b(?:was|were|historical|last year|in 20\d{2})\b/i.test(query) && !/\b(?:right now|currently|current|today|on sale now)\b/i.test(query);
 const generalEvent=intent!=='product-price' && !explicitPrice && /\b(?:having|holding|hosting|running|major|events?|month|year|weekend)\b/i.test(query) && !/\bon sale\b/i.test(query);
 return (shopping || intent==='product-price') && !eventDate && !generalEvent && !historical;
}
export function gateCurrentPrices(evidence) {
 if(!requiresCurrentPrice(evidence.query,evidence.retrievalIntent))return evidence;
 const sources=evidence.sources.filter(source=>source.article?.status==='retrieved' && source.article.pageKind==='merchant' && source.article.offers?.length && Math.abs(Date.parse(source.article.fetchedAt)-Date.parse(evidence.fetchedAt))<=300000);
 const facts=[];
 const models=evidence.query.match(/\b[A-Za-z]+-?\d[\w-]*\b/g) || [];
 const normalized=value=>value.replace(/\W/g,'').toLowerCase();
 for(const source of sources) {
  const offers=source.article.offers.filter(offer=>offer.availability!=='unavailable' && models.every(model=>normalized(offer.name).includes(normalized(model))));
  for(const offer of offers)facts.push({...offer,saleVerified:!!offer.previousPrice && Number(offer.previousPrice)>Number(offer.price),url:source.url,seller:new URL(source.url).hostname});
  source.excerpt=offers.map(offer=>`Product: ${offer.name} | ${offer.priceKind==='starting-at'?'Starting price':'Listed price'}: ${offer.currency} ${offer.price}${offer.previousPrice ? ` | Previous price: ${offer.currency} ${offer.previousPrice}` : ''}`).join('\n');
  source.article={...source.article,text:source.excerpt,productLinks:undefined};
 }
 const verified=sources.filter(source=>source.excerpt);
 return {...evidence,currentPrice:{status:verified.length?'verified-live':'unverified',checkedAt:evidence.fetchedAt,facts},sources:verified.length?verified:evidence.sources.map(source=>({title:source.title,url:source.url,publisher:source.publisher,excerpt:'This source does not verify a current merchant price.'}))};
}
