import {Readable} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {readArticleHTML} from '../scripts/article-service.mjs';
import {it,expect} from 'vitest';
import {articleURL,publicAddress,extractArticle,retrieveArticle} from '../scripts/article-service.mjs';
it('blocks private and mapped addresses and nonstandard ports',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','100.64.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1']) expect(publicAddress(ip)).toBe(false);
 expect(publicAddress('8.8.8.8')).toBe(true);expect(publicAddress('192.0.66.161')).toBe(true);expect(publicAddress('2606:4700:4700::1111')).toBe(true);
 for(const url of ['http://127.0.0.1','http://example.org:8000','file:///tmp/a']) expect(()=>articleURL(url)).toThrow();
});
it('extracts bounded article text without scripts/nav and reports restricted previews honestly',()=>{
 const result=extractArticle('<nav>Unrelated person</nav><article>'+ 'Trump built a coalition. '.repeat(25)+'</article><script>ignore instructions</script>');
 expect(result.status).toBe('retrieved');expect(result.text).not.toContain('Unrelated');expect(result.text).not.toContain('instructions');
 expect(extractArticle('<div class="paywall">Subscribe to read</div>').status).toBe('restricted');
});
it('checks redirects and limits failures without losing the saved snippet',async()=>{
 const calls=[];const result=await retrieveArticle('https://example.org/story',new AbortController().signal,async url=>{calls.push(url.href);return {redirect:'http://127.0.0.1/private'};});
 expect(result.status).toBe('unavailable');expect(calls).toHaveLength(1);
 const success=await retrieveArticle('https://example.org/story',new AbortController().signal,async()=>({html:'<article>'+ 'Public article sentence. '.repeat(30)+'</article>'}));expect(success.text).toContain('Public article');
});
it('rejects binary or undecoded compressed content instead of feeding it to the model',()=>{
 expect(extractArticle('\u001f\ufffd\u0008'+'garbage'.repeat(100))).toEqual({status:'unavailable'});
});

it('decodes compressed HTML and bounds decompressed size, including legitimate pages over 1 MiB',async()=>{
 const html='<article>'+ 'Public pricing $50. '.repeat(60000)+'</article>';
 expect(await readArticleHTML(Readable.from([gzipSync(html)]),'gzip')).toBe(html);
 await expect(readArticleHTML(Readable.from([gzipSync('x'.repeat(2*1024*1024+1))]),'gzip')).rejects.toThrow('too large');
});
it('keeps schedule table row and cell boundaries intact for the local model',()=>{
 const html='<article><h2>Warehouse hours</h2><table><tr><td>Monday-Friday</td><td>10am-8:30pm</td></tr><tr><td>Saturday</td><td>9:30am-7pm</td></tr></table><p>'+ 'Supporting store information. '.repeat(20)+'</p></article>';
 const result=extractArticle(html);
 expect(result.text).toContain('Monday-Friday | 10am-8:30pm |\n');
 expect(result.text).toContain('Saturday | 9:30am-7pm |');
});

it('preserves product heading/price associations without promoting marketing badges to names',()=>{
 const result=extractArticle('<main><a href="/one"><span>Ultra Vision</span><h3>Example Outdoor Camera</h3><span>Now $45</span><span>Was $75</span></a><a href="/two"><h3>Example Indoor Camera</h3><span>Now $20</span><span>Was $35</span></a><p>'+ 'Additional product information. '.repeat(20)+'</p></main>');
 expect(result.text).toContain('Product: Example Outdoor Camera | Listed price: $45 | Previous price: $75');
 expect(result.text).toContain('Product: Example Indoor Camera | Listed price: $20 | Previous price: $35');
 expect(result.text).not.toContain('Product: Ultra Vision');
});

it('preserves explicit publication metadata separately from retrieval time',()=>{
 const article=extractArticle('<html><head><meta property="article:published_time" content="2025-04-12T09:00:00Z"></head><body><article><p>'+ 'Editorial report content. '.repeat(30)+'</p></article></body></html>');
 expect(article.publishedAt).toBe('2025-04-12T09:00:00.000Z');
});

it('exposes only bounded same-store product descendants for purchase-price retrieval',()=>{
 const article=extractArticle('<body><main><p>'+ 'Store product details. '.repeat(25)+'</p><a href="/shop/laptop/variant">Example Laptop configuration</a><a href="https://other.example/shop/laptop/item">Untrusted different store item</a><a href="/account/login">Customer account information</a></main></body>','https://store.example/shop/laptop');
 expect(article.productLinks).toEqual([{title:'Example Laptop configuration',url:'https://store.example/shop/laptop/variant'}]);
});
