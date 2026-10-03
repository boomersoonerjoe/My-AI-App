import type { SearchEvidence } from './search';
export type MessageRole = "user" | "assistant";
export interface Message { id:string; text:string; createdAt:string; role:MessageRole; evidence?:SearchEvidence }
export interface Conversation { id:string; title:string; messages:Message[] }
export interface MemoryNote { id:string; text:string }
export interface ImageDraft { id:string; prompt:string; negativePrompt:string; size:string }
export interface AppData {
  schemaVersion:1;
  selectedModelID?:string;
  conversations:Conversation[];
  memories:MemoryNote[];
  imageDrafts:ImageDraft[];
}
export const emptyData=():AppData=>({schemaVersion:1,conversations:[],memories:[],imageDrafts:[]});
