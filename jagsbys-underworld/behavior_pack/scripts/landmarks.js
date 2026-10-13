import {world,system} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
import {NATURAL_ARENAS} from './natural_arena_catalog.js';
import {chunkLease} from './chunk_loading.js';
import {runGenerationJob} from './generation_queue.js';
import {candidateAt,GIANTS,landmarkRecords,villageBoxes,spacingAllows,LANDMARK_PREFIX} from './landmark_sites.js';
import {surveyLandmark,clearVolume,fillSupports,fillSolidFoundation,carveTile,obstructionReason} from './landmark_terrain.js';
import {terrainSurvey} from './terrain_survey.js';
import {giantSearch,giantSites,smallSites,attemptKey} from './giant_search.js';
import {surveyModularFortress,modularSections,modularCoreBox} from './modular_fortress.js';
const retries=new Map();let busy=false,status='Waiting for unchecked landmark sites.';
let diagnostics;
function pauseForPlayer(c){
 retries.set(attemptKey(c),system.currentTick+200);
 // A one-shot retry exists only after an active build pauses for a player.
 system.runTimeout(()=>{
  if(busy||!players().length)return;
  busy=true;runGenerationJob(naturalSearch());
 },200);
}
function recordDiagnostic(c,outcome,reason){
 if(!diagnostics){try{diagnostics=JSON.parse(world.getDynamicProperty('underworld_landmarks:diagnostics')??'[]');}catch{diagnostics=[];}}
 diagnostics.push({id:c.id,x:c.x,z:c.z,outcome,reason});diagnostics=diagnostics.slice(-8);world.setDynamicProperty('underworld_landmarks:diagnostics',JSON.stringify(diagnostics));
}
const SUPPORT_PREFIX='underworld_landmarks:support_';
const players=()=>world.getPlayers().filter(p=>p.dimension.id==='minecraft:nether'&&p.location.y<120);
const boxFor=c=>({x:c.x-Math.floor(ARENAS[c.id].size[0]/2),z:c.z-Math.floor(ARENAS[c.id].size[2]/2),sx:ARENAS[c.id].size[0],sz:ARENAS[c.id].size[2]});
export function playersClear(online,box,margin=32){return online.every(p=>{
 const x=Math.max(box.x,Math.min(p.location.x,box.x+box.sx-1)),z=Math.max(box.z,Math.min(p.location.z,box.z+box.sz-1));return Math.hypot(p.location.x-x,p.location.z-z)>=margin;
});}
export function naturalCandidates(online,seed,tick=system.currentTick){
 const all=new Map(),visited=new Set(),observations=terrainSurvey.nearby(online),ground=terrainSurvey.nearbyGround(online);
 for(const player of online)for(const [family,size] of [['giant',1600],['small',600],['ruin',192]]){
  const gx=Math.floor(player.location.x/size),gz=Math.floor(player.location.z/size),radius=Math.ceil(768/size);
  for(let x=gx-radius;x<=gx+radius;x++)for(let z=gz-radius;z<=gz+radius;z++){
   const region=candidateAt(family,x,z,seed);if(!region.id||visited.has(region.key))continue;visited.add(region.key);
   let saved;try{saved=JSON.parse(world.getDynamicProperty(region.key)??'null');}catch{}
   if(saved&&saved.state!=='placing'&&(!['giant','small'].includes(family)||saved.state!=='rejected'))continue;
   const sites=saved?.state==='placing'?[{...region,id:saved.id,x:saved.x,z:saved.z,saved}]:
     family==='giant'?giantSites(region,observations):family==='small'?smallSites(region,ground):[region];
   const eligible=[];
   for(const c of sites){
    if((retries.get(attemptKey(c))??0)>tick||(!c.saved&&['giant','small'].includes(family)&&giantSearch.failed(c)))continue;
    const distance=Math.min(...online.map(p=>Math.hypot(c.x-p.location.x,c.z-p.location.z)));
    if(distance>768||!playersClear(online,c.saved?.box??(c.family==='giant'?modularCoreBox(c):boxFor(c)),32))continue;
    eligible.push({...c,distance,priority:c.saved?0:c.observed?1:family==='giant'?3:2});
   }
   eligible.sort((a,b)=>a.priority-b.priority||(b.score??0)-(a.score??0)||a.distance-b.distance||a.x-b.x||a.z-b.z);
   if(eligible.length)all.set(region.key,eligible[0]);
  }
 }
 return [...all.values()].sort((a,b)=>a.priority-b.priority||a.distance-b.distance||a.key.localeCompare(b.key));
}
function save(c,r){world.setDynamicProperty(c.key,JSON.stringify(r));}
function reject(c,reason){if(['giant','small'].includes(c.family))giantSearch.reject(c,reason);else save(c,{state:'rejected',reason});}
function supportKey(c,index){return `${SUPPORT_PREFIX}${c.family}_${c.gx}_${c.gz}_${index}`;}
export function* generateLandmark(c,dimension){
 let lease;const started=system.currentTick;
 const progress=message=>{status=`${c.family==='giant'&&!c.saved&&!c.selected?'Giant site':ARENAS[c.id].display_name}: ${message} (${Math.floor((system.currentTick-started)/20)}s).`;};
 try{
  let record=c.saved,plan;
  if(record)c={...c,id:record.id};
  if(!record){
   const records=landmarkRecords(),villages=villageBoxes();
   const smallest=c.family==='giant'?{...c,id:'large_arena'}:c;
   if(!spacingAllows(smallest,c.family==='giant'?modularCoreBox(c):boxFor(smallest),records,villages)){
    reject(c,'Spacing from an existing structure or village');recordDiagnostic(c,'rejected','Spacing from an existing structure or village');return {outcome:'rejected'};
   }
   status=`Surveying ${ARENAS[c.id].display_name} at ${c.x}, ${c.z}.`;
   plan=c.family==='giant'?yield* surveyModularFortress(c,dimension,{progress,allowed:box=>spacingAllows({...c,id:'mega_fortress'},box,records,villages)&&playersClear(players(),box,32)}):yield* surveyLandmark(c,dimension,progress);
   if(plan.outcome!=='ready'){
    if(plan.outcome==='unsuitable')reject(c,plan.reason);
    else retries.set(attemptKey(c),system.currentTick+1200);
    status=`${ARENAS[c.id].display_name}: ${plan.reason}.`;recordDiagnostic(c,plan.outcome,plan.reason);return {outcome:plan.outcome};
   }
   if(plan.id)c={...c,id:plan.id,selected:true};
   if(!plan.modular&&(!spacingAllows(c,plan.box,landmarkRecords(),villageBoxes())||!playersClear(players(),plan.box,32))){
    retries.set(attemptKey(c),system.currentTick+1200);return;
   }
   const supports=plan.supports.flat();
   for(const [i,section] of (plan.sections??NATURAL_ARENAS[c.id].sections).entries()){
    const x=plan.origin.x+section.offset[0],z=plan.origin.z+section.offset[2];
    world.setDynamicProperty(supportKey(c,i),JSON.stringify(supports.filter(p=>p.x>=x&&p.x<x+section.size[0]&&p.z>=z&&p.z<z+section.size[2])));
   }
   record={state:'placing',id:c.id,family:c.family,x:c.x,z:c.z,origin:plan.origin,box:plan.box,surface:plan.surface,ocean:plan.ocean,carve:plan.carve??false,solidFoundation:plan.carve??false,modular:plan.modular??false,modules:plan.modules,next:0};
   save(c,record);
  }
  const arena=record.modular?{display_name:'Mega Fortress',sections:modularSections(record.modules)}:NATURAL_ARENAS[c.id];
  for(let index=record.next;index<arena.sections.length;index++){
   const section=arena.sections[index],[x,y,z]=section.offset;
   const pos={x:record.origin.x+x,y:record.origin.y+y,z:record.origin.z+z};
   progress(`Loading placement tile ${index+1}/${arena.sections.length}`);
   lease=chunkLease(dimension,'landmark');yield* lease.load(pos,section.size);
   progress(`Placing tile ${index+1}/${arena.sections.length}`);
   if(!playersClear(players(),record.box,32)){pauseForPlayer(c);status='Landmark paused: player approached its footprint.';return;}
   const supports=JSON.parse(world.getDynamicProperty(supportKey(c,index))??'[]');
   if(!record.tilePlaced){
    if(!(yield* clearVolume(dimension,pos,section.size,record.surface,record.ocean,record.supporting?['minecraft:polished_blackstone']:[],record.carve??false))){status=`Landmark paused: ${obstructionReason()}`;retries.set(attemptKey(c),system.currentTick+1200);return;}
    record.supporting=true;save(c,record);
    if(record.carve)carveTile(dimension,pos,section.size);
    // Persist native placement before yielding for supports; restart cannot
    // replace an already placed tile or mistake its architecture for terrain.
    if(!playersClear(players(),record.box,32)){pauseForPlayer(c);return;}
    world.structureManager.place(section.id,dimension,pos,{includeEntities:false,includeBlocks:true});
    record.tilePlaced=true;save(c,record);
   }
   if(record.solidFoundation)yield* fillSolidFoundation(dimension,pos,section.size,section.foundation?{...section.foundation,x:record.origin.x+section.foundation.x,z:record.origin.z+section.foundation.z}:record.box,record.origin.y-1,()=>playersClear(players(),record.box,32));
   else yield* fillSupports(dimension,supports,()=>playersClear(players(),record.box,32),record.carve??false);
   record.next=index+1;record.supporting=false;record.tilePlaced=false;save(c,record);world.setDynamicProperty(supportKey(c,index),undefined);
   lease.release();lease=undefined;yield {waitTicks:2};
  }
  record.state='built';save(c,record);status=`${arena.display_name} generated at ${record.origin.x}, ${record.origin.y}, ${record.origin.z}.`;if(record.modular)status+=` (${record.modules.length} connected modules).`;recordDiagnostic(c,'built',status);return {outcome:'built'};
 }catch(error){if(error.message==='Player approached the foundation')pauseForPlayer(c);else retries.set(attemptKey(c),system.currentTick+1200);status=`Landmark deferred: ${error.message}`;console.warn(`[Underworld landmarks] ${status}`);recordDiagnostic(c,'deferred',error.message);return {outcome:'deferred'};}
 finally{lease?.release();}
}
export function* naturalSearch(){
 try{
  const online=players();if(!online.length)return;
  let seed=world.getDynamicProperty('nether_settlements:terrain_seed');
  if(typeof seed!=='number'){seed=Math.floor(Math.random()*2147483647);world.setDynamicProperty('nether_settlements:terrain_seed',seed);}
  for(let attempt=0;attempt<4;attempt++){
   const c=naturalCandidates(online,seed)[0];
   if(!c){status='No unchecked or retry-ready sites currently in range; explore farther.';break;}
   const result=yield* generateLandmark(c,online[0].dimension);
   if(result?.outcome!=='rejected'&&result?.outcome!=='unsuitable')break;
  }
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
 if(id==='jagsby_nether:structures_diagnostics'){
  let history;try{history=JSON.parse(world.getDynamicProperty('underworld_landmarks:diagnostics')??'[]');}catch{history=[];}
  player.sendMessage(history.length?history.slice(-4).map(r=>`${r.id} at ${r.x}, ${r.z}: ${r.outcome} — ${r.reason}`).join('\n'):'No completed landmark assessments recorded yet.');
 }
 if(id==='jagsby_nether:structures_status')player.sendMessage(`[Underworld structures] ${status}`);
 if(id==='jagsby_nether:structures_find'){
  const records=landmarkRecords().filter(r=>r.state==='built').sort((a,b)=>Math.hypot(a.x-player.location.x,a.z-player.location.z)-Math.hypot(b.x-player.location.x,b.z-player.location.z));
  const r=records[0];player.sendMessage(r?`${ARENAS[r.id].display_name}: ${r.origin.x}, ${r.origin.y}, ${r.origin.z}`:'No completed natural landmarks recorded yet.');
 }
});
