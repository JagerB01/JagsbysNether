import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,intervals,timeouts} from './mock-server.mjs';
import {TRIAL_ENCOUNTERS} from '../behavior_pack/scripts/trial_encounter_catalog.js';
import {encounterSite,recordEncounterSite,recordedEncounterSites,migrateEncounterSite,migrateRecordedEncounters,scheduleEncounterUpdate} from '../behavior_pack/scripts/trial_encounters.js';
const PREFIX='underworld_encounters:site_',VERSION='underworld_encounters:revision';
function finish(job){for(let i=0;i<10000;i++){const r=job.next();system.currentTick++;if(r.done)return r.value;}assert.fail('Migration stalled');}
function clean(){for(const key of world.getDynamicPropertyIds())world.setDynamicProperty(key,undefined);}
function fixture(){
 const blocks=new Map(),placed=[],commands=[];const previous={dimension:world.getDimension,structures:world.structureManager};
 const key=p=>`${p.x},${p.y},${p.z}`;
 const dimension={id:'minecraft:nether',runCommand:command=>commands.push(command),getBlock:p=>({typeId:blocks.get(key(p))??'minecraft:air'})};
 world.getDimension=()=>dimension;world.structureManager={place(id,d,p,options){placed.push({id,p:{...p},options});blocks.set(key(p),'minecraft:trial_spawner');}};
 return {placed,commands,dimension,put:(p,type)=>blocks.set(key(p),type),restore(){world.getDimension=previous.dimension;world.structureManager=previous.structures;clean();}};
}
test('unchanged encounters do one version read on world load and schedule no work or periodic checks',()=>{
 clean();world.setDynamicProperty(VERSION,TRIAL_ENCOUNTERS.revision);
 const get=world.getDynamicProperty,ids=world.getDynamicPropertyIds,start=timeouts.length;let reads=0;
 world.getDynamicProperty=k=>{assert.equal(k,VERSION);reads++;return get(k);};world.getDynamicPropertyIds=()=>assert.fail('No structure enumeration on unchanged revision');
 try{world.afterEvents.worldLoad.emit({});assert.equal(reads,1);assert.equal(timeouts.length,start);assert.equal(intervals.length,0);}
 finally{world.getDynamicProperty=get;world.getDynamicPropertyIds=ids;clean();}
});
test('existing natural structures use their recorded origins and only Mega keep spawners are registered',()=>{
 clean();const key='underworld_landmarks:site_giant_test';
 world.setDynamicProperty(key,JSON.stringify({state:'built',id:'mega_fortress',origin:{x:100,y:30,z:200},modular:true}));
 try{
  const sites=recordedEncounterSites();assert.equal(sites.length,1);assert.equal(sites[0].slots.length,5);
  assert(sites[0].slots.every(s=>s.profile.startsWith('mega_keep/')));
  assert(sites[0].slots.every(s=>s.position.x>=79&&s.position.x<=121&&s.position.z>=179&&s.position.z<=221));
 }finally{clean();}
});
test('native presets update existing spawners once, without restoring mined spawners or replacing player blocks',()=>{
 const f=fixture(),site=encounterSite('small_arena',{x:100,y:30,z:200});site.revision='old';site.slots=site.slots.slice(0,4);
 for(const [i,s] of site.slots.entries())f.put(s.position,['minecraft:mob_spawner','minecraft:trial_spawner','minecraft:air','minecraft:chest'][i]);
 try{
  const result=finish(migrateEncounterSite(site));assert.equal(result.updated,2);assert.equal(f.placed.length,2);
  assert(f.placed.every(p=>p.id.startsWith('jagsby_nether:trial_encounters/')&&p.options.includeEntities===false));
  const saved=JSON.parse(world.getDynamicProperty(PREFIX+site.key));assert.equal(saved.revision,TRIAL_ENCOUNTERS.revision);
  const before=f.commands.length;assert.equal(finish(migrateEncounterSite(saved)).updated,0);assert.equal(f.commands.length,before);
  assert(f.commands.some(c=>c.startsWith('tickingarea remove')));
 }finally{f.restore();}
});
test('fresh manual structures record stable positions without scanning or triggering migration',()=>{
 clean();const d=world.getDimension,start=timeouts.length;world.getDimension=()=>assert.fail('Recording must not load chunks');
 try{
  recordEncounterSite('dragon_arena',{x:100,y:30,z:200},'minecraft:nether');const sites=recordedEncounterSites();
  assert.equal(sites.length,1);assert.equal(sites[0].slots.length,13);assert.equal(sites[0].revision,TRIAL_ENCOUNTERS.revision);
  assert.equal(timeouts.length,start);assert.equal(intervals.length,0);
 }finally{world.getDimension=d;clean();}
});
test('a failed site remains pending for a later world load without starting an idle retry loop',()=>{
 const f=fixture(),site=encounterSite('small_arena',{x:100,y:30,z:200});site.slots=site.slots.slice(0,1);site.revision='old';
 world.setDynamicProperty(PREFIX+site.key,JSON.stringify(site));const original=f.dimension.getBlock,failed=site.slots[0].position,start=timeouts.length;
 f.dimension.getBlock=p=>p.x===failed.x&&p.y===failed.y&&p.z===failed.z?undefined:original(p);
 try{
  const result=finish(migrateRecordedEncounters());assert.equal(result.failures,1);assert.equal(world.getDynamicProperty(VERSION),undefined);
  assert.equal(JSON.parse(world.getDynamicProperty(PREFIX+site.key)).revision,'old');assert.equal(timeouts.length,start);assert.equal(intervals.length,0);
  f.dimension.getBlock=original;f.put(failed,'minecraft:mob_spawner');const retry=finish(migrateRecordedEncounters());assert.equal(retry.failures,0);assert.equal(retry.updated,1);assert.equal(world.getDynamicProperty(VERSION),TRIAL_ENCOUNTERS.revision);
 }finally{f.restore();}
});
