import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { request as http } from 'node:http';
import { request as https } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { load } from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { publicLink } from './search-service.mjs';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return a > 0 && a < 224 && ![10,127].includes(a) && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0 && [0,2].includes(c))) && !(a === 198 && [18,19].includes(b));
  }
  return isIP(address) === 6 && /^[23]/.test(address) && !/^2001:db8:/i.test(address);
}
export function articleURL(value) {
  const safe = publicLink(value); if (!safe) throw new Error('Invalid article URL');
  const url = new URL(safe);
  if (url.port && !['80','443'].includes(url.port)) throw new Error('Unsupported article port');
  if (isIP(url.hostname) && !publicAddress(url.hostname)) throw new Error('Private article address');
  return url;
}
export function extractArticle(html, url = 'https://example.org/') {
  if (/[\u0000-\u0008\u000e-\u001f\ufffd]/.test(html)) return {status:'unavailable'};
  const $ = load(html);
  const published = $('meta[property="article:published_time"]').attr('content') || $('meta[name="date"]').attr('content') || $('time[datetime]').first().attr('datetime') || $('body').text().match(/\bPublished\s+(\d{1,2}\/\d{1,2}\/20\d{2})/i)?.[1];
  const publishedAt = published && Number.isFinite(Date.parse(published)) && Date.parse(published) <= Date.now()+900000 ? new Date(published).toISOString() : undefined;
  const restricted = $('[class*="paywall"], [id*="paywall"], [class*="subscription-required"]').length > 0 || /subscribe to (?:continue|read)|sign in to read (?:this|the) (?:article|story)/i.test($.text());
  const pageTitle=($('title').text() || $('meta[property="og:title"]').attr('content') || $('h1').first().text()).replace(/\s+/g,' ').trim().slice(0,250);
  const products = [], offers = []; let editorial=false, metadataNodes=0;
  const productLinks=[]; const origin=new URL(url);
  $('a[href]').each((_,node)=>{
    if(productLinks.length>=64)return;
    const title=$(node).text().replace(/\s+/g,' ').trim();
    try {
      const target=new URL($(node).attr('href').trim(),origin);
      if(title.length>=20 && title.length<=200 && target.origin===origin.origin && target.pathname.startsWith(origin.pathname.replace(/\/$/,'')+'/') && !productLinks.some(link=>link.url===target.href)) productLinks.push({title,url:target.href});
    } catch { /* Invalid links are not followed. */ }
  });
  productLinks.sort((a,b)=>a.title.localeCompare(b.title,'en',{numeric:true}));
  const visit = (value, depth=0, insideProduct=false) => {
    if (!value || typeof value !== 'object' || depth > 8) return;
    if(++metadataNodes>5000){editorial=true;return;}
    if (Array.isArray(value)) {value.slice(0,100).forEach(item=>visit(item,depth+1,insideProduct));return;}
    if (!insideProduct && [value['@type']].flat().some(type=>['Article','NewsArticle','BlogPosting','Review'].includes(type))) editorial=true;
    if ([value['@type']].flat().includes('Product') && typeof value.name === 'string') {
      for (const offer of [value.offers].flat().filter(Boolean)) {
        if(products.length>=20)break;
        if (offer.priceValidUntil && Date.parse(offer.priceValidUntil) < Date.now()) continue;
        const aggregate=[offer['@type']].flat().includes('AggregateOffer');
        const price=aggregate?offer.lowPrice:offer.price;
        const belongsHere=seller=>{
          const name=typeof seller==='string'?seller:seller?.name;
          const sellerURL=typeof seller==='object'?seller?.url:undefined;
          if(sellerURL){try {if(new URL(sellerURL,origin).hostname!==origin.hostname)return false;}catch{return false;}}
          const host=origin.hostname.replace(/^www\./,'').split('.')[0].replace(/\W/g,'').toLowerCase();
          return !name || name.replace(/\W/g,'').toLowerCase().includes(host);
        };
        if(aggregate && [offer.offers].flat().filter(Boolean).some(child=>!belongsHere(child.seller || child.offeredBy)))continue;
        const seller=offer.seller || offer.offeredBy;
        if(!belongsHere(seller))continue;
        if(offer.url){try {if(new URL(offer.url,origin).hostname!==origin.hostname)continue;}catch{continue;}}
        if (!/^[A-Z]{3}$/.test(offer.priceCurrency || ''))continue;
        const minorUnits=new Intl.NumberFormat('en',{style:'currency',currency:offer.priceCurrency}).resolvedOptions().maximumFractionDigits;
        if (!(Number(price)>0) || !/^[0-9]+(?:\.[0-9]+)?$/.test(String(price)) || (String(price).split('.')[1] || '').replace(/0+$/,'').length>minorUnits)continue;
        const unavailable=/OutOfStock|SoldOut|Discontinued/i.test(offer.availability || '');
        offers.push({name:value.name.slice(0,160),price:String(price),currency:offer.priceCurrency,...(aggregate?{priceKind:'starting-at'}:{}),...(unavailable?{availability:'unavailable'}:{})});
        products.push(`Product: ${value.name.slice(0,160)} | Listed price: ${offer.priceCurrency} ${price}${aggregate?' (starting at)':''}`);
      }
    }
    for (const child of Object.values(value)) visit(child,depth+1,insideProduct || [value['@type']].flat().includes('Product'));
  };
  $('script[type="application/ld+json"]').each((_,node)=>{try {visit(JSON.parse($(node).text()));} catch { /* Malformed metadata is not evidence. */ }});
  // Product links commonly group a heading with Now/Was prices. Preserve that
  // structural association instead of asking a small model to infer it from badges.
  $('a').each((_,node)=>{
    if (products.length >= 20) return;
    const card=$(node), heading=card.find('h2,h3').first().text().replace(/\s+/g,' ').trim();
    if (!heading) return;
    const copy=card.clone(); copy.find('*').append(' ');
    const content=copy.text().replace(/\s+/g,' ');
    const price=content.match(/\bNow\s*([$£€]\s*\d[\d,.]*)/i)?.[1];
    const previous=content.match(/\bWas\s*([$£€]\s*\d[\d,.]*)/i)?.[1];
    if (heading && heading.length < 200 && price) {
      const row=`Product: ${heading} | Listed price: ${price}${previous ? ` | Previous price: ${previous}` : ''}`;
      if (!products.includes(row)) {
        products.push(row);
        const currency=price.trim()[0]==='$'?'USD':price.trim()[0]==='£'?'GBP':'EUR';
        offers.push({name:heading,price:price.replace(/[^\d.]/g,''),currency,...(previous?{previousPrice:previous.replace(/[^\d.]/g,'')}:{})});
      }
    }
  });
  const commerce=/\/(?:shop|products?|dp|item|offers[^/]*|sale|clearance)(?:\/|$)/i.test(origin.pathname) || /add to (?:cart|bag)|buy now|add to basket/i.test($('button').text());
  const pageKind=editorial?'editorial':commerce && offers.length?'merchant':'other';
  $('script,style,nav,header,footer,aside,form,noscript,iframe').remove();
  // Readability extracts editorial content; retain semantic tables/product
  // catalogs with the existing fallback. JSDOM executes no scripts/resources.
  let readable;
  if (!offers.length && !$('main table, article table').length && !$('[itemtype*=Product], [data-testid*=price]').length) {
    const dom = new JSDOM($.html(),{url});
    try {
      const article = new Readability(dom.window.document,{maxElemsToParse:50000}).parse();
      if (article?.textContent?.trim().length >= 300) readable = load(article.content)('body');
    } catch { /* Unusual markup still has a bounded text fallback. */ }
    finally { dom.window.close(); }
  }
  const body = readable || ($('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body'));
  // Keep table rows, list items and headings distinct: flattened hours/price tables
  // make the small model associate one day's or department's value with another.
  body.find('td,th').append(' | ');
  body.find('p,div,section,h1,h2,h3,h4,h5,h6,li,tr,br').append('\n');
  const text = (products.join('\n') + '\n' + body.text()).replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,12000);
  return {pageTitle,status:restricted ? 'restricted' : text.length >= 300 ? 'retrieved' : 'unavailable',...(text.length >= 300 ? {text} : {}),...(publishedAt ? {publishedAt} : {}),...(productLinks.length ? {productLinks:productLinks.slice(0,4)} : {}),pageKind,...(pageKind==='merchant' ? {offers} : {})};
}
export function readArticleHTML(response, encoding='identity') {
  return new Promise((resolve,reject)=>{
    const decoder=encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : undefined;
    if (!decoder && encoding !== 'identity') {response.resume();reject(new Error('Unsupported article encoding'));return;}
    const body=decoder ? response.pipe(decoder) : response;
    response.on('error',reject);
    const chunks=[];let size=0;
    body.on('data',chunk=>{
      size+=chunk.length;
      if(size > 2*1024*1024) {body.destroy(new Error('Article too large'));response.destroy();return;}
      chunks.push(chunk);
    });
    body.on('error',error=>{response.destroy();reject(error);});body.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
// Resolve and pin a public address at connection time; redirects receive the same checks.
function getPage(url, signal) {
  return new Promise((resolve,reject) => {
    const req = (url.protocol === 'https:' ? https : http)(url,{signal,method:'GET',headers:{'User-Agent':'NhomeAI/1.0','Accept':'text/html','Cache-Control':'no-cache'},lookup(host,options,callback) {
      lookup(host,{all:true},(error,addresses) => {
        if (error) return callback(error);
        if (!addresses.length || addresses.some(a => !publicAddress(a.address))) return callback(new Error('Private article address'));
        const selected = addresses[0]; callback(null,options.all ? [selected] : selected.address,selected.family);
      });
    }},response => {
      if ([301,302,303,307,308].includes(response.statusCode)) { response.resume(); resolve({redirect:response.headers.location}); return; }
      if ([401,403].includes(response.statusCode)) {response.resume();resolve({restricted:true});return;}
      if (response.statusCode !== 200 || !/text\/html/i.test(response.headers['content-type'] || '')) {response.resume();reject(new Error('Article unavailable'));return;}
      readArticleHTML(response,(response.headers['content-encoding'] || 'identity').toLowerCase()).then(html=>resolve({html}),reject);
    });req.on('error',reject);req.end();
  });
}
export async function retrieveArticle(value, signal, get = getPage) {
  let url = articleURL(value);
  const deadline = AbortSignal.any([signal,AbortSignal.timeout(10000)]);
  const fetchedAt = new Date().toISOString();
  try {
    for(let i=0;i<4;i++) {
      const result = await get(url,deadline);
      if(result.redirect) {url=articleURL(new URL(result.redirect,url).href);continue;}
      if(result.restricted) return {status:'restricted',fetchedAt,url:url.href};
      return {...extractArticle(result.html,url.href),fetchedAt,url:url.href};
    }
  } catch { signal.throwIfAborted(); }
  return {status:'unavailable',fetchedAt,url:url.href};
}
