import {Conversation,MemoryNote} from "./types";
import { relevantMemories } from './memory';
const enc=new TextEncoder();
function bytes(s:string){return enc.encode(s).length}
function prefix(s:string,limit:number){let out="";for(const c of s){if(bytes(out+c)>limit)break;out+=c}return out}
export function buildPrompt(conversation:Conversation,memories:MemoryNote[]){
 const latest=conversation.messages.at(-1); if(!latest||latest.role!=="user") throw new Error("No user message to answer.");
 if(bytes(latest.text)>1200) throw new Error("Send a shorter message (up to 1,200 UTF-8 bytes).");
 const notes=relevantMemories(conversation,memories).map(x=>x.text).join("\n"); const recent:string[]=[]; let budget=2000;
 for(const m of conversation.messages.slice(0,-1).reverse()){const line=`${m.role}: ${prefix(m.text, Math.min(900,budget-30))}\n`;if(budget<40)break;recent.unshift(line);budget-=bytes(line)}
 return `Relevant saved memory notes (local, explicitly saved by the user; only matching notes are included):\n${notes || '(No matching saved memories.)'}\nRecent conversation excerpt (older messages may be omitted):\n${recent.join("")}\nCurrent user message:\n${latest.text}\nRespond to the current user message.`;
}
