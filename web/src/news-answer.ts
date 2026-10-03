import type {SearchEvidence} from './search';
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
export function validNewsDates(text:string,evidence:SearchEvidence) {
 const sourceText=evidence.sources.map(source=>`${source.title} ${source.excerpt} ${source.article?.text || ''}`).join(' ').toLowerCase();
 const isPublication=(index:number)=>/\b(?:published|reported|publication date|dated)\s*[:on, ]*$/i.test(text.slice(Math.max(0,index-40),index).replace(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*$/i,''));
 const year=new Date(evidence.fetchedAt).getUTCFullYear();
 for(const match of text.matchAll(/\b20\d{2}-\d{2}-\d{2}\b/g)) {
  if(!(isPublication(match.index!) && evidence.sources.some(source=>source.publishedDay===match[0])) && !sourceText.includes(match[0]))return false;
 }
 for(const match of text.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?/gi)) {
  const month=months.indexOf(match[1].toLowerCase())+1;
  const date=`${match[3] || year}-${String(month).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  if(!Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return false;
  if(!(isPublication(match.index!) && evidence.sources.some(source=>source.publishedDay===date)) && !sourceText.includes(match[0].toLowerCase()))return false;
  const before=text.slice(Math.max(0,match.index!-12),match.index);
  const weekday=before.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*$/i)?.[1];
  if(weekday && new Intl.DateTimeFormat('en',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)).toLowerCase()!==weekday.toLowerCase())return false;
 }
 return true;
}
export function supportedNewsAnswer(evidence:SearchEvidence) {
 const prefix=evidence.scope==='today' ? "Today's published reports cover" : 'The latest reporting covers';
 return `${prefix} ${evidence.sources.slice(0,2).map(source=>`“${source.title}”`).join(' and ')}.`;
}
