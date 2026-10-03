import {it,expect} from 'vitest';
import {validNewsDates,supportedNewsAnswer} from './news-answer';
import type {SearchEvidence} from './search';
const e:SearchEvidence={query:'local news',scope:'recent',provider:'fixture',fetchedAt:'2026-10-03T06:00:00Z',timeZone:'America/Chicago',sources:[{title:'Council approves library expansion',url:'https://example.org/',excerpt:'Council approves library expansion',publishedAt:'2026-10-03T03:00:00Z',publishedDay:'2026-10-02'}]};
it('does not mistake the UTC publication day for the local day or invent a weekday',()=>{
 expect(validNewsDates('Published 2026-10-03.',e)).toBe(false);
 expect(validNewsDates('Published Friday, October 99th.',e)).toBe(false);
 expect(validNewsDates('Published Friday, October 3rd.',e)).toBe(false);
 expect(validNewsDates('Published Thursday, October 2nd.',e)).toBe(false);
 expect(validNewsDates('Published Friday, October 2nd.',e)).toBe(true);
 expect(validNewsDates('The event is scheduled for October 2nd.',e)).toBe(false);
 expect(validNewsDates(supportedNewsAnswer(e),e)).toBe(true);
});
