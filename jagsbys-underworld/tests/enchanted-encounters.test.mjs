import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {world,flush} from './mock-server.mjs';
import {actorFixture} from './entity-phase-fixture.mjs';
import {runtimeStatus} from '../behavior_pack/scripts/infernal_lords/main.js';
const healthy=()=>assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
test('each trial caster spawn rolls 33/67 and targets a fully declared enchanted variant',()=>{
 for(const name of ['tower_wraith','necromancer'])for(const roll of [0,.329999,.33,.999999]){
  const f=actorFixture('trial_'+name,{roll:()=>roll});f.entity.triggerEvent('minecraft:entity_spawned');
  assert.equal(f.groups.has('jagsby_nether:trial_enchanted'),roll<.33);
  if(roll<.33){
   assert.equal(f.components()['minecraft:transformation'].into,`dungeons:enchanted_${name}<minecraft:entity_spawned>`);
   const variant=actorFixture('enchanted_'+name);assert(variant.components()['minecraft:type_family'].family.includes('enchanted'));
   assert.equal(variant.health.defaultValue,name==='tower_wraith'?72:100);
  }else if(name==='tower_wraith')assert(f.groups.has('dungeons:black_hood'));
  else assert(!f.groups.has('dungeons:transform_to_enchanted'),'Normal trial roll must not get another 10% roll');
 }
 healthy();
});
test('trial definitions have ordinary client appearances and loot before conversion; family mix stays 25/25/50',()=>{
 const config=JSON.parse(readFileSync(new URL('../TRIAL_ENCOUNTERS.json',import.meta.url)));
 assert.deepEqual(config.spawn_pool,[{entity:'dungeons:trial_tower_wraith',weight:10},{entity:'dungeons:trial_necromancer',weight:10},{entity:'minecraft:piglin_brute',weight:20}]);
 for(const name of ['tower_wraith','necromancer']){
  const trial=actorFixture('trial_'+name),base=actorFixture(name);
  assert.deepEqual(trial.definition.components,base.definition.components);
  const client=JSON.parse(readFileSync(new URL(`../resource_pack/entity/underworld/trial_${name}.json`,import.meta.url)))['minecraft:client_entity'].description;
  assert.equal(client.identifier,'dungeons:trial_'+name);assert(!client.spawn_egg);
 }
 const ordinary=actorFixture('necromancer').definition.events['minecraft:entity_spawned'].randomize;assert.deepEqual(ordinary.map(r=>r.weight),[1,9]);
});
test('Nerezhal keeps the same two-zombie spell and cap but always selects the enchanted Frozen Zombie',()=>{
 const f=actorFixture('wretched_wraith'),choices=f.definition.component_groups['dungeons:able_to_summon']['minecraft:behavior.summon_entity'].summon_choices;
 const spell=choices.flatMap(c=>c.sequence).find(s=>s.entity_type.includes('frozen_zombie'));
 assert.equal(spell.entity_type,'dungeons:enchanted_frozen_zombie<dungeons:spawn_wretched_wraith_minion>');assert.equal(spell.num_entities_spawned,2);assert.equal(spell.summon_cap,4);
 const minion=actorFixture('enchanted_frozen_zombie');assert.equal(minion.health.defaultValue,40);assert(minion.definition.events['dungeons:spawn_wretched_wraith_minion'].add.component_groups.every(g=>g in minion.definition.component_groups));minion.entity.triggerEvent('dungeons:spawn_wretched_wraith_minion');minion.advance(1);assert(minion.groups.has('dungeons:wretched_wraith_minion'));
 minion.entity.triggerEvent('dungeons:despawn_wretched_wraith_minion');minion.advance(1);assert.equal(minion.entity.isValid,false);healthy();
});
test('enchanted Blaze has real enchanted stats, native fire immunity, working default attack mode and perk initialization',()=>{
 const f=actorFixture('enchanted_blaze');assert.equal(f.health.defaultValue,40);assert.equal(f.components()['minecraft:scale'].value,1.1);assert.equal(f.components()['minecraft:knockback_resistance'].value,.2);assert(f.components()['minecraft:fire_immune']);
 f.entity.triggerEvent('minecraft:entity_spawned');assert(f.groups.has('ranged_mode'));assert.equal(f.components()['minecraft:shooter'].def,'minecraft:small_fireball');
 world.getDifficulty=()=> 'Hard';world.afterEvents.entitySpawn.emit({entity:f.entity,cause:'Event'});flush();
 assert(f.entity.hasTag('dungeons:enchanted'));assert(f.entity.getDynamicProperty('dungeons:enchant_count')>=1);assert(f.entity.getTags().some(t=>t.startsWith('dungeons:enchanted_mob_')));healthy();
});
