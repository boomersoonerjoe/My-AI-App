import type { RetrievalPlan } from './retrieval-plan';
import type { DeviceContext } from './device-context';
import type { SearchEvidence } from './search';
export interface ChatRequest { prompt: string; device?: DeviceContext; evidence?: SearchEvidence; showSources?: boolean; recalled?: boolean; reasoning?: boolean; responseKind?: 'source-selection' | 'grounded-answer' | 'retrieval-plan' }
export interface ProviderStatus {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  progress?: number;
}
export interface ChatProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  dispose?(): Promise<void>;
  prepare(onStatus: (status: ProviderStatus) => void): Promise<void>;
  planRetrieval?(question: string, device: DeviceContext, signal: AbortSignal): Promise<RetrievalPlan>;
  generate(request: ChatRequest, onUpdate: (text: string) => void, signal: AbortSignal): Promise<string>;
}
