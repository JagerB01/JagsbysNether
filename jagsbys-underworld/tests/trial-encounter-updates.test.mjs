import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,intervals,timeouts} from './mock-server.mjs';
import {TRIAL_ENCOUNTERS} from '../behavior_pack/scripts/trial_encounter_catalog.js';
import {encounterSite,recordEncounterSite,recordedEncounterSites,migrateEncounterSite,migrateRecordedEncounters,scheduleEncounterUpdate,chooseEncounterProfile} from '../behavior_pack/scripts/trial_encounters.js';
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
test('existing natural structures use their recorded origins and Mega keep and lower-chamber spawners are registered',()=>{
 clean();const key='underworld_landmarks:site_giant_test';
 world.setDynamicProperty(key,JSON.stringify({state:'built',id:'mega_fortress',origin:{x:100,y:30,z:200},modular:true}));
 try{
  const sites=recordedEncounterSites();assert.equal(sites.length,1);assert.equal(sites[0].slots.length,9);
  assert(sites[0].slots.every(s=>s.profile.startsWith('mega_keep/')));
  assert(sites[0].slots.some(s=>Math.abs(s.position.x-100)>21||Math.abs(s.position.z-200)>21),'Lower chamber positions must be included');
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
test('fresh structures record stable positions and queue finite weighted configuration without scans',()=>{
 clean();const d=world.getDimension,start=timeouts.length;world.getDimension=()=>assert.fail('Recording must not load chunks');
 try{
  recordEncounterSite('dragon_arena',{x:100,y:30,z:200},'minecraft:nether');const sites=recordedEncounterSites();
  assert.equal(sites.length,1);assert.equal(sites[0].slots.length,13);assert.equal(sites[0].layoutRevision,TRIAL_ENCOUNTERS.revision);assert.equal(sites[0].revision,undefined);assert.equal(world.getDynamicProperty(VERSION),undefined);
  assert.equal(timeouts.length,start+1);assert.equal(intervals.length,0);
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

test('legacy mob roles receive the shared weighted presets without moving existing spawners',()=>{
 const f=fixture(),site=encounterSite('small_arena',{x:100,y:30,z:200});site.revision='old';
 const expected=site.slots.map(s=>({position:{...s.position},presetPrefix:"jagsby_nether:trial_encounters/small_arena_selected_"}));
 site.slots=site.slots.map(s=>({...s,profile:'small_arena/wither_skeleton'}));delete site.layout;
 for(const s of site.slots)f.put(s.position,'minecraft:trial_spawner');
 try{
  finish(migrateEncounterSite(site));assert.equal(f.placed.length,site.slots.length);
  for(const wanted of expected){const placed=f.placed.find(p=>p.p.x===wanted.position.x&&p.p.y===wanted.position.y&&p.p.z===wanted.position.z);assert(placed);assert(placed.id.startsWith(wanted.presetPrefix));}
  assert(f.placed.every(p=>p.id.startsWith('jagsby_nether:trial_encounters/small_arena_')),'All legacy roles retain updateable weighted presets');
 }finally{f.restore();}
});

test('revision migration adds lower-chamber positions to an older five-spawner keep record',()=>{
 const f=fixture(),site=encounterSite('mega_fortress',{x:100,y:30,z:200},'minecraft:nether','old_keep',true);
 const old=site.slots.filter(s=>Math.abs(s.position.x-100)<=21&&Math.abs(s.position.z-200)<=21);assert.equal(old.length,5);
 site.slots=old;site.revision='old';
 for(const slot of encounterSite('mega_fortress',site.origin,'minecraft:nether','old_keep',true).slots)f.put(slot.position,'minecraft:mob_spawner');
 try{assert.equal(finish(migrateEncounterSite(site)).updated,9);assert.equal(JSON.parse(world.getDynamicProperty(PREFIX+site.key)).slots.length,9);assert.equal(f.placed.length,9);}
 finally{f.restore();}
});

test('relocated templates still update legacy spawners at their old recorded positions without creating new ones',()=>{
 const f=fixture(),site=encounterSite('small_arena',{x:100,y:30,z:200});site.revision='before_relocation';
 site.slots=TRIAL_ENCOUNTERS.legacySites.small_arena.map(s=>({position:{x:100+s.offset[0],y:30+s.offset[1],z:200+s.offset[2]},profile:'small_arena/brute'}));
 const old=site.slots.map(s=>({...s.position}));for(const p of old)f.put(p,'minecraft:trial_spawner');
 try{
  assert.equal(finish(migrateEncounterSite(site)).updated,8);assert.equal(f.placed.length,8);
  for(const p of old)assert(f.placed.some(s=>s.p.x===p.x&&s.p.y===p.y&&s.p.z===p.z));
  assert(f.placed.every(s=>!TRIAL_ENCOUNTERS.sites.small_arena.some(n=>s.p.x===100+n.offset[0]&&s.p.y===30+n.offset[1]&&s.p.z===200+n.offset[2])));
 }finally{f.restore();}
});

test('explicit repair presets follow the requested weights including enchanted Wraith share',()=>{
 for(const group of ['small_arena','large_arena','dragon_arena','mega_keep']){
  for(const [roll,index] of [[0,0],[.22499,0],[.225,1],[.24999,1],[.25,2],[.49999,2],[.5,3],[.99999,3]]){
   assert.equal(chooseEncounterProfile(group,roll),group+'/selected_'+index);
  }
 }
});
test('an interrupted repair persists selected mobs and reuses them instead of rerolling on retry',()=>{
 const f=fixture(),site=encounterSite('dragon_arena',{x:100,y:30,z:200});site.slots=site.slots.slice(0,1);site.revision='empty_weighted_data';
 const original=f.dimension.getBlock,random=Math.random;f.dimension.getBlock=()=>undefined;Math.random=()=>.23;
 try{
  assert.throws(()=>finish(migrateEncounterSite(site)),/Chunk loading timed out/);
  const saved=JSON.parse(world.getDynamicProperty(PREFIX+site.key));assert.equal(saved.slots[0].selectedProfile,'dragon_arena/selected_1');
  f.dimension.getBlock=original;f.put(saved.slots[0].position,'minecraft:trial_spawner');Math.random=()=>.99;
  assert.equal(finish(migrateEncounterSite(saved)).updated,1);assert(f.placed[0].id.endsWith('dragon_arena_selected_1'));
 }finally{Math.random=random;f.restore();}
});

test('a fresh Dragon Arena configures its thirteen real spawners using explicit presets without adding legacy positions',()=>{
 const f=fixture(),site=encounterSite('dragon_arena',{x:100,y:30,z:200}),random=Math.random;site.layoutRevision=TRIAL_ENCOUNTERS.revision;
 for(const slot of site.slots)f.put(slot.position,'minecraft:trial_spawner');Math.random=()=>.23;
 try{
  assert.equal(finish(migrateEncounterSite(site)).updated,13);assert.equal(f.placed.length,13);assert(f.placed.every(p=>p.id.endsWith('dragon_arena_selected_1')));
  const saved=JSON.parse(world.getDynamicProperty(PREFIX+site.key));assert.equal(saved.slots.length,13);assert.equal(saved.revision,TRIAL_ENCOUNTERS.revision);
 }finally{Math.random=random;f.restore();}
});
