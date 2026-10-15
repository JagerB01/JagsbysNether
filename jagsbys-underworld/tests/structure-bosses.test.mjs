import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,intervals} from './mock-server.mjs';
import {BOSS_SITES} from '../behavior_pack/scripts/infernal_lords/boss_sites.js';
import {bossSite,bossPlacementKey,placeStructureBoss,placePlannedStructureBoss} from '../behavior_pack/scripts/infernal_lords/structure_bosses.js';
let serial=0;
function fixture(){
 const calls=[],spawns=[];const dimension={id:'minecraft:nether',getBlock:()=>({typeId:'minecraft:air'}),runCommand:command=>calls.push(command),spawnEntity(typeId,position,options){const entity={id:'boss-'+spawns.length,typeId,position,options,isValid:true,tags:[],addTag(tag){this.tags.push(tag);}};spawns.push(entity);return entity;}};
 world.getDimension=id=>{assert.equal(id,dimension.id);return dimension;};
 return {dimension,calls,spawns,origin:{x:10000+(serial++)*1000,y:30,z:20000}};
}
function finish(job){for(let n=0;n<1000;n++){const step=job.next();if(step.done)return step.value;system.currentTick++;}assert.fail('Boss placement did not finish');}
test('authored centers and modular/full-fortress coordinates resolve to the same physical roof spot',()=>{
 assert.deepEqual(bossSite('mega_fortress',{x:0,y:0,z:0}).position,{x:122.5,y:29,z:125.5});
 assert.deepEqual(bossSite('mega_fortress',{x:122,y:0,z:125},true).position,{x:122.5,y:29,z:125.5});
 assert.deepEqual(bossSite('dragon_arena',{x:0,y:0,z:0}).position,{x:90.5,y:6,z:59.5});
 assert.deepEqual(bossSite('large_arena',{x:0,y:0,z:0}).position,{x:31.5,y:2,z:56.5});
});
test('a completed new structure loads only the boss site and spawns its persistent dormant form once',()=>{
 for(const id of Object.keys(BOSS_SITES)){
  const f=fixture(),result=finish(placeStructureBoss(id,f.origin,f.dimension));
  assert.equal(f.spawns.length,1);assert.equal(f.spawns[0].typeId,BOSS_SITES[id].entityId);assert.deepEqual(f.spawns[0].options,{initialPersistence:true});
  assert.deepEqual(f.spawns[0].position,bossSite(id,f.origin).position);assert.equal(result.state,'placed');
  assert(f.calls[0].startsWith('tickingarea add '));assert(f.calls[1].startsWith('tickingarea remove '));assert.equal(f.calls.length,2);
 }
 assert.equal(intervals.length,0);
});
test('repeated completion after awakening or death never respawns the boss or reloads its chunks',()=>{
 const f=fixture();finish(placeStructureBoss('dragon_arena',f.origin,f.dimension));f.spawns[0].typeId='dungeons:wretched_wraith';f.spawns[0].isValid=false;
 const calls=f.calls.length;const result=finish(placeStructureBoss('dragon_arena',f.origin,f.dimension));assert(result.alreadyPlaced);assert.equal(f.spawns.length,1);assert.equal(f.calls.length,calls);
});
test('a failed native spawn releases its lease and leaves a retryable placement, without placing blocks',()=>{
 const f=fixture(),spawn=f.dimension.spawnEntity;f.dimension.spawnEntity=()=>{throw Error('Native actor unavailable');};
 assert.throws(()=>finish(placeStructureBoss('large_arena',f.origin,f.dimension)),/Native actor unavailable/);
 const key=bossPlacementKey('large_arena',bossSite('large_arena',f.origin).position,f.dimension.id);assert.equal(world.getDynamicProperty(key),undefined);assert(f.calls.at(-1).startsWith('tickingarea remove'));
 f.dimension.spawnEntity=spawn;finish(placeStructureBoss('large_arena',f.origin,f.dimension));assert.equal(f.spawns.length,1);
});
test('legacy partial structures stay unchanged; only newly opted-in records receive a boss',()=>{
 const f=fixture(),legacy={id:'mega_fortress',origin:f.origin,modular:true};finish(placePlannedStructureBoss(legacy,f.dimension));assert.equal(f.spawns.length,0);assert.equal(f.calls.length,0);
 const current={...legacy,infernalLordsVersion:1};finish(placePlannedStructureBoss(current,f.dimension));assert.equal(current.infernalBoss.state,'placed');assert.equal(f.spawns.length,1);assert.deepEqual(f.spawns[0].position,bossSite('mega_fortress',f.origin,true).position);
});
test('small arenas and other templates perform no boss loading, placement or scheduling',()=>{
 const f=fixture();assert.deepEqual(finish(placeStructureBoss('small_arena',f.origin,f.dimension)),{state:'not_applicable'});assert.equal(f.spawns.length,0);assert.equal(f.calls.length,0);assert.equal(intervals.length,0);
});
test('a saved crash-window claim prevents duplicate spawning even if the entity ID was not saved',()=>{
 const f=fixture(),position=bossSite('large_arena',f.origin).position,key=bossPlacementKey('large_arena',position,f.dimension.id);world.setDynamicProperty(key,JSON.stringify({state:'claimed'}));
 assert(finish(placeStructureBoss('large_arena',f.origin,f.dimension)).alreadyPlaced);assert.equal(f.spawns.length,0);assert.equal(f.calls.length,0);
});
