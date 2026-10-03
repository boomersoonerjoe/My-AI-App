import { load } from 'cheerio';
import { gateCurrentPrices, requiresCurrentPrice } from './price-evidence.mjs';

const stateAliases = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};

const MAX_BYTES = 1024 * 1024;
const plain = value => {
  const $ = load(value || ''); $('script,style').remove();
  return $.text().replace(/\s+/g, ' ').trim();
};
const clip = (value, limit) => Array.from(plain(value)).slice(0, limit).join('');
export function publicLink(value) {
  try {
    const u = new URL(value);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) return undefined;
    return u.href;
  } catch { return undefined; }
}
export function validateCoordinates(c) {
  if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number' || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180) throw new Error('Invalid location coordinates.');
  return {latitude:Math.round(c.latitude*100)/100,longitude:Math.round(c.longitude*100)/100};
}
export function validateSearch(input) {
  if (!input || typeof input.query !== 'string' || !input.query.trim() || Buffer.byteLength(input.query) > 1200) throw new Error('Search query must contain 1–1,200 UTF-8 bytes.');
  if (!['web', 'news'].includes(input.kind) || typeof input.today !== 'boolean') throw new Error('Invalid search mode.');
  if (typeof input.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.day) || new Date(`${input.day}T12:00:00Z`).toISOString().slice(0, 10) !== input.day) throw new Error('Invalid device date.');
  if (typeof input.timeZone !== 'string') throw new Error('Missing device time zone.');
  new Intl.DateTimeFormat('en', { timeZone: input.timeZone });
  const coordinates = input.coordinates ? validateCoordinates(input.coordinates) : undefined;
  const list = (value, max, size) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > max || value.some(v=>typeof v !== 'string' || !v.trim() || v.length > size)) throw new Error('Invalid search plan');
    return value.map(v=>v.trim());
  };
  if(input.retrievalIntent!==undefined && !['product-price','sale-event','other'].includes(input.retrievalIntent))throw new Error('Invalid retrieval intent');
  const searchQueries = list(input.searchQueries,2,300), requiredTerms = list(input.requiredTerms,5,60);
  return { ...(input.retrievalIntent?{retrievalIntent:input.retrievalIntent}:{}), ...(searchQueries ? {searchQueries} : {}), ...(requiredTerms ? {requiredTerms} : {}), query: input.query.trim(), kind: input.kind, today: input.today, day: input.day, timeZone: input.timeZone, ...(coordinates ? {coordinates:{latitude:Math.round(coordinates.latitude*100)/100,longitude:Math.round(coordinates.longitude*100)/100}} : {}) };
}
// Feed search expects topic keywords, not response-format instructions.
export function newsSearchQuery(question) {
  const topic = question.split(/[?!;]/, 1)[0]
    .replace(/\b(?:give|show|provide|write|summari[sz]e|tell)\s+(?:me\s+)?(?:a\s+|the\s+)?(?:short\s+|brief\s+)?(?:summary|sources|headlines|news).*$/i, '')
    .replace(/\b(?:what|happened|happening|happens|is|are|was|were|has|have|the|in|at|on|of|for|and|please|today|tonight|this morning|news|headlines)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return `${topic || 'top'} news`;
}
function localDay(iso, timeZone) {
  const p = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = type => p.find(x => x.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function parseResults(xml, request, now = new Date()) {
  const $ = load(xml, { xmlMode: true });
  if (!$('rss channel').length) throw new Error('Search returned an unsupported response.');
  const sources = [], seen = new Set();
  $('channel > item').each((_, node) => {
    const item = $(node), url = publicLink(item.find('link').first().text().trim());
    if (!url || seen.has(url)) return;
    const publisher = clip(item.find('source').text(), 100);
    let title = clip(item.find('title').text(), 200);
    if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3));
    if (!title) return;
    let publishedAt;
    // Bing's RSS pubDate is not a reliable article publication date: never promote it to one.
    if (request.kind === 'news') {
      const timestamp = Date.parse(item.find('pubDate').text());
      if (!Number.isFinite(timestamp) || timestamp > now.getTime() + 300000) return;
      publishedAt = new Date(timestamp).toISOString();
      if (request.today && localDay(publishedAt, request.timeZone) !== request.day) return;
      if (!request.today && now.getTime()-timestamp > 7*86400000) return;
    }
    const excerpt = request.kind === 'news' ? title : clip(item.find('description').text(), 320);
    if (!excerpt) return;
    seen.add(url); sources.push({ title, url, excerpt, ...(publisher ? { publisher } : {}), ...(publishedAt ? { publishedAt, publishedDay:localDay(publishedAt,request.timeZone),publicationTimeZone:request.timeZone } : {}) });
  });
  return sources.slice(0, 10);
}
export function webSearchQuery(question) {
  // Strip question scaffolding, retaining subjects, qualifiers, dates, spelling and units.
  return question.trim().replace(/^(?:(?:when|where|what|how much)\s+(?:is|are|does|do|will)|(?:are|is) there(?: any)?|(?:can|could|would) you(?: please)?|please)\s+/i,'')
    .replace(/\b(?:having its|going on|online anywhere)\b/gi,' ').replace(/[?]+$/, '').replace(/\s+/g,' ').trim();
}
export function weatherLocation(question) {
  if (!/\bweather\b/i.test(question)) return undefined;
  const after = question.match(/\bweather\s+(?:in|for|at)\s+(.+?)(?:[?!;]|$)/i)?.[1];
  const before = question.match(/^(.+?)\s+weather\b/i)?.[1];
  let location = after && !/^(?:fahrenheit|celsius)\b/i.test(after) ? after : before;
  if (!location) return undefined;
  location = location.replace(/^(?:(?:what(?:'s| is)|show me|tell me|give me|i want|please|the|current|currently|local|today's)\s+)+/i, '')
    .replace(/\s+(?:supposed to be|going to be|expected to be|expected|like)(?:\s.*)?$/i, '')
    .replace(/\s+in (?:fahrenheit|celsius).*$/i, '')
    .replace(/\s+(?:right now|today|tonight|tomorrow|this week|currently|current|weather|forecast)(?:\s.*)?$/i, '').trim();
  if (!location || !/^[\p{L}\p{N} .,'’-]+$/u.test(location)) return undefined;
  return location;
}
export function matchesWeatherLocation(source, location) {
  if (!location) return true;
  const words = location.toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) || [];
  let decoded;
  try { decoded = decodeURIComponent(source.url); } catch { return false; }
  const target = `${source.title} ${decoded}`.toLocaleLowerCase('en');
  return words.every(word => new RegExp(`\\b${word}\\b`, 'i').test(target)) && /weather|forecast|conditions/i.test(target);
}
export function parseWebHTML(html, engine) {
  const $ = load(html), sources = [], seen = new Set();
  // Parse only organic result containers, never ads, answer boxes or AI-generated search prose.
  const selector = engine === 'bing' ? '.b_algo' : engine === 'duckduckgo' ? '.result:not(.result--ad)' : '.snippet';
  $(selector).each((_, node) => {
    const item = $(node);
    const anchor = engine === 'bing' ? item.find('h2 a').first() : engine === 'duckduckgo' ? item.find('.result__a').first() : item.find('a').filter((_, a) => $(a).find('.search-snippet-title').length > 0).first();
    let href = anchor.attr('href');
    if (!href) return;
    try {
      const target = new URL(href, engine === 'duckduckgo' ? 'https://html.duckduckgo.com' : 'https://www.bing.com');
      if (engine === 'duckduckgo') href = target.searchParams.get('uddg') || target.href;
      if (target.hostname === 'www.bing.com' && target.pathname === '/ck/a') {
        const encoded = target.searchParams.get('u');
        if (!encoded?.startsWith('a1')) return;
        href = Buffer.from(encoded.slice(2), 'base64url').toString('utf8');
      }
    } catch { return; }
    const url = publicLink(href);
    if (!url || seen.has(url) || /^(?:www\.)?(?:bing\.com|search\.brave\.com)$/.test(new URL(url).hostname)) return;
    const title = clip(engine === 'brave' ? anchor.find('.search-snippet-title').text() : anchor.text(), 200);
    const caption = engine === 'bing' ? item.find('.b_caption p').first() : engine === 'duckduckgo' ? item.find('.result__snippet').first() : item.find('.generic-snippet .content').first();
    caption.find('.news_dt').remove();
    const excerpt = clip(caption.text(), 1000);
    if (!title || !excerpt) return;
    seen.add(url); sources.push({ title, url, excerpt, publisher: new URL(url).hostname });
  });
  return sources.slice(0, 10);
}
export async function retrieveCurrentWeather(request, location, signal, requestFetch = fetch, now = new Date()) {
  let [city, region] = location.split(',').map(s => s.trim());
  const geocode = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geocode.search = new URLSearchParams({name:city,count:'10',language:'en',format:'json'}).toString();
  const get = async url => JSON.parse(await boundedText(await requestFetch(url, {signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),redirect:'error'})));
  let data = request.coordinates ? {results:[]} : await get(geocode);
  // Search plans often spell a city and region without a comma. Verify the trailing
  // region against geocoder metadata before using the shorter city query.
  const aliases = stateAliases;
  if (!request.coordinates && !data.results?.length && !region && city.includes(' ')) {
    const words=city.split(/\s+/);
    for(let split=words.length-1;split>0;split--) {
      const candidate=words.slice(0,split).join(' '), suffix=words.slice(split).join(' ');
      geocode.searchParams.set('name',candidate);
      const found=await get(geocode);
      if (found.results?.some(p=>p.name.toLowerCase() === candidate.toLowerCase() && [p.admin1,p.country,p.country_code].some(v=>v?.toLowerCase() === (aliases[suffix.toUpperCase()] || suffix).toLowerCase()))) {
        city=candidate;region=suffix;data=found;break;
      }
    }
  }
  const matches = (data.results || []).filter(p => p.name.toLowerCase() === city.toLowerCase() && (!region || [p.admin1,p.country,p.country_code,aliases[region.toUpperCase()]].some(value => value && (value.toLowerCase() === region.toLowerCase() || value === p.admin1 && aliases[region.toUpperCase()] === value))));
  matches.sort((a,b) => (b.population || 0) - (a.population || 0));
  const place = request.coordinates ? {...request.coordinates,name:'Your device location',admin1:'',country:'',country_code:''} : matches[0];
  if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) throw new Error('Requested weather location could not be verified.');
  if (matches.length > 1 && (place.population || 0) < 10 * (matches[1].population || 1)) throw new Error('Weather location is ambiguous. Include a state or country.');
  const unit = /celsius|centigrade/i.test(request.query) ? 'celsius' : /fahrenheit/i.test(request.query) || place.country_code === 'US' ? 'fahrenheit' : 'celsius';
  const tomorrow = /\btomorrow\b/i.test(request.query + ' ' + (request.searchQueries || []).join(' '));
  const daily = tomorrow || /\b(?:supposed to be|going to be|expected|forecast|high|low)\b/i.test(request.query) && !/\b(?:tomorrow|next|yesterday|last|this week)\b/i.test(request.query);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),current:'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m',temperature_unit:unit,wind_speed_unit:unit === 'fahrenheit' ? 'mph' : 'kmh',timeformat:'unixtime',timezone:daily ? 'auto' : 'UTC',forecast_days:tomorrow ? '2' : '1',...(daily ? {daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max'} : {})}).toString();
  const weather = await get(url), c = weather.current, u = weather.current_units;
  if (!c || !u || ![c.time,c.temperature_2m,c.apparent_temperature,c.relative_humidity_2m,c.wind_speed_10m].every(Number.isFinite) || now.getTime()/1000-c.time > 7200 || c.time-now.getTime()/1000 > 900) throw new Error('Weather data is missing or stale.');
  const expectedUnit = unit === 'fahrenheit' ? '°F' : '°C';
  if (u.temperature_2m !== expectedUnit || u.apparent_temperature !== expectedUnit || u.relative_humidity_2m !== '%' || !['mp/h','km/h'].includes(u.wind_speed_10m)) throw new Error('Weather data units do not match the request.');
  const name = [place.name,place.admin1,place.country].filter(Boolean).join(', ');
  let excerpt = `${name}: model-based current weather at ${new Date(c.time*1000).toISOString()}. Temperature ${c.temperature_2m}${u.temperature_2m}; feels like ${c.apparent_temperature}${u.apparent_temperature}; humidity ${c.relative_humidity_2m}${u.relative_humidity_2m}; wind ${c.wind_speed_10m} ${u.wind_speed_10m}. This is a weather-model estimate, not a station observation.`;
  if (daily) {
    const d = weather.daily, du = weather.daily_units, index = tomorrow ? 1 : 0;
    const target = new Date(now); if (tomorrow) target.setUTCDate(target.getUTCDate()+1);
    if (!d || !du || ![d.time?.[index],d.temperature_2m_max?.[index],d.temperature_2m_min?.[index],d.precipitation_probability_max?.[index]].every(Number.isFinite) || du.temperature_2m_max !== expectedUnit || du.temperature_2m_min !== expectedUnit || du.precipitation_probability_max !== '%' || d.precipitation_probability_max[index] < 0 || d.precipitation_probability_max[index] > 100 || localDay(new Date(d.time[index]*1000),weather.timezone) !== localDay(target,weather.timezone)) throw new Error('Today forecast is missing or has the wrong date/units.');
    excerpt = `${name}: forecast for ${localDay(target,weather.timezone)} (${weather.timezone}). High ${d.temperature_2m_max[index]}${expectedUnit}; low ${d.temperature_2m_min[index]}${expectedUnit}; chance of precipitation ${d.precipitation_probability_max[index]}%.`;
  }
  return {query:request.query,provider:'Open-Meteo (free noncommercial weather)',fetchedAt:now.toISOString(),timeZone:request.timeZone,scope:'weather',sources:[{title:`${name} ${tomorrow ? "tomorrow forecast" : daily ? "today forecast" : "current weather model"}`,url:url.href,excerpt,publisher:'Open-Meteo · GeoNames location data'}]};
}
const nearbyPlaces = new Map();
export async function devicePlace(coordinates, signal, requestFetch = fetch) {
  const key = `${coordinates.latitude.toFixed(2)},${coordinates.longitude.toFixed(2)}`;
  const cached = nearbyPlaces.get(key);
  if (requestFetch === fetch && cached && Date.now()-cached.time < 600000) return cached.place;
  const url = new URL('https://photon.komoot.io/reverse');
  url.search = new URLSearchParams({lat:coordinates.latitude.toFixed(2),lon:coordinates.longitude.toFixed(2),limit:'1',lang:'en'}).toString();
  const data = JSON.parse(await boundedText(await requestFetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),redirect:'error'})));
  const feature = data.features?.[0], p = feature?.properties;
  const xy = feature?.geometry?.coordinates;
  if (!p || !Array.isArray(xy) || !xy.slice(0,2).every(Number.isFinite) || xy.length < 2 || Math.abs(xy[0]-coordinates.longitude) > 0.3 || Math.abs(xy[1]-coordinates.latitude) > 0.3) throw new Error('Device location could not be resolved.');
  const state = {Oklahoma:'OK',Texas:'TX','New York':'NY',California:'CA'}[p.state] ?? p.state;
  const city = p.city || p.town || p.village;
  if (typeof city !== 'string' || !city.trim() || city.length > 120) throw new Error('Device location has no nearby city.');
  const place = [city,state,p.countrycode?.toUpperCase() === 'US' || p.country === 'United States' ? undefined : p.country].filter(Boolean).join(', ');
  if (!place || place.length > 200) throw new Error('Device location has no nearby city.');
  if (requestFetch === fetch) { if (nearbyPlaces.size >= 64) nearbyPlaces.delete(nearbyPlaces.keys().next().value); nearbyPlaces.set(key,{place,time:Date.now()}); }
  return place;
}
const queryNoise = new Set('major big official store buy running holding hosting events announcements entry level new newest base best discounted discounting developments development announcement closing opening start time dates date moment outside feeling feel about whether yet shopping event check announced plus get its being have has find get find out start starts happen happening happened tell cost costs currently recent latest right now research compare us usa dollars celsius fahrenheit are is was were a an the any there this that these those in on at of for to from and or with me my its it when where what who how does do can could would will having going online anywhere please show tell give search look up current currently latest today tomorrow now right recent sales sale deals deal price prices dates date news weather october january february march april may june july august september november december'.split(' '));
function subjectWords(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w=>w.length > 2 && !queryNoise.has(w) && !queryNoise.has(w.replace(/s$/,'')) && !/^\d+$/.test(w)).map(w=>w.replace(/s$/,''));
}
export function relevantWebSource(source, request, query) {
  const content = `${source.title} ${source.excerpt} ${source.url} ${source.publisher || ""}`.toLowerCase();
  // Dictionary pages cannot answer shopping/event questions merely by matching a question word.
  if (/dictionary|thesaurus|word meaning/.test(content) && /sales?|deals?|prices?|when|products?/i.test(request.query)) return false;
  const requestedYears = query.match(/\b20\d{2}\b/g) || [];
  const resultYears = `${source.title} ${new URL(source.url).pathname}`.match(/\b20\d{2}\b/g) || [];
  if (requestedYears.length && resultYears.length && !resultYears.some(year=>requestedYears.includes(year))) return false;
  const subjects = [...new Set(subjectWords(query))];
  const hits = subjects.filter(word=>content.includes(word)).length;
  if (request.kind === 'news' && /britannica|encyclopedia|dictionary/i.test(content)) return false;
  if (subjects.length && hits < Math.min(request.kind === 'news' ? 1 : 2,subjects.length)) return false;
  if (request.requiredTerms?.length) {
    const groups = request.requiredTerms.map(subjectWords).filter(words=>words.length);
    // Multiword subjects are conjunctive constraints: matching only the brand
    // can confuse unrelated products that share a name (e.g. jewelry/cameras).
    if (request.kind === 'news') {
      const actual=new Set(subjectWords(request.query));
      const named=groups.map(words=>words.filter(word=>actual.has(word))).filter(words=>words.length);
      if(named.some(words=>!words.some(word=>content.includes(word)))) return false;
    } else if (groups.some(words=>!words.every(word=>content.includes(word)))) return false;
  }
  const shopping = /\b(sales?|deals?|discounts?|prices?|cost|on sale)\b/i.test(request.query);
  const eventDate = /\bwhen\b/i.test(request.query);
  const storefront=/\/(?:shop|products?|dp)(?:\/|$)/i.test(new URL(source.url).pathname);
  if (shopping && !storefront && !/\$|£|€|price|cost|deal|sale|discount|offer|save|saving|prime day/i.test(content)) return false;
  if (shopping && /buyers? guide|reviews?/i.test(source.title) && !/[$£€]\s*\d/.test(source.excerpt)) return false;
  if (eventDate && !/\d|date|starts?|begins?|schedule|announc|october|november|december|january|february|march|april|may|june|july|august|september/i.test(content)) return false;
  return true;
}
export function rankWebSources(sources, request, query) {
  const subjects = subjectWords(query);
  const shopping = /\b(sales?|deals?|prices?|discounts?|cost)\b/i.test(request.query);
  const score = source => {
    const host = new URL(source.url).hostname.replace(/^www\./,'');
    const direct = subjects.some(word=>word.length > 3 && (host.split('.')[0] === word || host.split('.')[0] === `about${word}`));
    const officialTitle = source.title.match(/(?:[-–|]\s*)About\s+([a-z0-9]+)/i)?.[1]?.toLowerCase();
    const identifiedOfficial = officialTitle && host.split('.')[0] === `about${officialTitle}`;
    let value = direct || identifiedOfficial ? 8 : 0;
    if(request.retrievalIntent==='sale-event') {
      if(/announc|dates?|starts?|begins?|scheduled|prime big|sale event/i.test(source.title+' '+source.excerpt))value+=6;
      if(new URL(source.url).pathname==='/')value-=12;
    }
    if (requiresCurrentPrice(request.query,request.retrievalIntent) && /\/(?:shop|dp)(?:\/|$)/i.test(new URL(source.url).pathname)) value += 6;
    if (/offers|deals|products|shop|retail|store/i.test(new URL(source.url).pathname)) value += 2;
    if (purchasePriceScore(source)) value += 2;
    if (direct && /\b(?:how much|cost|price)\b/i.test(request.query)) value += Math.min(6,new URL(source.url).pathname.split('/').filter(Boolean).length);
    if (/education|student|us-edu/i.test(source.title+' '+source.url) && !/education|student|school/i.test(request.query)) value -= 8;
    const dated = `${source.title} ${new URL(source.url).pathname}`;
    const years = dated.match(/\b20\d{2}\b/g) || [];
    if (shopping && years.length && years.every(y=>+y < +request.day.slice(0,4))) value -= 10;
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    if (shopping && months.some((month,i)=>i+1 < +request.day.slice(5,7) && dated.toLowerCase().includes(month))) value -= 8;
    return value;
  };
  return [...sources].sort((a,b)=>score(b)-score(a));
}
export function purchasePriceScore(source) {
  if (/Listed price:\s*(?:[A-Z]{3}\s*|[$£€]\s*)\d/i.test(source.article?.text || '')) return 2;
  const excerpt=source.excerpt || '';
  for (const amount of excerpt.matchAll(/[$£€]\s*\d[\d,.]*/g)) {
    if (!/per\s+month|\/\s*mo|monthly|lease/i.test(excerpt.slice(amount.index+amount[0].length,amount.index+amount[0].length+35))) return 1;
  }
  return 0;
}
// A verified preferred storefront is sufficient for a simple attributed price.
// Comparison requests still wait for all reads; failed preferred reads preserve fallback.
export async function readWebArticles(sources,request,signal,now,read) {
 const stop=new AbortController(), scoped=AbortSignal.any([signal,stop.signal]);
 const results=sources.map(source=>({...source}));
 const saleEvent=request.retrievalIntent==='sale-event' && !requiresCurrentPrice(request.query,request.retrievalIntent);
 const names=subjectWords(request.query);
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const month=months.find(month=>request.query.toLowerCase().includes(month)) || months[Number(request.day?.slice(5,7))-1];
 const year=request.query.match(/\b20\d{2}\b/)?.[0] || request.day?.slice(0,4);
 const preferred=requiresCurrentPrice(request.query,request.retrievalIntent) && !/\b(?:compare|comparison|cheapest|lowest|best|across|anywhere|all|every)\b/i.test(request.query)
  ? sources.findIndex(source=>/\/shop(?:\/|$)/i.test(new URL(source.url).pathname)) : saleEvent && !/\bnext\b/i.test(request.query) ? sources.findIndex(source=>{
   const url=new URL(source.url),host=url.hostname.replace(/^www\./,'').split('.')[0];
   return url.pathname!=='/' && names.some(name=>name.length>3 && (host===name || host===`about${name}`)) && /sale|deals|event|announc/i.test(source.title+' '+source.excerpt);
  }) : -1;
 const reads=sources.map(async(source,index)=>{
  try {results[index].article=await read(source.url,scoped);} catch {signal.throwIfAborted();}
 });
 const all=Promise.allSettled(reads);
 try {
  if(preferred>=0) {
   await reads[preferred];signal.throwIfAborted();
   if(saleEvent && results[preferred].article?.status==='retrieved' && month && year && `${results[preferred].article.pageTitle || ''} ${results[preferred].article.text || ''}`.toLowerCase().includes(month) && `${results[preferred].article.pageTitle || ''} ${results[preferred].article.text || ''}`.includes(year))return [results[preferred]];
   if(!saleEvent && gateCurrentPrices({query:request.query,retrievalIntent:request.retrievalIntent,fetchedAt:now.toISOString(),sources:[results[preferred]]}).currentPrice?.status==='verified-live')return results;
  }
  await all;signal.throwIfAborted();return results;
 } finally {stop.abort();}
}
export async function retrieveWeb(request, signal, requestFetch = fetch, now = new Date(), refined = false) {
  if (request.coordinates && /nearby|near me|around me/i.test(request.query) && !/weather/i.test(request.query)) {
    const place = await devicePlace(request.coordinates,signal,requestFetch);
    request = {...request,query:request.query.replace(/latitude [-\d.]+ longitude [-\d.]+/i,place)};
  }
  const nearby = /nearby|near me|around me/i.test(request.query);
  const nearbyCity = nearby ? request.query.match(/\bin\s+([\p{L} .’'-]+?)(?:,|[?!;]|$)/iu)?.[1].trim() : undefined;
  const query = webSearchQuery(nearby ? request.query.replace(/^(?:please\s+)?(?:find|show me|search for|look up)\s+/i,'') : request.query);
  const location = weatherLocation(request.query) || request.searchQueries?.map(weatherLocation).find(Boolean);
  if ((location || request.coordinates && /weather/i.test(request.query)) && !/next|yesterday|last|this week/i.test(request.query)) {
    try { return await retrieveCurrentWeather(request,location ?? 'Your device location',signal,requestFetch,now); } catch { signal.throwIfAborted(); }
  }
  const queries = [...new Set(request.searchQueries?.length ? request.searchQueries : [query])].slice(0,2);
  const collected = [];
  const providers = new Set();
  const combined = AbortSignal.any([signal, AbortSignal.timeout(50000)]);
  const batches=await Promise.all(queries.map(async focused=>{
    const endpoints = [
      ['duckduckgo', 'DuckDuckGo web search', `https://html.duckduckgo.com/html/?${new URLSearchParams({q:focused})}`],
      ['brave', 'Brave web search', `https://search.brave.com/search?${new URLSearchParams({q:focused,source:'web'})}`],
      ['bing', 'Bing web search', `https://www.bing.com/search?${new URLSearchParams({q:focused})}`],
      ['rss', 'Bing web-search RSS fallback', `https://www.bing.com/search?${new URLSearchParams({q:focused,format:'rss'})}`],
    ];
    // Aggregate independent engines rather than accepting the first weak hit.
    const outcomes = await Promise.allSettled(endpoints.map(async ([engine, provider, url]) => {
      const response = await requestFetch(new URL(url), {signal:AbortSignal.any([combined,AbortSignal.timeout(6500)]),redirect:'error',headers:{Accept:'text/html,application/rss+xml','User-Agent':'NhomeAI/0.1 local-first personal search'}});
      const text = await boundedText(response);
      const sources = (engine === 'rss' ? parseResults(text,request,now) : parseWebHTML(text,engine))
        .filter(source=>matchesWeatherLocation(source,location))
        .filter(source=>location || relevantWebSource(source,request,focused))
        .filter(source=>!nearbyCity || `${source.title} ${source.excerpt} ${source.url}`.toLowerCase().includes(nearbyCity.toLowerCase()));
      return {provider,sources:rankWebSources(sources,request,focused).slice(0,4)};
    }));
    return outcomes;
  }));
  signal.throwIfAborted();
  for(const outcomes of batches) {
    for (const result of outcomes) if (result.status === 'fulfilled' && result.value.sources.length) {
      collected.push(...result.value.sources);providers.add(result.value.provider);
    }

  }

  if (collected.length) {
    const unique=[...new Map(collected.map(source=>[source.url,source])).values()];
    let sources=rankWebSources(unique,request,queries[0]).slice(0,4);
    if (requestFetch === fetch && !combined.aborted) {
      const {retrieveArticle}=await import('./article-service.mjs');
      sources=await readWebArticles(sources,request,combined,now,retrieveArticle);
    }
    if (requiresCurrentPrice(request.query,request.retrievalIntent)) {
      sources=sources.filter(source=>{
        const host=new URL(source.url).hostname.replace(/^www\./,'').split('.')[0];
        const direct=subjectWords(queries[0]).some(word=>word.length>3 && host === word);
        const published=Date.parse(source.article?.publishedAt || '');
        return direct || !Number.isFinite(published) || now.getTime()-published <= 14*86400000;
      });
      if (!sources.length) sources=unique.slice(0,4); // The strict price gate below reports unverified, never an old price.
    }
    // Official storefronts may expose prices only on their linked product pages.
    // Follow at most two same-store descendants, not arbitrary editorial links.
    if(requestFetch === fetch && !combined.aborted && /\b(?:how much|cost|price)\b/i.test(request.query)) {
      const landing=sources.find(source=>!source.article?.offers?.length && source.article?.status==='retrieved' && source.article.pageKind!=='editorial' && source.article.productLinks?.length && /\/(?:shop|products?)(?:\/|$)/i.test(new URL(source.url).pathname));
      if(landing) {
        const {retrieveArticle}=await import('./article-service.mjs');
        const pages=await Promise.allSettled(landing.article.productLinks.slice(0,2).map(async link=>({...link,publisher:new URL(link.url).hostname,excerpt:link.title,article:await retrieveArticle(link.url,combined)})));
        signal.throwIfAborted();
        const priced=pages.filter(page=>page.status==='fulfilled' && purchasePriceScore(page.value)).map(page=>page.value);
        if(priced.length) sources=[...priced,...sources].slice(0,4);
      }
    }
    // A fetched manufacturer offer catalog is stronger current-deal evidence than
    // evergreen event guides. Avoid mixing a past event's offers into today's answer.
    const catalogs=sources.filter(source=>
      /offers|clearance|discount|sale/i.test(new URL(source.url).pathname) &&
      subjectWords(queries[0]).some(word=>word.length>3 && new URL(source.url).hostname.replace(/^www\./,'').split('.')[0] === word) &&
      source.article?.status === 'retrieved' && /(?:now|save|was)\s*[$£€]\s*\d/i.test(source.article.text || ''));
    if (catalogs.length && requiresCurrentPrice(request.query,request.retrievalIntent)) sources=catalogs;
    // Exact price questions need a price from the named supplier, not merely its landing page.
    const official=sources.find(source=>subjectWords(queries[0]).some(word=>word.length>3 && new URL(source.url).hostname.replace(/^www\./,'').split('.')[0] === word));
    if (!refined && requestFetch === fetch && !combined.aborted && /\b(?:how much|cost|price)\b/i.test(request.query) && official && !official.article?.offers?.length && !purchasePriceScore(official)) {
      const targeted=`site:${new URL(official.url).hostname} ${subjectWords(queries[0]).join(' ')} buy one-time purchase price`;
      try {
        const extra=await retrieveWeb({...request,searchQueries:[targeted]},combined,requestFetch,now,true);
        const merged=[...new Map([...sources,...extra.sources].map(source=>[source.url,source])).values()];
        sources=rankWebSources(merged,request,queries[0]).sort((a,b)=>{
          const priced=source=>new URL(source.url).hostname === new URL(official.url).hostname ? purchasePriceScore(source) : 0;
          return priced(b)-priced(a);
        }).slice(0,4);
        queries.push(targeted);providers.add(extra.provider);
      } catch { signal.throwIfAborted(); }
    }
    return gateCurrentPrices({retrievalIntent:request.retrievalIntent,query:request.query,searchQueries:queries,provider:[...providers].join(' + '),fetchedAt:now.toISOString(),timeZone:request.timeZone,scope:'web',sources});
  }
  throw new Error(location ? `No weather sources matched the requested location “${location}”. I cannot verify its current weather.` : 'Free general web search is unavailable or returned no usable results. I cannot verify this question.');
}
async function boundedText(response) {
  if (!response.ok) throw new Error(`Free search returned HTTP ${response.status}.`);
  if (!response.body) throw new Error('Search returned an empty response.');
  const reader = response.body.getReader(); const buffers = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > MAX_BYTES) throw new Error('Search response exceeded the safe size limit.');
      buffers.push(Buffer.from(value));
    }
    return Buffer.concat(buffers).toString('utf8');
  } finally { await reader.cancel(); reader.releaseLock(); }
}
export async function retrieveSearch(input, signal, requestFetch = fetch, now = new Date()) {
  const request = validateSearch(input);
  if (request.kind === 'web') return retrieveWeb(request, signal, requestFetch, now);
  let url;
  if (request.kind === 'news') {
    // Expand the upstream date window, then filter exact local-day pubDates below.
    // The search engine's date boundaries need not use the device's time zone.
    const before = new Date(`${request.day}T12:00:00Z`); before.setUTCDate(before.getUTCDate() + 2);
    const after = new Date(`${request.day}T12:00:00Z`); after.setUTCDate(after.getUTCDate() - 1);
    const range = request.today ? `after:${after.toISOString().slice(0, 10)} before:${before.toISOString().slice(0, 10)}` : 'when:7d';
    const query = newsSearchQuery(request.searchQueries?.[0] || request.query);
    url = new URL('https://news.google.com/rss/search');
    url.search = new URLSearchParams({ q: `${query} ${range}`, hl: 'en-US', gl: 'US', ceid: 'US:en' }).toString();
  }
  const fetchSources = async target => {
  const response = await requestFetch(target, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), redirect: 'error',
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'NhomeAI/0.1 local-first personal search' },
  });
  return parseResults(await boundedText(response), request, now);
  };
  // The original topic is always a candidate. Its geographically focused feed
  // is authoritative for relevance: local headlines need not repeat their city. Planner-added generic topics and
  // calendar words must not become literal requirements on local headlines.
  const topics=[...new Set([request.query,...(request.searchQueries || [])].map(query=>newsSearchQuery(query.replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+20\d{2})?\b/gi,date=>request.today || !request.query.toLowerCase().includes(date.toLowerCase()) ? '' : date).replace(/,\s*([A-Z]{2})\b/g,(_,code)=>' '+(stateAliases[code] || code)))))].slice(0,3);
  const outcomes=await Promise.allSettled(topics.map(topic=>{
    const target=new URL(url);const range=url.searchParams.get('q').match(/(?:after:.*|when:7d)$/)?.[0] || 'when:7d';
    target.searchParams.set('q',`${topic} ${range}`);return fetchSources(target);
  }));
  signal.throwIfAborted();
  if(!outcomes.some(result=>result.status==='fulfilled'))throw new Error(`All free news retrieval attempts failed: ${outcomes.find(result=>result.status==='rejected')?.reason?.message || 'unknown failure'}`);
  let sources=[...new Map(outcomes.flatMap((result,index)=>result.status==='fulfilled'?(index===0 ? result.value : result.value.filter(source=>relevantWebSource(source,request,request.query))):[]).map(source=>[source.url,source])).values()];
  if(!sources.length && request.today) {
    const fallback=new URL(url);fallback.searchParams.set('q',`${topics[0]} when:1d`);
    try {sources=await fetchSources(fallback);}
    catch {signal.throwIfAborted();} // A successful empty feed remains distinct from an outage.
  }
  sources = sources.slice(0,4);
  if (requestFetch === fetch && sources.length) {
    const {retrieveArticle} = await import('./article-service.mjs');
    const articles = await Promise.allSettled(sources.slice(0,3).map(source=>retrieveArticle(source.url,signal)));
    signal.throwIfAborted();
    sources.slice(0,3).forEach((source,index)=>{if(articles[index].status === 'fulfilled') source.article=articles[index].value;});
  }
  if (!sources.length && !request.today) throw new Error('No usable news sources were returned.');
  return gateCurrentPrices({
    retrievalIntent:request.retrievalIntent,query: request.query, provider: request.kind === 'news' ? 'Google News RSS' : 'Bing web-search RSS',
    fetchedAt: now.toISOString(), timeZone: request.timeZone,
    scope: request.kind === 'news' ? (request.today ? 'today' : 'recent') : 'web', sources, ...(request.today && !sources.length ? {newsStatus:'no-reports-today',searchedDay:request.day} : {}),
  });
}
