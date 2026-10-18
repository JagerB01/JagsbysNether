import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {world,system} from './mock-server.mjs';
import {runtimeStatus} from '../behavior_pack/scripts/infernal_lords/main.js';
import {landingAt,teleportDestination} from '../behavior_pack/scripts/infernal_lords/teleport.js';
import {bossFixture} from './entity-phase-fixture.mjs';
world.getDifficulty=()=> 'Normal';
test('Nerezhal transformed spawn naturally progresses from ranged through windup and complete bullet hell, then repeats',()=>{
 const f=bossFixture('wretched_wraith');f.entity.triggerEvent('minecraft:entity_transformed');
 assert(f.groups.has('dungeons:ranged_attacking'));assert(f.groups.has('dungeons:able_to_summon'));
 assert(f.components()['minecraft:movement'].value===.30);assert(!JSON.stringify(f.components()['minecraft:behavior.avoid_mob_type']).includes('can_melee_attack'));
 f.advance(22*20);assert(f.groups.has('dungeons:bullethell_windup'));assert(f.moves.length>0);assert.equal(f.props.get('dungeons:bullethell'),true);
 f.advance(25);assert(f.groups.has('dungeons:bullethell_attacking'));f.advance(40);assert(f.shots.length>=19);
 f.advance(13*20);assert(f.groups.has('dungeons:ranged_attacking'));assert.equal(f.props.get('dungeons:bullethell'),false);assert.equal(f.components()['minecraft:movement'].value,.30);
 f.advance(22*20);assert(f.events.filter(id=>id==='dungeons:begin_bullethell_center').length>=2);assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);f.entity.isValid=false;
});
test('native Nerezhal and Malzareth projectile impacts damage a fire-resistant player without scripted after-hit damage',()=>{
 for(const [name,path,base] of [['wretched_wraith','wretched_wraith/projectile',96],['nameless_one','nameless_one/nameless_one_projectile',96]]){
  const f=bossFixture(name);const spec=JSON.parse(readFileSync(new URL(`../behavior_pack/entities/new/boss/${path}.json`,import.meta.url)))['minecraft:entity'].components['minecraft:projectile'];assert.equal(spec.on_hit.impact_damage.damage,base);assert('remove_on_hit' in spec.on_hit);
  const p=f.dimension.spawnEntity(`dungeons:${name}_projectile`,{x:0,y:66,z:0});p.getComponent('projectile').owner=f.entity;
  f.nativeHit(p,spec.on_hit.impact_damage.damage);assert.equal(f.player.hits[0].amount,64);assert.equal(f.player.hits[0].cause,'projectile');
  if(name==='wretched_wraith'){p.addTag('dungeons:chud_projectile');assert(Math.abs(f.nativeHit(p,base).damage-160*2/3)<1e-9);}
  f.entity.isValid=false;
 }
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
test('Baelgor native slam timer inflicts its shockwave, summons blazes, recovers, cools down and returns to ready',()=>{
 const f=bossFixture('boss_wildfire');f.entity.triggerEvent('minecraft:entity_spawned');f.entity.triggerEvent('dungeons:begin_shockwave');f.advance(11);
 assert(f.events.includes('dungeons:shockwave_damage'));assert(f.player.hits.length>0);assert(f.spawned.some(e=>e.typeId==='dungeons:enchanted_blaze'));assert(f.groups.has('dungeons:shockwave_recovery'));
 f.advance(10);assert(f.groups.has('dungeons:shockwave_cooldown'));f.advance(15*20);assert(f.groups.has('dungeons:shockwave_ready'));assert(!f.groups.has('dungeons:shockwave_action'));
 const shields=f.props.get('dungeons:shields');f.entity.triggerEvent('dungeons:destroy_shield');f.advance(1);assert.equal(f.props.get('dungeons:shields'),shields-1);assert(f.groups.has('dungeons:shockwave_action'));assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);f.entity.isValid=false;
});
test('Malzareth casting cooldown is a native timer, clears, and vanguard sensors do not depend on AI flags',()=>{
 const f=bossFixture('nameless_one');f.entity.triggerEvent('minecraft:entity_transformed');f.entity.triggerEvent('dungeons:begin_casting');assert.equal(f.props.get('dungeons:casting'),true);
 f.entity.triggerEvent('dungeons:complete_casting');assert.equal(f.props.get('dungeons:casting'),false);assert(f.groups.has('dungeons:summon_cooldown'));f.advance(200);assert(!f.groups.has('dungeons:summon_cooldown'));
 assert(f.components()['minecraft:entity_sensor'].subsensors.some(s=>s.event==='dungeons:detect_vanguards'));assert(!f.components()['minecraft:behavior.timer_flag_1']);assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);f.entity.isValid=false;
});
test('teleports work on glass and partial structural floors and can escape a pillar-lined room',()=>{
 const d={getBlock:({y})=>({typeId:y===63?'minecraft:polished_blackstone_brick_slab':'minecraft:air',isSolid:false,isAir:y!==63,isLiquid:false})};
 assert(landingAt(d,2,2,64));const f=bossFixture('wretched_wraith'),read=f.dimension.getBlock;
 f.dimension.getBlock=p=>p.y===65&&Math.abs(p.x)<2?{typeId:'minecraft:polished_blackstone_bricks',isAir:false,isSolid:true}:read(p);
 assert(teleportDestination(f.entity));f.entity.isValid=false;
});
test('loaded bosses reset transient combat phases without changing health or shield progress',()=>{
 for(const name of ['wretched_wraith','boss_wildfire','nameless_one']){
  const f=bossFixture(name);f.entity.triggerEvent('minecraft:entity_spawned');f.health.currentValue=123;
  if(name==='wretched_wraith')f.entity.triggerEvent('dungeons:begin_bullethell_center');
  if(name==='boss_wildfire'){f.props.set('dungeons:shields',2);f.entity.triggerEvent('dungeons:begin_shockwave');}
  if(name==='nameless_one')f.props.set('dungeons:casting',true);
  world.afterEvents.entityLoad.emit({entity:f.entity});assert.equal(f.health.currentValue,123);
  if(name==='wretched_wraith')assert.equal(f.props.get('dungeons:bullethell'),false);
  if(name==='boss_wildfire'){assert.equal(f.props.get('dungeons:shields'),2);assert(f.groups.has('dungeons:shockwave_ready'));}
  if(name==='nameless_one')assert.equal(f.props.get('dungeons:casting'),false);
  f.entity.isValid=false;world.afterEvents.entityRemove.emit({removedEntityId:f.entity.id});
 }
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});

test('Malzareth changes actual summon groups when living vanguards appear and disappear',()=>{
 const f=bossFixture('nameless_one');f.entity.triggerEvent('minecraft:entity_transformed');assert(f.groups.has('dungeons:vanguard_mode'));
 f.dimension.getEntities=()=>[{typeId:'dungeons:vanguard'}];f.entity.triggerEvent('dungeons:detect_vanguards');f.advance(1);assert(f.groups.has('dungeons:illusion_mode'));assert(!f.groups.has('dungeons:vanguard_mode'));
 const summons=f.components()['minecraft:behavior.summon_entity'].summon_choices;assert(summons.some(c=>c.sequence.some(s=>s.entity_type.includes('illusion'))));
 f.dimension.getEntities=()=>[];f.entity.triggerEvent('dungeons:detect_vanguards');f.advance(1);assert(f.groups.has('dungeons:vanguard_mode'));assert(!f.groups.has('dungeons:illusion_mode'));f.entity.isValid=false;
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
test('Baelgor shields wear through actual damage-sensor responses, all four break, then health becomes vulnerable',()=>{
 const f=bossFixture('boss_wildfire');f.entity.triggerEvent('minecraft:entity_spawned');const hp=f.health.currentValue;
 for(let shield=4;shield>0;shield--){
  for(let hit=0;hit<11;hit++)f.receiveHit(10);
  assert.equal(f.props.get('dungeons:shields'),shield-1);assert.equal(f.health.currentValue,hp);f.advance(21);
 }
 assert(f.groups.has('dungeons:no_shield'));f.receiveHit(10);assert.equal(f.health.currentValue,hp-10);f.receiveHit(10,'lava');assert.equal(f.health.currentValue,hp-10);f.entity.isValid=false;
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
test('Nerezhal ranged phase retains hurt-triggered teleport instead of overriding away its base damage sensor',()=>{
 const f=bossFixture('wretched_wraith');f.entity.triggerEvent('minecraft:entity_spawned');f.receiveHit(1);f.advance(1);assert(f.events.includes('dungeons:wretched_wraith_hurt'));assert(f.moves.length>0);assert.equal(f.health.currentValue,499);f.entity.isValid=false;
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});

test('on-demand lords status includes actual phase events, successful teleports and delivered projectile damage',()=>{
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:lords_trace',message:'on',sourceEntity:{typeId:'minecraft:player',sendMessage(){}}});
 const f=bossFixture('wretched_wraith');world.afterEvents.entityLoad.emit({entity:f.entity});f.entity.triggerEvent('dungeons:wretched_wraith_teleport');f.advance(1);
 world.afterEvents.entityHurt.emit({hurtEntity:f.player,damage:10,damageSource:{cause:'projectile',damagingEntity:f.entity}});
 const snapshot=runtimeStatus().bosses.find(b=>b.id===f.entity.id);assert(snapshot);assert.equal(snapshot.phase,'ranged');assert.equal(snapshot.events.teleport_success,1);assert.equal(snapshot.events.projectile_damage,10);
 f.entity.isValid=false;world.afterEvents.entityRemove.emit({removedEntityId:f.entity.id});assert(!runtimeStatus().bosses.some(b=>b.id===f.entity.id));
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:lords_trace',message:'off',sourceEntity:{typeId:'minecraft:player',sendMessage(){}}});
});

test('world-load recovery reaches previously loaded bosses through the facade and preserved roster',()=>{
 const f=bossFixture('wretched_wraith'),old=world.getDimension;
 const native={...f.dimension,getEntities:q=>q?.type===f.entity.typeId?[f.entity]:[]};world.getDimension=()=>native;
 try{
  f.entity.triggerEvent('minecraft:entity_spawned');f.entity.triggerEvent('dungeons:begin_bullethell_center');assert.equal(f.props.get('dungeons:bullethell'),true);
  world.afterEvents.worldLoad.emit({});assert.equal(f.props.get('dungeons:bullethell'),false);assert(f.groups.has('dungeons:ranged_attacking'));
 }finally{world.getDimension=old;f.entity.isValid=false;world.afterEvents.entityRemove.emit({removedEntityId:f.entity.id});}
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
