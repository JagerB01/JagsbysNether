import {world} from '@minecraft/server';
import {GIANT_REGION} from './landmark_sites.js';
const PREFIX='underworld_landmarks:search_';
export const GIANT_SEARCH_STEP=128;
export const ATTEMPT_CELL=64;
export function regionSize(c){return c.family==='small'?600:GIANT_REGION;}
function regionKey(c){return `${c.family==='small'?'small_':''}${c.gx}_${c.gz}`;}
export function attemptCell(c){const size=regionSize(c);return `${Math.floor((c.x-c.gx*size)/ATTEMPT_CELL)},${Math.floor((c.z-c.gz*size)/ATTEMPT_CELL)}`;}
export function attemptKey(c){return ['giant','small'].includes(c.family)?`${c.key}@${attemptCell(c)}`:c.key;}
export class GiantSearch {
 constructor(storage=world){this.storage=storage;this.regions=new Map();}
 state(c){
  const key=regionKey(c);
  if(!this.regions.has(key)){
   let saved;try{saved=JSON.parse(this.storage.getDynamicProperty(PREFIX+key)??'null');}catch{}
   // Reopen older strict-policy failures once; completed/reserved builds stay intact.
   const failed=new Set(saved?.policy===6&&Array.isArray(saved.failed)?saved.failed:[]);
   this.regions.set(key,{failed,lastReason:saved?.lastReason});
  }
  return this.regions.get(key);
 }
 failed(c){return this.state(c).failed.has(attemptCell(c));}
 reject(c,reason){
  const state=this.state(c);state.failed.add(attemptCell(c));state.lastReason=reason;
  this.storage.setDynamicProperty(PREFIX+regionKey(c),JSON.stringify({version:1,policy:6,failed:[...state.failed],lastReason:reason}));
  while(this.regions.size>256)this.regions.delete(this.regions.keys().next().value);
 }
}
export const giantSearch=new GiantSearch();
export function giantSites(region,observations){
 const found=new Map(),density=new Map();
 for(const [x,z,y] of observations){
  if(Math.floor(x/GIANT_REGION)!==region.gx||Math.floor(z/GIANT_REGION)!==region.gz)continue;
  const c={...region,regionX:region.x,regionZ:region.z,x,z,surfaceHint:y,observed:true},key=attemptCell(c);
  density.set(key,(density.get(key)??0)+1);if(!found.has(key))found.set(key,c);
 }
 for(const [key,c] of found){
  const [cx,cz]=key.split(',').map(Number);let score=0;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)score+=density.get(`${cx+dx},${cz+dz}`)??0;
  c.score=score;
 }
 // Unobserved areas get bounded coarse probes, not one fixed region coordinate.
 for(let x=32;x<GIANT_REGION;x+=GIANT_SEARCH_STEP)for(let z=32;z<GIANT_REGION;z+=GIANT_SEARCH_STEP){
  const c={...region,regionX:region.x,regionZ:region.z,x:region.gx*GIANT_REGION+x,z:region.gz*GIANT_REGION+z,observed:false,score:0};
  if(!found.has(attemptCell(c)))found.set(attemptCell(c),c);
 }
 return [...found.values()];
}

export function smallSites(region,observations){
 const sites=new Map();
 for(const [x,z,y,score,material] of observations){
  if(Math.floor(x/600)!==region.gx||Math.floor(z/600)!==region.gz)continue;
  const basalt=['minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone'].includes(material);
  const c={...region,x,z,floorHint:y,observed:true,score:score+(basalt?2000:0)};
  if(!sites.has(attemptCell(c)))sites.set(attemptCell(c),c);
 }
 for(let x=32;x<600;x+=64)for(let z=32;z<600;z+=64){
  const c={...region,x:region.gx*600+x,z:region.gz*600+z,score:0,observed:false};
  if(!sites.has(attemptCell(c)))sites.set(attemptCell(c),c);
 }
 return [...sites.values()];
}
