// Executes BP event responses through the real runtime bridge. Native AI, aim,
// pathfinding and rendering still require Bedrock acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,flush} from './mock-server.mjs';
import {actorFixture} from './entity-phase-fixture.mjs';
import {runtimeStatus} from '../behavior_pack/scripts/infernal_lords/main.js';
const healthy=()=>assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
test('Necromancer summon event actually creates a tagged zombie through the BP command bridge',()=>{
 const f=actorFixture('necromancer_spawnpoint');f.dimension.getBiome=()=>({id:'minecraft:nether_wastes'});
 f.entity.triggerEvent('dungeons:zombie');assert.equal(f.spawned.length,0);f.advance(1);
 assert.equal(f.spawned.length,1);assert.equal(f.spawned[0].typeId,'minecraft:zombie');assert(f.spawned[0].hasTag('dungeons:necromancer_minion'));assert.equal(f.entity.isValid,false);healthy();
});
test('Necromancer summon survives unavailable biome data and respects the original local minion cap',()=>{
 const missing=actorFixture('necromancer_spawnpoint');missing.dimension.getBiome=()=>{throw Error('Biome not loaded');};missing.entity.triggerEvent('dungeons:zombie');missing.advance(1);
 assert.equal(missing.spawned[0].typeId,'minecraft:zombie');
 const capped=actorFixture('necromancer_spawnpoint');capped.dimension.getEntities=()=>Array.from({length:11},()=>({}));capped.entity.triggerEvent('dungeons:zombie');capped.advance(1);
 assert.equal(capped.spawned.length,0);assert.equal(capped.entity.isValid,false);healthy();
});
test('Tower fire does not mistake itself for a duplicate; spread keeps the same cast and local floor',()=>{
 const f=actorFixture('wraith_fire'),getBlock=f.dimension.getBlock.bind(f.dimension);
 f.dimension.getBlock=p=>{const b=getBlock(p);return Math.floor(p.y)===67?{...b,typeId:'minecraft:polished_blackstone_bricks',isAir:false,isSolid:true}:b;};
 f.dimension.getEntities=q=>q.families?.includes('dungeons_fire')?[f.entity]:[];
 f.entity.triggerEvent('dungeons:spawn_tower_wraith_fire');f.advance(4);
 assert(f.entity.isValid);assert.equal(f.entity.location.y,64);assert.equal(f.spawned.length,20);
 for(const patch of f.spawned){assert.equal(patch.location.y,64);assert.equal(patch.getDynamicProperty('jagsby_nether:fire_cast'),f.entity.id);assert.equal(patch.getDynamicProperty('dungeons:fire_type'),'tower_wraith');}
 healthy();
});
test('unloaded neighboring fire patches are skipped without aborting the rest of the spread',()=>{
 const f=actorFixture('wraith_fire'),getBlock=f.dimension.getBlock.bind(f.dimension);
 f.dimension.getBlock=p=>p.x>1?undefined:getBlock(p);
 f.entity.triggerEvent('dungeons:spawn_tower_wraith_fire');f.advance(4);
 assert(f.spawned.length>0&&f.spawned.length<20);healthy();
});
test('collisionless fire uses nearby-entity pulses, stays alive off-ground and shares opening damage across a cast',()=>{
 world.getDifficulty=()=> 'Hard';const f=actorFixture('wraith_fire');f.player.getEffect=()=>undefined;f.player.applyDamage=(amount,{cause})=>{f.player.hits.push({amount,cause});return true;};
 f.entity.setDynamicProperty('dungeons:fire_type','tower_wraith');f.entity.setDynamicProperty('jagsby_nether:fire_cast','native-pulse-cast');
 const c=f.definition.components;assert(!c['minecraft:behavior.timer_flag_1']);
 assert(!JSON.stringify(c['minecraft:environment_sensor']).includes('on_ground'));
 const pulse=c['minecraft:entity_sensor'].subsensors[0];assert.equal(pulse.cooldown,.5);
 f.entity.triggerEvent(pulse.event);f.advance(1);assert.deepEqual(f.player.hits.map(h=>h.amount),[14]);
 // A redundant native notification must not cause a second delivery.
 world.afterEvents.dataDrivenEntityTrigger.emit({entity:f.entity,eventId:pulse.event});flush();assert.equal(f.player.hits.length,1);
 f.entity.triggerEvent(pulse.event);f.advance(10);assert.deepEqual(f.player.hits.map(h=>h.amount),[14,2]);healthy();
});
test('Tower poison spawn has actual delivery, full opening and reduced lingering damage; creative players are ignored',()=>{
 world.getDifficulty=()=> 'Hard';const f=actorFixture('tower_wraith_poison');f.entity.triggerEvent('minecraft:entity_spawned');f.advance(1);
 assert.deepEqual(f.player.hits.map(h=>h.amount),[14]);f.advance(10);assert.deepEqual(f.player.hits.map(h=>h.amount),[14,2]);
 const creative=actorFixture('tower_wraith_poison');creative.player.getGameMode=()=> 'Creative';creative.entity.triggerEvent('minecraft:entity_spawned');creative.advance(1);assert.equal(creative.player.hits.length,0);healthy();
});
test('regular and enchanted support Wraiths teleport using local floors without querying above the Nether roof',()=>{
 for(const name of ['wraith','enchanted_wraith']){
  const f=actorFixture(name),getBlock=f.dimension.getBlock.bind(f.dimension);
  f.dimension.getBlock=p=>{assert(p.y>=0&&p.y<128);return getBlock(p);};
  f.dimension.getTopmostBlock=()=>assert.fail('Nether roof scan must not be used');
  f.entity.triggerEvent('dungeons:begin_teleport');f.advance(20);
  assert.equal(f.moves.length,1);assert.equal(f.moves[0].y,64);healthy();
 }
});
test('both caster variants retain usable targeting, locomotion and wired native attacks; trial enchanted chances remain',()=>{
 for(const name of ['necromancer','enchanted_necromancer','tower_wraith','enchanted_tower_wraith']){
  const f=actorFixture(name),c=f.definition.components;
  assert(c['minecraft:behavior.nearest_attackable_target']);assert(c['minecraft:navigation.walk']);assert(c['minecraft:jump.static']);
  if(name.includes('necromancer')){
   assert.equal(c['minecraft:shooter'].def,'dungeons:necromancer_shot');assert.equal(c['minecraft:behavior.ranged_attack'].attack_radius,15);
   assert.equal(c['minecraft:behavior.summon_entity'].summon_choices[0].sequence[0].entity_type,'dungeons:necromancer_spawnpoint<dungeons:zombie>');
  }else{
   const groups=f.definition.component_groups;
   assert.equal(groups['dungeons:black_hood']['minecraft:behavior.summon_entity'].summon_choices[0].sequence[0].entity_type,'dungeons:wraith_fire<dungeons:spawn_tower_wraith_fire>');
   assert.equal(groups['dungeons:pink_hood']['minecraft:behavior.summon_entity'].summon_choices[0].sequence[0].entity_type,'dungeons:tower_wraith_poison');
   f.entity.triggerEvent('minecraft:entity_spawned');assert(f.groups.has('dungeons:black_hood'));f.entity.triggerEvent('dungeons:convert_to_pink');assert(f.groups.has('dungeons:becoming_pink'));
   f.entity.triggerEvent('dungeons:convert_to_pink_success');assert(f.groups.has('dungeons:pink_hood'));
  }
 }
 const n=actorFixture('necromancer').definition.events['minecraft:entity_spawned'].randomize;assert.deepEqual(n.map(e=>e.weight),[1,9]);healthy();
});
