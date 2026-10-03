import {it,expect} from 'vitest';
import {extractArticle} from '../scripts/article-service.mjs';
import {readWebArticles,relevantWebSource,rankWebSources} from '../scripts/search-service.mjs';
import {gateCurrentPrices,requiresCurrentPrice} from '../scripts/price-evidence.mjs';
const fetchedAt='2026-10-03T06:00:00Z';
const evidence=source=>({query:'ExampleBrand HX-900Z5 current price right now',fetchedAt,sources:[source]});
const body='<p>'+ 'Product information. '.repeat(30)+'</p>';
const schema=type=>`<script type="application/ld+json">${JSON.stringify({'@type':type,name:'ExampleBrand HX-900Z5',datePublished:'2026-01-12',offers:{price:'318.95',priceCurrency:'USD'}})}</script>`;
it('rejects old and undated editorial prices even with fresh retrieval timestamps and Product markup',()=>{
 for(const published of ['', '<meta property="article:published_time" content="2026-01-12T12:00:00Z">']) {
  const article=extractArticle(`<head>${published}${schema('NewsArticle')}${schema('Product')}</head><body>${body}</body>`,'https://publisher.example/shop/reported-deal');
  const result=gateCurrentPrices(evidence({title:'Reported price $318.95',url:'https://publisher.example/shop/reported-deal',excerpt:'Price is $318.95',article:{...article,fetchedAt}}));
  expect(result.currentPrice.status).toBe('unverified');expect(result.currentPrice.facts).toEqual([]);
  expect(JSON.stringify(result.sources.map(s=>s.excerpt))).not.toContain('318.95');
 }
});
it('accepts a retrieved merchant listing and excludes unrelated model variants',()=>{
 const article=extractArticle(`<head>${schema('Product')}</head><body>${body}</body>`,'https://examplebrand.com/shop/item');
 article.offers.push({name:'ExampleBrand HX-800Z4',price:'100',currency:'USD'});
 const result=gateCurrentPrices(evidence({title:'Product',url:'https://examplebrand.com/shop/item',excerpt:'Old guide price $200',article:{...article,fetchedAt}}));
 expect(result.currentPrice.status).toBe('verified-live');expect(result.currentPrice.facts).toHaveLength(1);
 expect(result.sources[0].excerpt).toContain('318.95');expect(result.sources[0].excerpt).not.toContain('$200');
});
it('does not treat an expired offer or unreadable seller page as current evidence',()=>{
 const expired=schema('Product').replace('"priceCurrency":"USD"','"priceCurrency":"USD","priceValidUntil":"2025-01-01"');
 const article=extractArticle(`<head>${expired}</head><body>${body}</body>`,'https://examplebrand.com/shop/item');
 for(const candidate of [{...article,fetchedAt},{status:'restricted',text:'Product price $318.95'}]) {
  expect(gateCurrentPrices(evidence({title:'Product',url:'https://examplebrand.com/shop/item',excerpt:'Price $318.95',article:candidate})).currentPrice.status).toBe('unverified');
 }
});
it('preserves sale-date research and historical pricing while requiring fresh buying evidence',()=>{
 expect(requiresCurrentPrice('When is ExampleShop having its sale this October?')).toBe(false);
 expect(requiresCurrentPrice('What was the price last year?')).toBe(false);
 expect(requiresCurrentPrice('Is this product on sale now?')).toBe(true);
 expect(requiresCurrentPrice('What is the current price?')).toBe(true);
});

it('rejects cached merchant content even if the search result was just fetched',()=>{
 const article=extractArticle(`<head>${schema('Product')}</head><body>${body}</body>`,'https://examplebrand.com/shop/item');
 expect(gateCurrentPrices(evidence({title:'Product',url:'https://examplebrand.com/shop/item',excerpt:'Price',article:{...article,fetchedAt:'2026-01-12T00:00:00Z'}})).currentPrice.status).toBe('unverified');
});

it('preserves genuine product listings with embedded customer reviews',()=>{
 const data={'@type':'Product',name:'ExampleBrand HX-900Z5',offers:{price:'420',priceCurrency:'USD'},review:{'@type':'Review',reviewBody:'Customer experience'}};
 const article=extractArticle(`<script type="application/ld+json">${JSON.stringify(data)}</script><body>${body}</body>`,'https://examplebrand.com/shop/item');
 expect(gateCurrentPrices(evidence({title:'Product',url:'https://examplebrand.com/shop/item',excerpt:'Price',article:{...article,fetchedAt}})).currentPrice.status).toBe('verified-live');
});

it('reads merchant family starting prices without inventing an exact configuration',()=>{
 const data={'@type':'Product',name:'Example Notebook',offers:{'@type':'AggregateOffer',lowPrice:899,highPrice:2499,priceCurrency:'USD'}};
 const article=extractArticle(`<script type="application/ld+json">${JSON.stringify(data)}</script><body>${body}</body>`,'https://shop.example/shop/notebook');
 const result=gateCurrentPrices({query:'How much is Example Notebook right now?',fetchedAt,sources:[{title:'Notebook',url:'https://shop.example/shop/notebook',excerpt:'Notebook',article:{...article,fetchedAt}}]});
 expect(result.currentPrice.status).toBe('verified-live');expect(result.currentPrice.facts[0]).toMatchObject({price:'899',priceKind:'starting-at'});
});
it('does not verify another sellers price on a tracker even with Product/Offer markup',()=>{
 const data={'@type':'Product',name:'ExampleBrand HX-900Z5',offers:{price:234,priceCurrency:'USD',offeredBy:{name:'another-shop.example'}}};
 const article=extractArticle(`<script type="application/ld+json">${JSON.stringify(data)}</script><body>${body}</body>`,'https://tracker.example/p/product');
 expect(gateCurrentPrices(evidence({title:'Product',url:'https://tracker.example/p/product',excerpt:'Price',article:{...article,fetchedAt}})).currentPrice.status).toBe('unverified');
});
it('distinguishes general sale events from product discounts, including without a date question',()=>{
 for(const q of ['Does ExampleShop have any big sales this weekend?', 'Is ExampleShop holding a summer sale?', 'Any major sale events at ExampleShop?'])expect(requiresCurrentPrice(q,'sale-event')).toBe(false);
 expect(requiresCurrentPrice('Any bargains at ExampleShop?','sale-event')).toBe(false);
 expect(requiresCurrentPrice('What is the current price of Example earbuds?','sale-event')).toBe(true);
 expect(requiresCurrentPrice('Are Example earbuds discounted?','product-price')).toBe(true);
 expect(requiresCurrentPrice('Are Example earbuds on sale now?','product-price')).toBe(true);
 expect(requiresCurrentPrice('Are Example earbuds on sale now?','sale-event')).toBe(true);
});

it('keeps relevant storefronts even when their search snippets omit the price',()=>{
 const request={query:'How much is Example Notebook right now?',kind:'web',day:'2026-10-03'};
 const store={title:'Buy Example Notebook',url:'https://maker.example/shop/notebook',excerpt:'Choose your notebook configuration.'};
 expect(relevantWebSource(store,request,'Example Notebook price')).toBe(true);
 expect(rankWebSources([{title:'Example Notebook deals',url:'https://publisher.example/deals/notebook',excerpt:'Price $799'},store],request,'Example Notebook price')[0]).toBe(store);
});
it('finishes a simple price read once its preferred store is verified, cancels slow reads, and waits for comparisons',async()=>{
 const sources=[{title:'Example Notebook',url:'https://maker.example/shop/notebook',excerpt:'Notebook'},{title:'Other Notebook',url:'https://other.example/product/notebook',excerpt:'Notebook'}];
 let cancelled=false;
 const read=async(url,signal)=>url.includes('maker.example') ? {status:'retrieved',pageKind:'merchant',fetchedAt,offers:[{name:'Example Notebook',price:'899',currency:'USD'}]} : new Promise(resolve=>signal.addEventListener('abort',()=>{cancelled=true;resolve({status:'unavailable',fetchedAt});}));
 const result=await readWebArticles(sources,{query:'Example Notebook current price'},new AbortController().signal,new Date(fetchedAt),read);
 expect(result[0].article.offers[0].price).toBe('899');expect(cancelled).toBe(true);
 let count=0;
 await readWebArticles(sources,{query:'Compare Example Notebook prices'},new AbortController().signal,new Date(fetchedAt),async()=>{count++;return {status:'unavailable',fetchedAt};});
 expect(count).toBe(2);
});
it('continues reading fallback listings when the preferred store cannot verify a price',async()=>{
 const sources=[{title:'Notebook',url:'https://maker.example/shop/notebook',excerpt:'Notebook'},{title:'Notebook',url:'https://seller.example/product/notebook',excerpt:'Notebook'}];
 const result=await readWebArticles(sources,{query:'Notebook current price'},new AbortController().signal,new Date(fetchedAt),async url=>url.includes('maker')?{status:'restricted',fetchedAt}:{status:'retrieved',pageKind:'merchant',offers:[{name:'Notebook',price:'800',currency:'USD'}],fetchedAt});
 expect(result[1].article.offers[0].price).toBe('800');
});

it('can finish on a readable official announcement for the requested month, but preserves fallback on mismatch',async()=>{
 const sources=[{title:'ExampleShop sale announcement',url:'https://exampleshop.example/news/sale',excerpt:'October sale dates'},{title:'Other reporting',url:'https://publisher.example/news',excerpt:'Sale coverage'}];
 let cancelled=false;
 const result=await readWebArticles(sources,{query:'Is ExampleShop having sales this month?',day:'2026-10-03',retrievalIntent:'sale-event'},new AbortController().signal,new Date(fetchedAt),async(url,signal)=>url.includes('exampleshop')?{status:'retrieved',pageTitle:'October 2026 sale',text:'Our sale starts on the sixth.',fetchedAt}:new Promise(resolve=>signal.addEventListener('abort',()=>{cancelled=true;resolve({status:'unavailable',fetchedAt});})));
 expect(result).toHaveLength(1);expect(cancelled).toBe(true);
 let completed=0;
 const fallback=await readWebArticles(sources,{query:'Is ExampleShop having sales this month?',day:'2026-10-03',retrievalIntent:'sale-event'},new AbortController().signal,new Date(fetchedAt),async()=>{completed++;return {status:'retrieved',text:'Our July 2025 event.',fetchedAt};});
 expect(completed).toBe(2);expect(fallback).toHaveLength(2);
});

it('rejects aggregate comparison prices sourced from other sellers and malformed currency precision',()=>{
 for(const offer of [
  {'@type':'AggregateOffer',lowPrice:382.95,highPrice:649,priceCurrency:'USD',offers:[{'@type':'Offer',price:382.95,priceCurrency:'USD',seller:{name:'different-shop.example'}}]},
  {'@type':'Offer',price:3.81956,priceCurrency:'USD'}
 ]) {
  const data={'@type':'Product',name:'ExampleBrand HX-900Z5',offers:offer};
  const article=extractArticle(`<script type="application/ld+json">${JSON.stringify(data)}</script><body>${body}</body>`,'https://comparison.example/products/headphones');
  expect(gateCurrentPrices(evidence({title:'Product',url:'https://comparison.example/products/headphones',excerpt:'Price',article:{...article,fetchedAt}})).currentPrice.status).toBe('unverified');
 }
});
