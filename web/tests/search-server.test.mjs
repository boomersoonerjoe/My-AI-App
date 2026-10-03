import { request as httpRequest } from 'node:http';
import { it, expect } from 'vitest';
import { parseResults, retrieveSearch, validateSearch, newsSearchQuery, parseWebHTML, retrieveWeb, webSearchQuery, weatherLocation, matchesWeatherLocation, retrieveCurrentWeather, relevantWebSource, purchasePriceScore, rankWebSources } from '../scripts/search-service.mjs';
import { makeServer } from '../scripts/server.mjs';
const request = { query: 'Tulsa news today', kind: 'news', today: true, day: '2026-10-01', timeZone: 'America/Chicago' };
const now = new Date('2026-10-02T04:30:00Z');
const feed = items => `<rss><channel>${items.join('')}</channel></rss>`;
const item = (title, date, url = 'https://example.org/story') => `<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><source>Fixture</source><description>Snippet &amp; details</description></item>`;
it('filters news by device local day, rejects future/undated/private links and deduplicates', () => {
  const xml = feed([
    item('Late local news', 'Fri, 02 Oct 2026 03:30:00 GMT'),
    item('Duplicate', 'Fri, 02 Oct 2026 03:30:00 GMT'),
    item('Previous local day', 'Thu, 01 Oct 2026 01:00:00 GMT', 'https://example.org/old'),
    item('Future item', 'Fri, 02 Oct 2026 05:30:00 GMT', 'https://example.org/future'),
    item('Missing date', '', 'https://example.org/undated'), item('Local target', 'Fri, 02 Oct 2026 03:30:00 GMT', 'http://127.0.0.1/private'),
  ]);
  expect(parseResults(xml, request, now)).toEqual([expect.objectContaining({ title: 'Late local news', excerpt: 'Late local news', publishedAt: '2026-10-02T03:30:00.000Z' })]);
});
it('does not treat web-search RSS dates as article publication dates', () => {
  expect(parseResults(feed([item('Web title', 'Fri, 02 Oct 2026 03:30:00 GMT')]), { ...request, kind: 'web' }, now)[0]).not.toHaveProperty('publishedAt');
});
it('uses fixed free endpoints and broadens upstream dates before exact timezone filtering', async () => {
  let called;
  const data = await retrieveSearch(request, new AbortController().signal, async (url, options) => {
    called = [url, options]; return new Response(feed([item('Tulsa News', 'Fri, 02 Oct 2026 03:30:00 GMT')]));
  }, now);
  expect(called[0].hostname).toBe('news.google.com'); expect(called[0].searchParams.get('q')).toContain('after:2026-09-30 before:2026-10-03');
  expect(called[1].redirect).toBe('error'); expect(data.sources).toHaveLength(1);
});
it('fails closed for undated today-specific web results, bad responses and oversized feeds', async () => {
  const signal = new AbortController().signal;
  const web = await retrieveSearch({ ...request, kind: 'web' }, signal, async () => new Response(feed([item('Tulsa news', '')])), now);
  expect(web.scope).toBe('web'); expect(web.sources[0]).not.toHaveProperty('publishedAt');
  await expect(retrieveSearch(request, signal, async () => new Response('Blocked', { status: 429 }), now)).rejects.toThrow('429');
  await expect(retrieveSearch(request, signal, async () => new Response('x'.repeat(1024 * 1024 + 1)), now)).rejects.toThrow('size limit');
});
it('validates inputs without accepting arbitrary upstream targets', () => {
  expect(() => validateSearch({ ...request, query: 'x'.repeat(1201) })).toThrow();
  expect(() => validateSearch({ ...request, timeZone: 'Invalid/Zone' })).toThrow();
  expect(() => validateSearch({ ...request, day: '2026-02-30' })).toThrow();
});
it('enforces loopback origins, JSON/body limits, search errors and traversal guards', async () => {
  const server = makeServer(async () => { throw new Error('Offline fixture'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = headers => fetch(base + '/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(request) });
  try {
    expect((await send({ Origin: 'https://evil.example' })).status).toBe(403);
    const badHost = await new Promise((resolve, reject) => { const r = httpRequest(base + '/api/search', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); r.on('error', reject); r.end(); });
    expect(badHost).toBe(403);
    const offline = await send({ Origin: 'http://127.0.0.1:4173' }); expect(offline.status).toBe(503); expect(await offline.json()).toEqual({ error: 'Offline fixture' });
    expect((await fetch(base + '/api/search')).status).toBe(405);
    expect((await fetch(base + '/api/search', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415);
    expect((await fetch(base + '/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(5000) })).status).toBe(413);
    expect((await fetch(base + '/%2e%2e%2fpackage.json')).status).toBe(403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

it('normalizes conversational local news queries without response instructions', () => {
  expect(newsSearchQuery('what happened today in the news in tulsa? give me a short summary and show sources')).toBe('tulsa news');
  expect(newsSearchQuery('Tulsa news today')).toBe('Tulsa news');
  expect(newsSearchQuery('What happened today in Oklahoma City? Show sources')).toBe('Oklahoma City news');
});
it('retries an empty date-range feed while retaining exact local-day filtering', async () => {
  const queries = [];
  const data = await retrieveSearch(request, new AbortController().signal, async url => {
    queries.push(url.searchParams.get('q'));
    return new Response(feed(queries.length === 1 ? [] : [item('Tulsa recovered news', 'Fri, 02 Oct 2026 03:30:00 GMT'), item('Old news', 'Wed, 30 Sep 2026 12:00:00 GMT', 'https://example.org/old')]));
  }, now);
  expect(queries).toHaveLength(2); expect(queries[1]).toBe('Tulsa news when:1d');
  expect(data.sources).toHaveLength(1); expect(data.sources[0].title).toBe('Tulsa recovered news');
});

it('extracts organic HTML results and decodes Bing links without promoting search dates', () => {
  const u = 'a1' + Buffer.from('https://example.org/product').toString('base64url');
  const html = `<li class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=${u}">Product</a></h2><div class="b_caption"><p><span class="news_dt">today</span>Listed price $10</p></div></li>`;
  expect(parseWebHTML(html, 'bing')).toEqual([{title:'Product', url:'https://example.org/product', excerpt:'Listed price $10', publisher:'example.org'}]);
  expect(parseWebHTML(html.replace(u, 'a1'+Buffer.from('http://127.0.0.1/private').toString('base64url')), 'bing')).toEqual([]);
  expect(parseWebHTML('<h2>Challenge</h2>', 'bing')).toEqual([]);
});
it('falls back to a second free HTML engine, preserving query privacy and cancellation', async () => {
  const calls = [];
  const result = await retrieveWeb({...request, kind:'web'}, new AbortController().signal, async url => {
    calls.push(url.hostname);
    return new Response(calls.length < 3 ? 'Unavailable' : '<li class="b_algo"><h2><a href="https://example.org/research">Tulsa news</a></h2><div class="b_caption"><p>Sourced excerpt</p></div></li>');
  }, now);
  expect(calls).toEqual(['html.duckduckgo.com','search.brave.com','www.bing.com','www.bing.com']); expect(result.provider).toBe('Bing web search');
  const abort = new AbortController(); abort.abort();
  await expect(retrieveWeb(request,abort.signal)).rejects.toMatchObject({name:'AbortError'});
});

it('normalizes research and comparison commands into subject-first search queries', () => {
  expect(webSearchQuery('Research solar panel efficiency')).toBe('Research solar panel efficiency');
  expect(webSearchQuery('Compare latest budget laptops')).toBe('Compare latest budget laptops');
});
it('fails explicitly when all public engines are unavailable and ignores arbitrary upstream parameters', async () => {
  const calls = [];
  await expect(retrieveWeb({...request, kind:'web', url:'http://127.0.0.1/private'},new AbortController().signal,async url => { calls.push(url.hostname); return new Response('Unavailable',{status:429}); },now)).rejects.toThrow('unavailable');
  expect(calls).toEqual(['html.duckduckgo.com','search.brave.com','www.bing.com','www.bing.com']);
});

it('preserves locations, details, spelling and order in outgoing web queries', async () => {
  const query = 'current Tulsa, OK weather in Fahrenheit';
  const calls = [];
  await retrieveWeb({...request, query,kind:'web'},new AbortController().signal,async url => {
    if (url.searchParams.has('q')) calls.push(url.searchParams.get('q'));
    return new Response('<li class="b_algo"><h2><a href="https://example.org/weather/tulsa-ok">Tulsa, OK Weather</a></h2><div class="b_caption"><p>Weather source</p></div></li>');
  },now);
  expect(calls.every(value => value === query)).toBe(true);
});
it('rejects another city and requires an actual weather page for the requested location', () => {
  expect(weatherLocation('current tulsa weather')).toBe('tulsa');
  expect(weatherLocation('What is the current weather in Tulsa, OK today?')).toBe('Tulsa, OK');
  expect(matchesWeatherLocation({title:'Waxahachie, TX Weather',url:'https://weather.example/waxahachie'},'Tulsa')).toBe(false);
  expect(matchesWeatherLocation({title:'Tulsa, OK Weather',url:'https://weather.example/tulsa'},'Tulsa')).toBe(true);
  expect(matchesWeatherLocation({title:'City of Tulsa',url:'https://cityoftulsa.org/'},'Tulsa')).toBe(false);
});
it('discards Waxahachie weather and preserves important details on every retry', async () => {
  const query = 'What is the current Tulsa weather?'; const calls = [];
  const source = (city) => `<div class="snippet"><a href="https://example.org/weather/${city.toLowerCase()}"><div class="search-snippet-title">${city} Weather</div></a><div class="generic-snippet"><div class="content">Weather conditions</div></div></div>`;
  const result = await retrieveWeb({...request,query,kind:'web'},new AbortController().signal,async url => {
    if (url.searchParams.has('q')) calls.push(url.searchParams.get('q'));
    if (calls.length === 1) return new Response('<div class="result"><a class="result__a" href="https://example.org/weather/waxahachie">Waxahachie Weather</a><a class="result__snippet">Weather conditions</a></div>');
    if (calls.length < 3) return new Response('Unavailable',{status:503});
    return new Response('<li class="b_algo"><h2><a href="https://example.org/weather/tulsa">Tulsa Weather</a></h2><div class="b_caption"><p>Weather conditions</p></div></li>');
  },now);
  expect(result.sources).toHaveLength(1); expect(result.sources[0].title).toBe('Tulsa Weather');
  expect(calls[0]).toBe('the current Tulsa weather');
  expect(calls.every(value => value.includes('current Tulsa weather'))).toBe(true);
});

it('resolves exact weather city/state, preserves Celsius and rejects stale/wrong-city API data', async () => {
  const place = {name:'Tulsa',admin1:'Oklahoma',country:'United States',country_code:'US',population:400000,latitude:36.15,longitude:-95.99};
  const c = {time:now.getTime()/1000,temperature_2m:20,apparent_temperature:19,relative_humidity_2m:50,wind_speed_10m:10};
  const u = {temperature_2m:'°C',apparent_temperature:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h'};
  const fetcher = async url => {
    if (url.hostname === 'geocoding-api.open-meteo.com') { expect(url.searchParams.get('name')).toBe('Tulsa'); return new Response(JSON.stringify({results:[place]})); }
    expect(url.searchParams.get('temperature_unit')).toBe('celsius');
    return new Response(JSON.stringify({current:c,current_units:u}));
  };
  const data = await retrieveCurrentWeather({...request,query:'current Tulsa, OK weather in Celsius'},'Tulsa, OK',new AbortController().signal,fetcher,now);
  expect(data.sources[0].excerpt).toContain('Tulsa, Oklahoma'); expect(data.sources[0].excerpt).toContain('20°C');
  await expect(retrieveCurrentWeather(request,'Tulsa, TX',new AbortController().signal,fetcher,now)).rejects.toThrow('location');
  await expect(retrieveCurrentWeather(request,'Tulsa',new AbortController().signal,async url => new Response(JSON.stringify(url.hostname.includes('geocoding') ? {results:[place]} : {current:{...c,time:c.time-10000},current_units:u})),now)).rejects.toThrow('stale');
});

it('separates forecast phrasing from the exact city/state and retrieves today daily values', async () => {
  const query = 'what is the weather in Tulsa,ok supposed to be today?';
  expect(weatherLocation(query)).toBe('Tulsa,ok');
  expect(weatherLocation('weather in Oklahoma City, OK going to be today?')).toBe('Oklahoma City, OK');
  const place={name:'Tulsa',admin1:'Oklahoma',country:'United States',country_code:'US',population:400000,latitude:36.15,longitude:-95.99};
  const payload={timezone:'America/Chicago',current:{time:now.getTime()/1000,temperature_2m:70,apparent_temperature:72,relative_humidity_2m:60,wind_speed_10m:5},current_units:{temperature_2m:'°F',apparent_temperature:'°F',relative_humidity_2m:'%',wind_speed_10m:'mp/h'},daily:{time:[new Date('2026-10-01T05:00:00Z').getTime()/1000],temperature_2m_max:[80],temperature_2m_min:[60],precipitation_probability_max:[40]},daily_units:{temperature_2m_max:'°F',temperature_2m_min:'°F',precipitation_probability_max:'%'}};
  const fetcher=async url=>{
    if(url.hostname.includes('geocoding')){expect(url.searchParams.get('name')).toBe('Tulsa');return new Response(JSON.stringify({results:[place]}));}
    expect(url.searchParams.get('daily')).toContain('temperature_2m_max');expect(url.searchParams.get('timezone')).toBe('auto');
    return new Response(JSON.stringify(payload));
  };
  const result=await retrieveWeb({...request,query,kind:'web'},new AbortController().signal,fetcher,now);
  expect(result.sources[0].excerpt).toContain('High 80°F; low 60°F; chance of precipitation 40%');
  payload.daily.time[0]-=86400;
  await expect(retrieveCurrentWeather({...request,query},'Tulsa,ok',new AbortController().signal,fetcher,now)).rejects.toThrow('date');
});

it('serves bounded article reading only for the loopback origin and rejects private targets',async()=>{
  let calls=0;const server=makeServer(undefined,async url=>{calls++;return {status:'retrieved',text:'Saved public article.',url,fetchedAt:now.toISOString()};});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const send=(url,origin='http://127.0.0.1:4173')=>fetch(base+'/api/article',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({url})});
  try{expect((await send('http://127.0.0.1/private')).status).toBe(400);expect((await send('https://example.org/article','https://evil.example')).status).toBe(403);expect(calls).toBe(0);expect((await send('https://example.org/article')).status).toBe(200);expect(calls).toBe(1);}finally{await new Promise(resolve=>server.close(resolve));}
});

it('validates device coordinates and retrieves weather without city/time-zone geocoding',async()=>{
 const r=validateSearch({...request,query:'Weather outside?',kind:'web',coordinates:{latitude:36.15,longitude:-95.99}});
 expect(r.coordinates).toEqual({latitude:36.15,longitude:-95.99});
 for(const coordinates of [{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:'36',longitude:0},{latitude:NaN,longitude:0}]) expect(()=>validateSearch({...r,coordinates})).toThrow('coordinates');
 const calls=[];
 const data=await retrieveWeb(r,new AbortController().signal,async url=>{
  calls.push(url.href);expect(url.hostname).toBe('api.open-meteo.com');expect(url.searchParams.get('latitude')).toBe('36.15');
  return new Response(JSON.stringify({current:{time:now.getTime()/1000,temperature_2m:20,apparent_temperature:21,relative_humidity_2m:50,wind_speed_10m:10},current_units:{temperature_2m:'°C',apparent_temperature:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h'}}));
 },now);
 expect(calls).toHaveLength(1);expect(data.scope).toBe('weather');expect(data.sources[0].excerpt).toContain('Your device location');expect(calls[0]).not.toContain('Chicago');
});

it('resolves nearby device coordinates to a city and preserves the requested nearby subject',async()=>{
 const calls=[];
 const r={...request,kind:'web',today:false,query:'Find coffee shops nearby in latitude 36.15 longitude -95.99',coordinates:{latitude:36.15,longitude:-95.99}};
 const e=await retrieveWeb(r,new AbortController().signal,async url=>{
  calls.push(url.href);
  if(url.hostname==='photon.komoot.io') return new Response(JSON.stringify({features:[{geometry:{coordinates:[-95.99,36.15]},properties:{city:'Tulsa',state:'Oklahoma',country:'United States'}}]}));
  expect(url.searchParams.get('q')).toContain('coffee shops nearby in Tulsa, OK');
  return new Response('<div class="snippet"><a href="https://example.org/tulsa"><span class="search-snippet-title">Tulsa coffee shops</span></a><div class="generic-snippet"><div class="content">Local Tulsa coffee shops</div></div></div>');
 },now);
 expect(calls[0]).toContain('lat=36.15');expect(e.query).toContain('Tulsa, OK');expect(e.sources[0].title).toBe('Tulsa coffee shops');
});
it('does not use distant reverse-geocoding results or unrelated nearby search results',async()=>{
 await expect(retrieveWeb({...request,kind:'web',query:'coffee shops nearby in latitude 36.15 longitude -95.99',coordinates:{latitude:36.15,longitude:-95.99}},new AbortController().signal,async()=>new Response(JSON.stringify({features:[{geometry:{coordinates:[-87.6,41.9]},properties:{city:'Chicago'}}]})),now)).rejects.toThrow('resolved');
 await expect(retrieveWeb({...request,kind:'web',query:'Find coffee shops nearby in Tulsa, OK'},new AbortController().signal,async()=>new Response('<div class="b_algo"><h2><a href="https://example.org/phone">Find your phone</a></h2><div class="b_caption"><p>Locate your device</p></div></div>'),now)).rejects.toThrow('unavailable');
});

it('serves city resolution on the real location route, validates coordinates and restricts origins',async()=>{
 let called;
 const server=makeServer(undefined,undefined,async c=>{called=c;return 'Tulsa, OK';});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 try {
  const post=(body,extra={})=>fetch(origin+'/api/location',{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
  const good=await post({coordinates:{latitude:36.1539,longitude:-95.9928}});expect(await good.json()).toEqual({place:'Tulsa, OK'});expect(called).toEqual({latitude:36.15,longitude:-95.99});
  expect((await post({coordinates:{latitude:91,longitude:0}})).status).toBe(400);
  expect((await post({})).status).toBe(400);
  expect((await post({coordinates:{latitude:36.15,longitude:-95.99}},{Origin:'https://untrusted.example'})).status).toBe(403);
 } finally {await new Promise(resolve=>server.close(resolve));}
});

it('rejects filler-word results and continues to another engine until subject and intent match',async()=>{
 const queries=[];
 const result=await retrieveWeb({...request,kind:'web',query:'Could you find a camera offer?',searchQueries:['ExampleBrand camera offers'],requiredTerms:['ExampleBrand']},new AbortController().signal,async url=>{
  queries.push(url.hostname);
  if(url.hostname==='html.duckduckgo.com')return new Response('<div class="result"><a class="result__a" href="https://dictionary.example/could">Could definition</a><a class="result__snippet">The meaning of could.</a></div>');
  return new Response('<div class="snippet"><a href="https://examplebrand.com/offers"><div class="search-snippet-title">ExampleBrand camera offers</div></a><div class="generic-snippet"><div class="content">Camera now $50, was $75.</div></div></div>');
 },now);
 expect(queries).toEqual(['html.duckduckgo.com','search.brave.com','www.bing.com','www.bing.com']);
 expect(result.sources[0].excerpt).toContain('$50');
});
it('merges focused queries and keeps named store/branch constraints',async()=>{
 const result=await retrieveWeb({...request,kind:'web',query:'When does ShopCo in Sampleton close?',searchQueries:['ShopCo Sampleton hours','ShopCo Sampleton closing time'],requiredTerms:['ShopCo','Sampleton']},new AbortController().signal,async url=>{
  const n=url.searchParams.get('q').includes('closing')?'2':'1';
  return new Response(`<div class="result"><a class="result__a" href="https://shopco.example/branch${n}">ShopCo Sampleton hours</a><a class="result__snippet">Branch closes at 8 pm.</a></div>`);
 },now);
 expect(result.sources).toHaveLength(2);
 expect(result.searchQueries).toHaveLength(2);
});
it('parses DuckDuckGo organic links safely and skips ads and challenges',()=>{
 const html='<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Foffer">Product offer</a><a class="result__snippet">Save $10</a></div>';
 expect(parseWebHTML(html,'duckduckgo')[0]).toMatchObject({url:'https://example.org/offer',excerpt:'Save $10'});
 expect(parseWebHTML(html.replace('class="result"','class="result result--ad"'),'duckduckgo')).toEqual([]);
 expect(parseWebHTML('Please complete this challenge','duckduckgo')).toEqual([]);
});

it('uses the next local calendar day for a structured forecast rather than current conditions',async()=>{
 const place={name:'Example City',admin1:'Example Region',country:'Example Country',country_code:'EX',population:100000,latitude:20,longitude:10};
 const payload={timezone:'America/Chicago',current:{time:now.getTime()/1000,temperature_2m:20,apparent_temperature:19,relative_humidity_2m:50,wind_speed_10m:5},current_units:{temperature_2m:'°C',apparent_temperature:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h'},daily:{time:[new Date('2026-10-01T05:00:00Z').getTime()/1000,new Date('2026-10-02T05:00:00Z').getTime()/1000],temperature_2m_max:[25,30],temperature_2m_min:[10,15],precipitation_probability_max:[5,75]},daily_units:{temperature_2m_max:'°C',temperature_2m_min:'°C',precipitation_probability_max:'%'}};
 const result=await retrieveCurrentWeather({...request,query:'weather tomorrow'},'Example City',new AbortController().signal,async url=>{
  if(url.hostname.includes('geocoding')) return new Response(JSON.stringify({results:[place]}));
  expect(url.searchParams.get('forecast_days')).toBe('2');return new Response(JSON.stringify(payload));
 },now);
 expect(result.sources[0].excerpt).toContain('forecast for 2026-10-02');
 expect(result.sources[0].excerpt).toContain('High 30°C; low 15°C; chance of precipitation 75%');
});

it('requires the full meaningful product constraint, not just a shared brand word',()=>{
 const req={...request,kind:'web',query:'ExampleBrand camera offers',requiredTerms:['ExampleBrand cameras']};
 expect(relevantWebSource({title:'ExampleBrand fitness ring sale',url:'https://retailer.example/offer',excerpt:'Save $50 on an ExampleBrand fitness ring.'},req,'ExampleBrand offers')).toBe(false);
 expect(relevantWebSource({title:'ExampleBrand camera offer',url:'https://retailer.example/offer',excerpt:'Save $50 on an ExampleBrand camera.'},req,'ExampleBrand offers')).toBe(true);
});

it('normalizes generic topic plurals before enforcing specific news constraints',()=>{
 const req={...request,query:'Latest ExampleAgency announcements',requiredTerms:['ExampleAgency','ExampleAgency announcements','latest news']};
 expect(relevantWebSource({title:'ExampleAgency publishes mission update',url:'https://example.org/update',excerpt:'ExampleAgency publishes mission update'},req,'ExampleAgency announcements')).toBe(true);
});

it('does not stop purchase-price refinement at monthly financing or delivery fees',()=>{
 expect(purchasePriceScore({excerpt:'From $42.50 per month',article:{text:'Delivery fee $9.'}})).toBe(0);
 expect(purchasePriceScore({excerpt:'Starting at $510.'})).toBe(1);
 expect(purchasePriceScore({excerpt:'From $42.50 per month',article:{text:'Product: Example Laptop | Listed price: USD 510'}})).toBe(2);
});

it('prefers purchase listings over monthly-payment landing pages and eligibility-only pricing',()=>{
 const sources=[{title:'Buy Example Laptop',url:'https://examplebrand.com/shop/laptop',excerpt:'From $42.50 per month'},{title:'Example Laptop 16GB configuration',url:'https://examplebrand.com/shop/laptop/configuration',excerpt:'Example Laptop with 16GB memory.'},{title:'Education Example Laptop',url:'https://examplebrand.com/us-edu/shop/laptop/configuration',excerpt:'Starting at $450.'}];
 const ranked=rankWebSources(sources,{...request,kind:'web',query:'How much is ExampleBrand asking for its laptop?'},'ExampleBrand laptop price');
 expect(ranked[0]).toBe(sources[1]);expect(ranked.at(-1)).toBe(sources[2]);
});

it('does not require planner filler or region words in city headlines',async()=>{
 const input={...request,query:'What happened in Example City, TX today?',searchQueries:['Example City Texas local events October 1'],requiredTerms:['Example City','local events','breaking news','Example City Texas']};
 const result=await retrieveSearch(input,new AbortController().signal,async()=>new Response(feed([item('Example City approves library expansion','Fri, 02 Oct 2026 03:30:00 GMT')])),now);
 expect(result.sources).toHaveLength(1);expect(result.sources[0].title).toContain('library');
});
it('distinguishes successful empty local-day news retrieval from upstream failure',async()=>{
 const result=await retrieveSearch(request,new AbortController().signal,async()=>new Response(feed([item('Tulsa report from yesterday','Wed, 30 Sep 2026 12:00:00 GMT')])),now);
 expect(result.newsStatus).toBe('no-reports-today');expect(result.searchedDay).toBe(request.day);expect(result.sources).toEqual([]);
 await expect(retrieveSearch(request,new AbortController().signal,async()=>new Response('Blocked',{status:503}),now)).rejects.toThrow('503');
});

it('keeps focused local-feed headlines that omit the city in their title',async()=>{
 const input={...request,query:'What happened in Example City today?',searchQueries:['Example City breaking local events'],requiredTerms:['Example City','breaking news']};
 const result=await retrieveSearch(input,new AbortController().signal,async url=>{
  expect(url.searchParams.get('q')).toContain('Example City');
  return new Response(feed([item('Council approves library expansion','Fri, 02 Oct 2026 03:30:00 GMT')]));
 },now);
 expect(result.sources[0].title).toBe('Council approves library expansion');
});
