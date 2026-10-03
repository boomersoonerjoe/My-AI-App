import type {SearchEvidence} from '../src/search';
export function requiresCurrentPrice(query:string,intent?:string):boolean;
export function gateCurrentPrices(evidence:SearchEvidence):SearchEvidence;
