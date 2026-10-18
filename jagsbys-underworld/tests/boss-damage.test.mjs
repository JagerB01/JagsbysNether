import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {world,system,intervals,flush} from './mock-server.mjs';
import '../behavior_pack/scripts/infernal_lords/main.js';
import {BOSS_DAMAGE,bossDamage,shockwaveDamage} from '../behavior_pack/scripts/infernal_lords/boss_damage.js';
import {BOSS_EVENT_ROUTES} from '../behavior_pack/scripts/infernal_lords/boss_event_routes.js';
import {bossFixture} from './entity-phase-fixture.mjs';
// Expected Bedrock mitigation model, not a substitute for measuring in-engine.
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const expected=(raw,{armour=20,protection=16,resistance=0,fire=false,fireResistance=false}={})=>
 fire&&fireResistance?0:raw*(fire?1:1-Math.min(20,armour)*.04)*(1-Math.min(20,protection)*.04)*Math.max(0,1-resistance*.2);
test('Hard raw values target specified heart losses with Bedrock armour and Protection together',()=>{
 for(const [kind,min,max] of [['standard',3,4],['powerful',5,6],['shockwave',6,8]]){
  const hearts=expected(bossDamage(kind,'Hard'))/2;assert(hearts>=min&&hearts<=max);
 }
 close(expected(96),6.912);close(expected(160),11.52);close(expected(208),14.976);
});
test('armour, Protection and Resistance remain useful; unenchanted and unarmoured hits are devastating',()=>{
 close(expected(96,{protection:0}),19.2);close(expected(96,{armour:0,protection:0}),96);
 close(expected(96,{resistance:1}),5.5296);close(expected(96,{resistance:2}),4.1472);
 assert(expected(208,{protection:0})>20);
});
test('Fire Resistance stops burning and floor fire but does not erase physical fireball impacts',()=>{
 close(expected(96,{fireResistance:true}),6.912);close(expected(32,{fire:true}),11.52);close(expected(32,{fire:true,fireResistance:true}),0);
});
test('difficulty scaling and the original rounded distance curve are retained without attack-rate changes',()=>{
 close(bossDamage('standard','Easy'),48);close(bossDamage('standard','Normal'),64);close(bossDamage('standard','Hard'),96);
 for(const d of [0,1,2,3,4])close(shockwaveDamage(d),BOSS_DAMAGE.shockwave*(20-Math.round(d*3))/20);
 assert(shockwaveDamage(0)>shockwaveDamage(4));
});
test('several accepted projectile hits can be lethal; native hurt immunity is not bypassed',()=>{
 assert(expected(96)*3>20);assert(expected(160)*2>20);
 const src=readFileSync(new URL('../behavior_pack/scripts/infernal_lords/boss_damage.js',import.meta.url),'utf8');assert(!/setCurrentValue|EntityDamageCause.override|damage\s*:\s*10000/.test(src));
});
test('empty teleport events execute through queued commands without fictitious native component notifications or duplicate delivery',()=>{
 const f=bossFixture('nameless_one');let native=0;
 world.afterEvents.dataDrivenEntityTrigger.subscribe(e=>{if(e.entity.id===f.entity.id&&e.eventId==='dungeons:nameless_one_teleport')native++;});
 f.entity.triggerEvent('dungeons:nameless_one_teleport');assert.equal(native,0);assert.equal(f.moves.length,0);f.advance(1);assert.equal(f.moves.length,1);
 world.afterEvents.dataDrivenEntityTrigger.emit({entity:f.entity,eventId:'dungeons:nameless_one_teleport'});flush();assert.equal(f.moves.length,1,'Native duplicate must be ignored for a routed event');
 f.entity.isValid=false;
});
test('property-only shield break reaches shockwave and Blaze summoning through the command bridge',()=>{
 const f=bossFixture('boss_wildfire');world.getDifficulty=()=> 'Hard';f.entity.triggerEvent('minecraft:entity_spawned');f.entity.triggerEvent('dungeons:destroy_shield');f.advance(12);
 assert(f.events.includes('dungeons:shockwave_damage'));assert.equal(f.spawned.filter(e=>e.typeId==='dungeons:enchanted_blaze').length,2);assert(f.player.hits.length);f.entity.isValid=false;
});
test('Malzareth spread works when native Event-cause projectile ownership is assigned after entitySpawn',()=>{
 const f=bossFixture('nameless_one');f.dimension.spawnCause='Event';const projectile=f.dimension.spawnEntity('dungeons:nameless_one_projectile',{x:0,y:66,z:1});projectile.getComponent('projectile').owner=f.entity;flush();
 assert.equal(f.spawned.filter(p=>p.typeId==='dungeons:nameless_one_projectile').length,3);assert.equal(f.shots.length,2);f.entity.isValid=false;
});
test('Nerezhal bullets clear the floor even when native head height is only 1.62 blocks',()=>{
 const f=bossFixture('wretched_wraith');f.entity.triggerEvent('dungeons:bullethell_start');f.advance(2);
 const bolts=f.spawned.filter(p=>p.typeId==='dungeons:wretched_wraith_projectile');assert.equal(bolts.length,9);
 for(const p of bolts)assert(p.location.y-.225>f.entity.location.y);
 f.advance(18);assert.equal(f.spawned.filter(p=>p.typeId==='dungeons:wretched_wraith_projectile').length,19);f.entity.isValid=false;
});
test('routed boss events are declared queued commands and cannot be forged by a player source',()=>{
 const f=bossFixture('wretched_wraith'),before=f.moves.length;
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:boss_event',sourceEntity:f.player,message:'dungeons:wretched_wraith_teleport'});assert.equal(f.moves.length,before);
 for(const [id,events] of Object.entries(BOSS_EVENT_ROUTES))assert(events.length>0&&id.startsWith('dungeons:'));
 f.entity.isValid=false;
});
test('floor hazards retain half-second hits and twenty-second lifetime without despawning on a false ground flag',()=>{
 const e=JSON.parse(readFileSync(new URL('../behavior_pack/entities/new/boss/wretched_wraith/wretched_wraith_fire.json',import.meta.url)))['minecraft:entity'];
 assert.equal(e.components['minecraft:timer'].time,20);assert.equal(e.components['minecraft:entity_sensor'].subsensors[0].cooldown,.5);assert(!JSON.stringify(e.components['minecraft:environment_sensor']).includes('on_ground'));
 assert(e.events['dungeons:wraith_fire_hit'].queue_command.command.includes('scriptevent jagsby_nether:boss_event dungeons:wraith_fire_hit'));
});
test('opt-in damage measurements read actual health deltas and install no polling interval',()=>{
 const messages=[],hp={currentValue:20};const p={id:'damage-measure-player',typeId:'minecraft:player',isValid:true,getComponent:id=>id.includes("health")?hp:undefined,sendMessage:s=>messages.push(s)},source={typeId:'dungeons:boss_wildfire'},start=intervals.length;
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:boss_damage_watch',message:'on',sourceEntity:p});
 const damageSource={cause:'projectile',damagingEntity:source};world.beforeEvents.entityHurt.emit({hurtEntity:p,damage:96,damageSource});hp.currentValue=13.088;world.afterEvents.entityHurt.emit({hurtEntity:p,damage:6.912,damageSource});
 assert(messages.some(s=>s.includes('6.91 HP lost (3.46 hearts)')));assert.equal(intervals.length,start);
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:boss_damage_watch',message:'off',sourceEntity:p});
});

test('another Baelgor’s Blazes cannot suppress this boss’s original two-minion summon',()=>{
 const f=bossFixture('boss_wildfire'),foreign={getDynamicProperty:()=> 'another-boss'};
 f.dimension.getEntities=q=>q.tags?[foreign]:[f.player];f.entity.triggerEvent('dungeons:shockwave_damage');f.advance(1);
 const blazes=f.spawned.filter(e=>e.typeId==='dungeons:enchanted_blaze');assert.equal(blazes.length,2);assert(blazes.every(e=>e.getDynamicProperty('jagsby_nether:boss_owner')===f.entity.id));f.entity.isValid=false;
});
test('Nerezhal retains invulnerability during the special and becomes damageable after recovery',()=>{
 const f=bossFixture('wretched_wraith');f.entity.triggerEvent('dungeons:bullethell_start');f.advance(1);f.receiveHit(100,'projectile');assert.equal(f.health.currentValue,500);
 f.entity.triggerEvent('dungeons:bullethell_end');f.advance(1);f.receiveHit(100,'projectile');assert.equal(f.health.currentValue,400);f.entity.isValid=false;
});
