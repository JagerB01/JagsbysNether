import {SMALL_FOUNDATION_DEPTH} from './small_arena_terrain.js';
import {nextGiant,nextGiantCommand,consumeNextGiant} from './next_giant.js';
import {placePlannedStructureBoss} from './infernal_lords/structure_bosses.js';
import {recordEncounterSite} from './trial_encounters.js';
import {world,system} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
import {NATURAL_ARENAS} from './natural_arena_catalog.js';
import {chunkLease} from './chunk_loading.js';
import {runGenerationJob} from './generation_queue.js';
import {candidateAt,GIANTS,landmarkRecords,villageBoxes,spacingAllows,LANDMARK_PREFIX} from './landmark_sites.js';
import {surveyLandmark,clearVolume,fillSupports,fillSolidFoundation,megaFoundationMaterial,carveTile,obstructionReason} from './landmark_terrain.js';
import {terrainSurvey} from './terrain_survey.js';
import {giantSearch,giantSites,smallSites,attemptKey} from './giant_search.js';
import {TEST_ONLY_GIANT,FIT_ORDER,giantStartingBox,assessGiantSite,compareGiantSites} from './giant_fit.js';
import {surveyModularFortress,modularSections,modularCoreBox,pendingModuleBox,surveyFortressModule,fortressModuleCount,fortressParent,fortressModuleRequired,extendFortressBox,fortressBuildVolumes} from './modular_fortress.js';
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
export function naturalCandidates(online,seed,tick=system.currentTick,{sitesPerRegion=1}={}){
 const all=new Map(),visited=new Set(),observations=terrainSurvey.nearby(online),ground=terrainSurvey.nearbyGround(online);
 // Snapshot existing footprints once per candidate pass, before any leases or surveys.
 const records=landmarkRecords(),villages=villageBoxes();
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
    if(distance>768)continue;
    const selected=c.family==='giant'&&!c.saved?{...c,id:TEST_ONLY_GIANT??c.id}:c;
    const box=(c.saved?.modular?pendingModuleBox(c,c.saved):c.saved?.box)??(selected.id==='mega_fortress'?modularCoreBox(selected):boxFor(selected));
    // Spacing is eligibility, not failed terrain. Do not queue the site or
    // permanently reject its search cell; another eligible point may fit.
    const boxes=!c.saved&&c.family==='giant'?FIT_ORDER.map(id=>({candidate:{...c,id},box:giantStartingBox(c,id)})):[{candidate:selected,box}];
    if(!c.saved&&boxes.some(s=>!spacingAllows(s.candidate,s.box,records,villages)))continue;
    if(boxes.some(s=>!playersClear(online,s.box,32)))continue;
    eligible.push({...c,distance,priority:c.saved?0:c.observed?1:family==='giant'?3:2});
   }
   eligible.sort((a,b)=>a.priority-b.priority||(b.score??0)-(a.score??0)||a.distance-b.distance||a.x-b.x||a.z-b.z);
   for(const [index,c] of eligible.slice(0,family==='giant'?sitesPerRegion:1).entries())all.set(`${region.key}:${index}`,c);
  }
 }
 return [...all.values()].sort((a,b)=>a.priority-b.priority||a.distance-b.distance||a.key.localeCompare(b.key));
}
function save(c,r){world.setDynamicProperty(c.key,JSON.stringify(r));}
function reject(c,reason){if(['giant','small'].includes(c.family))giantSearch.reject(c,reason);else save(c,{state:'rejected',reason});}
function supportKey(c,index){return `${SUPPORT_PREFIX}${c.family}_${c.gx}_${c.gz}_${index}`;}
export function* generateLandmark(c,dimension,{preparedPlan,forcedSelection,requirePlayers=false}={}){
 let lease;const started=system.currentTick;
 const progress=message=>{status=`${c.family==='giant'&&!c.saved&&!c.selected?'Giant site':ARENAS[c.id].display_name}: ${message} (${Math.floor((system.currentTick-started)/20)}s).`;};
 try{
  let record=c.saved,plan;
  let forced=forcedSelection;
  if(record)c={...c,id:record.id};
  else if(c.family==='giant'&&!c.selected&&TEST_ONLY_GIANT)c={...c,id:TEST_ONLY_GIANT,selected:true};
  if(!record){
   const records=landmarkRecords(),villages=villageBoxes();
   const starting=c.family==='giant'&&!c.selected?FIT_ORDER:[c.id];
   if(starting.some(id=>!spacingAllows({...c,id},c.family==='giant'?giantStartingBox(c,id):boxFor(c),records,villages))){
    // A build may have reserved space since selection. Skip before loading.
    status='Landmark skipped: spacing changed since candidate selection.';return {outcome:'skipped'};
   }
   status=`Surveying ${ARENAS[c.id].display_name} at ${c.x}, ${c.z}.`;
   plan=preparedPlan??(c.family==='giant'&&!c.selected?yield* assessGiantSite(c,dimension,{progress,forcedId:()=>{forced=nextGiant();return forced?.id;},allowed:(id,box)=>spacingAllows({...c,id},box,records,villages)}):c.id==='mega_fortress'?yield* surveyModularFortress(c,dimension,{progress,coreOnly:true,allowed:box=>spacingAllows({...c,id:'mega_fortress'},box,records,villages)}):yield* surveyLandmark(c,dimension,progress));
   if(plan.outcome!=='ready'){
    if(plan.outcome==='unsuitable')reject(c,plan.reason);
    else retries.set(attemptKey(c),system.currentTick+1200);
    status=`${ARENAS[c.id].display_name}: ${plan.reason}.`;recordDiagnostic(c,plan.outcome,plan.reason);return {outcome:plan.outcome};
   }
   if(requirePlayers&&!players().length){status='Landmark paused: no players remain in the Nether.';return {outcome:'paused'};}
   if(plan.id)c={...c,id:plan.id,selected:true};
   if(!plan.modular&&(!spacingAllows(c,plan.box,landmarkRecords(),villageBoxes())||!playersClear(players(),plan.box,32))){
    retries.set(attemptKey(c),system.currentTick+1200);return;
   }
   const supports=plan.supports.flat();
   for(const [i,section] of (plan.sections??NATURAL_ARENAS[c.id].sections).entries()){
    const x=plan.origin.x+section.offset[0],z=plan.origin.z+section.offset[2];
    world.setDynamicProperty(supportKey(c,i),JSON.stringify(supports.filter(p=>p.x>=x&&p.x<x+section.size[0]&&p.z>=z&&p.z<z+section.size[2])));
   }
   record={infernalLordsVersion:1,state:'placing',id:c.id,family:c.family,x:c.x,z:c.z,origin:plan.origin,box:plan.box,surface:plan.surface,ocean:plan.ocean,carve:plan.carve??false,solidFoundation:plan.solidFoundation??plan.carve??false,coreNoCarve:plan.coreNoCarve??false,modular:plan.modular??false,modules:plan.modules,incremental:plan.modular??false,expansionNext:plan.modular?Math.max(...plan.modules)+1:1,next:0};
   save(c,record);
   if(record.id===forced?.id)consumeNextGiant(forced);
  }
  let arena=record.modular?{display_name:'Mega Fortress',sections:modularSections(record.modules)}:NATURAL_ARENAS[c.id];
  for(let index=record.next;;index++){
   if(requirePlayers&&!players().length){status='Landmark paused: no players remain in the Nether; progress saved.';return {outcome:'paused'};}
   if(index>=arena.sections.length){
    if(!record.incremental)break;
    while(record.expansionNext<fortressModuleCount){
     const next=record.expansionNext;
     if(!record.modules.includes(fortressParent(next))||(record.carvingStops??[]).includes(fortressParent(next))){record.expansionNext++;save(c,record);continue;}
     const box=pendingModuleBox(c,record);
     if(!playersClear(players(),box,32)){pauseForPlayer(c);status='Landmark paused: player approached the next module.';return;}
     const result=yield* surveyFortressModule(c,dimension,record,next,{progress,allowed:box=>spacingAllows(c,box,landmarkRecords(),villageBoxes())});
     if(result.outcome==='deferred'){retries.set(attemptKey(c),system.currentTick+1200);status=`Landmark deferred: ${result.reason}`;return;}
     if(result.outcome==='unsuitable'&&fortressModuleRequired(next)){retries.set(attemptKey(c),system.currentTick+1200);status=`Landmark paused: required lower chamber ${next} is blocked: ${result.reason}`;return;}
     record.expansionNext++;
     if(result.outcome==='ready'){record.modules.push(next);if(result.stopExpansion){record.carvingStops??=[];record.carvingStops.push(next);}record.box=extendFortressBox(record.box,result.box);save(c,record);break;}
     save(c,record);
    }
    arena={display_name:'Mega Fortress',sections:modularSections(record.modules)};
    if(index>=arena.sections.length)break;
   }
   const section=arena.sections[index],[x,y,z]=section.offset;
   const pos={x:record.origin.x+x,y:record.origin.y+y,z:record.origin.z+z};
   const activeBox=record.modular?pendingModuleBox(c,record):record.box;
   if(record.modular)record.box=extendFortressBox(record.box,activeBox);
   const tileCarve=(record.carve??false)&&!(record.coreNoCarve&&section.foundation?.moduleIndex===0);
   progress(`Loading placement tile ${index+1}/${arena.sections.length}`);
   lease=chunkLease(dimension,'landmark');yield* lease.load(pos,section.size);
   progress(`Placing tile ${index+1}/${arena.sections.length}`);
   if(!playersClear(players(),activeBox,32)){pauseForPlayer(c);status='Landmark paused: player approached its footprint.';return;}
   const supports=JSON.parse(world.getDynamicProperty(supportKey(c,index))??'[]');
   if(!record.tilePlaced){
    const volumes=(record.modular||record.id==='small_arena')?fortressBuildVolumes(section,pos):[{pos,size:section.size}];
    for(const v of volumes)if(!(yield* clearVolume(dimension,v.pos,v.size,record.surface,record.ocean,record.supporting?['minecraft:polished_blackstone']:[],tileCarve))){status=`Landmark paused: ${obstructionReason()}`;retries.set(attemptKey(c),system.currentTick+1200);return;}
    record.supporting=true;save(c,record);
    if(tileCarve)for(const v of volumes){
     if(!playersClear(players(),activeBox,32)){pauseForPlayer(c);return;}
     carveTile(dimension,v.pos,v.size,record.surface);yield;
    }
    // Persist native placement before yielding for supports; restart cannot
    // replace an already placed tile or mistake its architecture for terrain.
    if(!playersClear(players(),activeBox,32)){pauseForPlayer(c);return;}
    world.structureManager.place(section.id,dimension,pos,{includeEntities:false,includeBlocks:true});
    record.tilePlaced=true;save(c,record);
   }
   if(record.solidFoundation)yield* fillSolidFoundation(dimension,pos,section.size,section.foundation?{...section.foundation,x:record.origin.x+section.foundation.x,z:record.origin.z+section.foundation.z}:record.box,record.origin.y-1,()=>playersClear(players(),activeBox,32),record.modular?megaFoundationMaterial:undefined,(record.modular||record.id==='dragon_arena'||record.id==='small_arena')?section.foundationColumns:undefined,record.id==='small_arena'?SMALL_FOUNDATION_DEPTH:128);
   else yield* fillSupports(dimension,supports,()=>playersClear(players(),activeBox,32),record.carve??false);
   record.next=index+1;record.supporting=false;record.tilePlaced=false;save(c,record);world.setDynamicProperty(supportKey(c,index),undefined);
   lease.release();lease=undefined;yield {waitTicks:2};
  }
  yield* placePlannedStructureBoss(record,dimension);
  record.state='built';save(c,record);recordEncounterSite(record.id,record.origin,dimension.id,c.key,record.modular);status=`${arena.display_name} generated at ${record.origin.x}, ${record.origin.y}, ${record.origin.z}.`;if(record.modular)status+=` (${record.modules.length} connected modules).`;recordDiagnostic(c,'built',status);return {outcome:'built'};
 }catch(error){if(error.message==='Player approached the foundation')pauseForPlayer(c);else retries.set(attemptKey(c),system.currentTick+1200);status=`Landmark deferred: ${error.message}`;console.warn(`[Underworld landmarks] ${status}`);recordDiagnostic(c,'deferred',error.message);return {outcome:'deferred'};}
 finally{lease?.release();}
}
export function* naturalSearch(){
 try{
  const online=players();if(!online.length)return;
  let seed=world.getDynamicProperty('nether_settlements:terrain_seed');
  if(typeof seed!=='number'){seed=Math.floor(Math.random()*2147483647);world.setDynamicProperty('nether_settlements:terrain_seed',seed);}
  for(let attempt=0;attempt<4;attempt++){
   const candidates=naturalCandidates(online,seed,system.currentTick,{sitesPerRegion:3}),c=candidates[0];
   if(!c){status='No unchecked or retry-ready sites currently in range; explore farther.';break;}
   let result;
   if(c.family==='giant'&&!c.saved){
    let forced;const records=landmarkRecords(),villages=villageBoxes();
    const comparison=yield* compareGiantSites(candidates.filter(site=>site.key===c.key),online[0].dimension,{
     progress:message=>{status=message;},
     allowed:(site,id,box)=>spacingAllows({...site,id},box,records,villages),
     canContinue:()=>players().length>0,
     forcedId:()=>{forced=nextGiant();return forced?.id;},
     onResult:(site,plan)=>{
      if(plan.outcome==='unsuitable')reject(site,plan.reason);
      else if(plan.outcome==='deferred')retries.set(attemptKey(site),system.currentTick+1200);
      if(plan.outcome!=='ready')recordDiagnostic(site,plan.outcome,plan.reason);
     }
    });
    if(comparison.outcome!=='ready'){status=comparison.outcome==='paused'?'Landmark comparison paused: no players remain in the Nether.':'No confirmed giant fit in this comparison; other sites remain available.';break;}
    result=yield* generateLandmark(comparison.candidate,online[0].dimension,{preparedPlan:comparison.plan,forcedSelection:forced,requirePlayers:true});
   }else result=yield* generateLandmark(c,online[0].dimension,{requirePlayers:true});
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
system.afterEvents.scriptEventReceive.subscribe(({id,message,sourceEntity:player})=>{
 if(player?.typeId!=='minecraft:player')return;
 if(id==='jagsby_nether:next_giant')player.sendMessage(nextGiantCommand(message));
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
