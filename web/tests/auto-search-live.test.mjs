import { it, expect, vi } from 'vitest';
import { answerConversation } from '../src/chat-service';
import { deviceContext } from '../src/device-context';
import { retrieveSearch } from '../scripts/search-service.mjs';

// Opt in because this exercises public services rather than deterministic fixtures.
const enabled = process.env.NHOMEAI_SEARCH_LIVE_TEST === '1';
for (const question of [
  'Are there any sales currently going on at Best Buy for Ring cameras?',
  'How much does a Ring Battery Doorbell cost at Best Buy?',
  'What is the weather in Tulsa right now?',
  'What happened in technology news today?',
]) {
  it.skipIf(!enabled)(`Auto routes to real retrieval: ${question}`, async () => {
    const clock = deviceContext();
    const search = vi.fn(async (query, device, signal) => retrieveSearch({
      query, kind: /\bnews\b/i.test(query) ? 'news' : 'web',
      today: /\btoday\b/i.test(query), day: device.localDate, timeZone: device.timeZone,
    }, signal));
    const generate = vi.fn(async request => {
      expect(request.evidence.sources.length).toBeGreaterThan(0);
      expect(request.evidence.sources.every(source => source.url.startsWith('https://'))).toBe(true);
      return 'Live evidence received.';
    });
    const result = await answerConversation({id:'live-auto',title:question,messages:[
      {id:'question',role:'user',text:question,createdAt:clock.isoTime},
    ]}, [], {generate}, {
      mode:'auto',signal:AbortSignal.timeout(45000),clock:()=>clock,
      search,onUpdate(){},onActivity(){},
    });
    expect(search).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledOnce();
    expect(result.retryable).toBe(false);
    console.log(JSON.stringify({question,provider:result.evidence.provider,sources:result.evidence.sources.map(s=>({title:s.title,url:s.url}))}));
  }, 50000);
}
