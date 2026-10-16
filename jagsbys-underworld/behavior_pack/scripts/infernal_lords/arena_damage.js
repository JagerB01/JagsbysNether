// Bedrock armed Brute is roughly 15 raw damage on Hard. Arena casters sit just below it.
export const CASTER_HIT={Easy:6,Normal:10,Hard:14};
export const CASTER_LINGER={Easy:1,Normal:1.5,Hard:2};
export const casterHit=difficulty=>CASTER_HIT[difficulty]??CASTER_HIT.Normal;
export const casterLinger=difficulty=>CASTER_LINGER[difficulty]??CASTER_LINGER.Normal;
// All patches from one fire cast share opening-hit history. Bounded memory,
// pruned only during active hits; no interval or world/player scan.
const casts=new Map();
export function fireCastHits(id,tick){
 for(const [key,value] of casts)if(tick-value.tick>600)casts.delete(key);
 if(!casts.has(id)){
  if(casts.size>=128)casts.delete(casts.keys().next().value);
  casts.set(id,{tick,hits:new Set()});
 }
 return casts.get(id).hits;
}
