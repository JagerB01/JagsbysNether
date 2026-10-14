import {world} from '@minecraft/server';
export const LANDMARK_PREFIX='underworld_landmarks:site_';
export const GIANT_REGION=1600,GIANT_SEPARATION=1500,ARENA_SEPARATION=600,GIANT_SMALL_GAP=150,VILLAGE_GAP=50;
export const GIANTS=['large_arena','dragon_arena','mega_fortress'];
export function random(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function candidateAt(family,gx,gz,seed){
 const n=(Math.imul(gx,374761393)^Math.imul(gz,668265263)^seed^(family==='giant'?0x137a:family==='small'?0x567b:0x915c))>>>0,rng=random(n);
 const size=family==='giant'?GIANT_REGION:family==='small'?600:192;
 const margin=family==='giant'?250:family==='small'?100:32;
 const x=gx*size+margin+Math.floor(rng()*(size-2*margin)),z=gz*size+margin+Math.floor(rng()*(size-2*margin));
 const roll=rng();let id,biome;
 if(family==='giant')id=roll<1/3?'large_arena':roll<2/3?'dragon_arena':'mega_fortress';
 else if(family==='small'){id='small_arena';biome='basalt_deltas';}
 else id=roll<.08?'grave_yard':roll<.14?'large_blackstone_pillars':roll<.18?'large_blackstone_walls':undefined;
 return {family,gx,gz,x,z,id,biome,selectionRoll:roll,seed:n,key:`${LANDMARK_PREFIX}${family}_${gx}_${gz}`};
}
export function boxGap(a,b){
 const dx=Math.max(0,a.x-(b.x+b.sx-1),b.x-(a.x+a.sx-1));
 const dz=Math.max(0,a.z-(b.z+b.sz-1),b.z-(a.z+a.sz-1));return Math.hypot(dx,dz);
}
export function landmarkRecords(storage=world){
 const records=[];
 for(const key of storage.getDynamicPropertyIds())if(key.startsWith(LANDMARK_PREFIX)){
  try{const r=JSON.parse(storage.getDynamicProperty(key));if(r&&(r.state==='built'||r.state==='placing')&&r.box)records.push({...r,key});}catch{}
 }
 return records;
}
export function villageBoxes(storage=world){
 const boxes=[];
 for(const key of storage.getDynamicPropertyIds())if(key.startsWith('nether_settlements:village_location_')){
  try{const v=JSON.parse(storage.getDynamicProperty(key));if(v?.houses>=3)boxes.push(v.bounds??{x:v.x-56,z:v.z-56,sx:113,sz:113});}catch{}
 }
 return boxes;
}
export function spacingAllows(candidate,box,records,villages){
 const giant=GIANTS.includes(candidate.id);
 for(const r of records){
  if(r.key===candidate.key)continue;
  if(boxGap(box,r.box)<32)return false;
  if(giant&&GIANTS.includes(r.id)&&Math.hypot(candidate.x-r.x,candidate.z-r.z)<GIANT_SEPARATION)return false;
  if((giant&&r.id==='small_arena')||(candidate.id==='small_arena'&&GIANTS.includes(r.id))){if(Math.hypot(candidate.x-r.x,candidate.z-r.z)<GIANT_SMALL_GAP)return false;}
  else if(candidate.id==='small_arena'&&r.id==='small_arena'&&Math.hypot(candidate.x-r.x,candidate.z-r.z)<ARENA_SEPARATION)return false;
  if(candidate.family==='ruin'&&r.family==='ruin'&&Math.hypot(candidate.x-r.x,candidate.z-r.z)<150)return false;
 }
 return villages.every(v=>boxGap(box,v)>=(giant?VILLAGE_GAP:32));
}
export function villageLandmarkClear(box,records=landmarkRecords()){return records.every(r=>boxGap(box,r.box)>=(GIANTS.includes(r.id)?VILLAGE_GAP:32));}
