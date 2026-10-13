import {world,system} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
import {NATURAL_ARENAS} from './natural_arena_catalog.js';
import {chunkLease} from './chunk_loading.js';
import {runGenerationJob} from './generation_queue.js';
import {candidateAt,GIANTS,landmarkRecords,villageBoxes,spacingAllows,LANDMARK_PREFIX} from './landmark_sites.js';
import {surveyLandmark,clearVolume,fillSupports} from './landmark_terrain.js';
const retries=new Map();let busy=false,status='Waiting for unchecked landmark sites.';
const SUPPORT_PREFIX='underworld_landmarks:support_';
const players=()=>world.getPlayers().filter(p=>p.dimension.id==='minecraft:nether'&&p.location.y<120);
const boxFor=c=>({x:c.x-Math.floor(ARENAS[c.id].size[0]/2),z:c.z-Math.floor(ARENAS[c.id].size[2]/2),sx:ARENAS[c.id].size[0],sz:ARENAS[c.id].size[2]});
export function playersClear(online,box,margin=32){return online.every(p=>{
 const x=Math.max(box.x,Math.min(p.location.x,box.x+box.sx-1)),z=Math.max(box.z,Math.min(p.location.z,box.z+box.sz-1));return Math.hypot(p.location.x-x,p.location.z-z)>=margin;
});}
export function naturalCandidates(online,seed,tick=system.currentTick){
 const all=new Map();
 for(const player of online)for(const [family,size] of [['giant',1600],['small',600],['ruin',192]]){
  const gx=Math.floor(player.location.x/size),gz=Math.floor(player.location.z/size),radius=Math.ceil(768/size);
  for(let x=gx-radius;x<=gx+radius;x++)for(let z=gz-radius;z<=gz+radius;z++){
   const c=candidateAt(family,x,z,seed);if(!c.id||(retries.get(c.key)??0)>tick)continue;
   const distance=Math.min(...online.map(p=>Math.hypot(c.x-p.location.x,c.z-p.location.z)));
   if(distance>768)continue;
   let saved;try{saved=JSON.parse(world.getDynamicProperty(c.key)??'null');}catch{}
   if(saved&&saved.state!=='placing')continue;
   if(!playersClear(online,saved?.box??boxFor(c),GIANTS.includes(c.id)?128:64))continue;
   all.set(c.key,{...c,saved,distance});
  }
 }
 // Resume interrupted builds first, then alternate families by deterministic distance.
 return [...all.values()].sort((a,b)=>Number(!!b.saved)-Number(!!a.saved)||a.distance-b.distance||a.key.localeCompare(b.key));
}
function save(c,r){world.setDynamicProperty(c.key,JSON.stringify(r));}
function supportKey(c,index){return `${SUPPORT_PREFIX}${c.family}_${c.gx}_${c.gz}_${index}`;}
export function* generateLandmark(c,dimension){
 let lease;
 try{
  let record=c.saved,plan;
  if(!record){
   if(!spacingAllows(c,boxFor(c),landmarkRecords(),villageBoxes())){
    save(c,{state:'rejected',reason:'Spacing from an existing structure or village'});return;
   }
   status=`Surveying ${ARENAS[c.id].display_name} at ${c.x}, ${c.z}.`;
   plan=yield* surveyLandmark(c,dimension);
   if(plan.outcome!=='ready'){
    if(plan.outcome==='unsuitable')save(c,{state:'rejected',reason:plan.reason});
    else retries.set(c.key,system.currentTick+1200);
    status=`${ARENAS[c.id].display_name}: ${plan.reason}.`;return;
   }
   if(!spacingAllows(c,plan.box,landmarkRecords(),villageBoxes())||!playersClear(players(),plan.box,32)){
    retries.set(c.key,system.currentTick+1200);return;
   }
   const supports=plan.supports.flat();
   for(const [i,section] of NATURAL_ARENAS[c.id].sections.entries()){
    const x=plan.origin.x+section.offset[0],z=plan.origin.z+section.offset[2];
    world.setDynamicProperty(supportKey(c,i),JSON.stringify(supports.filter(p=>p.x>=x&&p.x<x+section.size[0]&&p.z>=z&&p.z<z+section.size[2])));
   }
   record={state:'placing',id:c.id,family:c.family,x:c.x,z:c.z,origin:plan.origin,box:plan.box,surface:plan.surface,ocean:plan.ocean,next:0};
   save(c,record);
  }
  const arena=NATURAL_ARENAS[c.id];
  for(let index=record.next;index<arena.sections.length;index++){
   const section=arena.sections[index],[x,y,z]=section.offset;
   const pos={x:record.origin.x+x,y:record.origin.y+y,z:record.origin.z+z};
   lease=chunkLease(dimension,'landmark');yield* lease.load(pos,section.size);
   if(!playersClear(players(),record.box,32)){retries.set(c.key,system.currentTick+1200);status='Landmark paused: player approached its footprint.';return;}
   if(!(yield* clearVolume(dimension,pos,section.size,record.surface,record.ocean,record.supporting?['minecraft:polished_blackstone']:[]))){status='Landmark paused: terrain changed before placement.';retries.set(c.key,system.currentTick+1200);return;}
   // Persist before foundation writes so a restart can finish this section.
   record.supporting=true;save(c,record);
   const supports=JSON.parse(world.getDynamicProperty(supportKey(c,index))??'[]');
   yield* fillSupports(dimension,supports,()=>playersClear(players(),record.box,32));
   // No yield between the final player check, native placement and progress record.
   if(!playersClear(players(),record.box,32)){retries.set(c.key,system.currentTick+1200);return;}
   world.structureManager.place(section.id,dimension,pos,{includeEntities:false,includeBlocks:true});
   record.next=index+1;record.supporting=false;save(c,record);world.setDynamicProperty(supportKey(c,index),undefined);
   lease.release();lease=undefined;yield {waitTicks:2};
  }
  record.state='built';save(c,record);status=`${arena.display_name} generated at ${record.origin.x}, ${record.origin.y}, ${record.origin.z}.`;
 }catch(error){retries.set(c.key,system.currentTick+1200);status=`Landmark deferred: ${error.message}`;console.warn(`[Underworld landmarks] ${status}`);}
 finally{lease?.release();}
}
export function* naturalSearch(){
 try{
  const online=players();if(!online.length)return;
  let seed=world.getDynamicProperty('nether_settlements:terrain_seed');
  if(typeof seed!=='number'){seed=Math.floor(Math.random()*2147483647);world.setDynamicProperty('nether_settlements:terrain_seed',seed);}
  const c=naturalCandidates(online,seed)[0];if(c)yield* generateLandmark(c,online[0].dimension);
 }finally{busy=false;}
}
system.runInterval(()=>{
 if(busy||!players().length)return;
 for(const [key,until] of retries)if(until<=system.currentTick)retries.delete(key);
 // One queued job at most; villages and templates share the same budgeted worker.
 busy=true;runGenerationJob(naturalSearch());
},100);
system.afterEvents.scriptEventReceive.subscribe(({id,sourceEntity:player})=>{
 if(player?.typeId!=='minecraft:player')return;
 if(id==='jagsby_nether:structures_status')player.sendMessage(`[Underworld structures] ${status}`);
 if(id==='jagsby_nether:structures_find'){
  const records=landmarkRecords().filter(r=>r.state==='built').sort((a,b)=>Math.hypot(a.x-player.location.x,a.z-player.location.z)-Math.hypot(b.x-player.location.x,b.z-player.location.z));
  const r=records[0];player.sendMessage(r?`${ARENAS[r.id].display_name}: ${r.origin.x}, ${r.origin.y}, ${r.origin.z}`:'No completed natural landmarks recorded yet.');
 }
});
