import {rejectedSites} from './rejected_sites.js';
import {SPACING,candidateAt,farEnough,outsidePlayerBuffer} from './navigation.js';
export const DISTANT_MIN=0,DISTANT_MAX=768,VILLAGE_PLAYER_CLEARANCE=1;
export function distantCandidates(world,players,seed,skip=new Map(),tick=0){
 const eligible=players.filter(p=>p.dimension.id==='minecraft:nether'),sites=new Map();
 for(const player of eligible){
  const gx=Math.floor(player.location.x/SPACING),gz=Math.floor(player.location.z/SPACING);
  for(let x=gx-5;x<=gx+5;x++)for(let z=gz-5;z<=gz+5;z++){
   const c=candidateAt(x,z,seed);
   const distances=eligible.map(p=>Math.hypot(c.x-p.location.x,c.z-p.location.z));
   const nearest=Math.min(...distances);
   if(rejectedSites.blocksPoint(c.x,c.z)||nearest<DISTANT_MIN||nearest>DISTANT_MAX||world.getDynamicProperty(c.key)||(skip.get(c.key)??0)>tick||!farEnough(world,c.x,c.z))continue;
   sites.set(c.key,{...c,distance:nearest});
  }
 }
 return [...sites.values()].sort((a,b)=>a.distance-b.distance||a.x-b.x||a.z-b.z);
}
export function distantClear(players,box){return outsidePlayerBuffer(players,box,VILLAGE_PLAYER_CLEARANCE);}
