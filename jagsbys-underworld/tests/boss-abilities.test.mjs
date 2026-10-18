import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {world,system,timeouts,jobs,flush,EntityDamageCause} from './mock-server.mjs';
import {runtimeStatus} from '../behavior_pack/scripts/infernal_lords/main.js';
import {teleportDestination} from '../behavior_pack/scripts/infernal_lords/teleport.js';
let serial=0;
function fixture(type='dungeons:nameless_one'){
 const tags=new Set(),props=new Map(),moves=[],sounds=[],particles=[],spawned=[],events=[],damage=[];
 const dim={id:'minecraft:nether',isChunkLoaded:()=>true,getEntities:()=>[],getPlayers:()=>[],playSound:(...a)=>sounds.push(a),spawnParticle:(...a)=>particles.push(a),
  getBlock:({x,y,z})=>({typeId:y<64?'minecraft:polished_blackstone_bricks':'minecraft:air',isAir:y>=64,isLiquid:false,isSolid:y<64,location:{x,y,z}}),
  spawnEntity(typeId,location){const e=fixture(typeId).entity;e.location={...location};e.dimension=dim;spawned.push(e);return e;}};
 const entity={id:`boss-test-${serial++}`,typeId:type,isValid:true,dimension:dim,location:{x:0,y:64,z:0},
  hasTag:t=>tags.has(t),addTag:t=>tags.add(t),getTags:()=>[...tags],getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),
  getComponent:()=>undefined,matches:q=>q.families?.every(f=>['monster','mob','boss','undead'].includes(f))??true,
  tryTeleport(p){moves.push(p);entity.location={...p};return true;},addEffect(){},playAnimation(){},triggerEvent:id=>events.push(id),applyImpulse(){},remove(){entity.isValid=false;},
  applyDamage:(...a)=>{damage.push(a);return true;},getHeadLocation:()=>({...entity.location,y:entity.location.y+2}),getViewDirection:()=>({x:0,y:0,z:1}),lookAt(){}};
 return {entity,dim,moves,sounds,particles,spawned,events,damage,props};
}
function emit(entity,eventId){system.afterEvents.scriptEventReceive.emit({id:"jagsby_nether:boss_event",sourceEntity:entity,message:eventId});flush();assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);}
function dueThrough(tick,start){for(let i=start;i<timeouts.length;i++)if(timeouts[i].due<=tick){system.currentTick=timeouts[i].due;timeouts[i].callback();}flush();assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);}
world.getDifficulty=()=> 'Normal';
test('Malzareth teleports without transformation-only tag, including existing untagged saves',()=>{
 const f=fixture();emit(f.entity,'dungeons:nameless_one_teleport');assert.equal(f.moves.length,1);assert(f.sounds.some(([s])=>s==='mob.nameless_one.teleport_out'));
 f.props.set('dungeons:casting',true);emit(f.entity,'dungeons:nameless_one_teleport');assert.equal(f.moves.length,1);
});
test('Malzareth approaches a distant player and casting completion can teleport',()=>{
 const f=fixture();f.dim.getPlayers=()=>[{location:{x:30,y:64,z:30}}];emit(f.entity,'dungeons:nameless_one_teleport_to_player');assert(f.moves[0].x>=15&&f.moves[0].z>=15);
 f.props.set('dungeons:vanguards',true);const start=timeouts.length;emit(f.entity,'dungeons:complete_casting');dueThrough(system.currentTick+4,start);assert.equal(f.moves.length,2);
});
test('teleports reject low ceilings, lava floors, unloaded blocks and failed native collision checks',()=>{
 for(const type of ['ceiling','lava','unloaded']){
  const f=fixture();f.dim.getBlock=p=>type==='unloaded'?undefined:{typeId:type==='lava'&&p.y<64?'minecraft:lava':'minecraft:stone',isAir:false,isLiquid:type==='lava'&&p.y<64,isSolid:type!=='lava'};
  assert.equal(teleportDestination(f.entity),undefined);emit(f.entity,'dungeons:nameless_one_teleport');assert.equal(f.sounds.length,0);
 }
 const f=fixture();f.entity.tryTeleport=()=>false;emit(f.entity,'dungeons:nameless_one_teleport');assert.equal(f.sounds.length,0);
});
test('Nerezhal teleports on Nether stone without ice and returns home in the Nether for bullet hell',()=>{
 const f=fixture('dungeons:wretched_wraith');emit(f.entity,'minecraft:entity_spawned');emit(f.entity,'dungeons:wretched_wraith_teleport');assert.equal(f.moves.length,1);
 const start=timeouts.length;emit(f.entity,'dungeons:begin_bullethell_center');assert.deepEqual(f.moves.at(-1),{x:.5,y:64,z:.5});f.props.set('dungeons:bullethell',true);emit(f.entity,'dungeons:bullethell_start');dueThrough(system.currentTick+2,start);assert(jobs.length>0);
 const job=jobs.at(-1);job.next();assert.equal(f.spawned.at(-1).typeId,'dungeons:wretched_wraith_fire');f.entity.isValid=false;assert.equal(job.next().done,true);
});
test('Nerezhal melee burst damages players and bullet hell launches owned projectile fans',()=>{
 const f=fixture('dungeons:wretched_wraith'),hits=[];
 const target={isValid:true,typeId:'minecraft:player',location:{x:1,y:64,z:0},getGameMode:()=> 'Survival',matches:q=>q.families?.includes('player')??false,applyDamage:(...a)=>{hits.push(a);return true;},runCommand(){},applyKnockback(){},addEffect(){}};
 f.dim.getEntities=()=>[target];let start=timeouts.length;emit(f.entity,'dungeons:melee_attack');dueThrough(system.currentTick+15,start);assert.equal(hits.length,1);
 const shoots=[];f.dim.spawnEntity=(typeId,p)=>{const e=fixture(typeId).entity;e.dimension=f.dim;const comp={shoot:v=>shoots.push(v)};e.getComponent=()=>comp;f.spawned.push(e);return e;};
 f.props.set('dungeons:bullethell',true);start=timeouts.length;emit(f.entity,'dungeons:bullethell_projectile');dueThrough(system.currentTick+18,start);assert.equal(shoots.length,19);assert(f.spawned.every(e=>e.getComponent().owner===f.entity));
});
test('boss projectile friendly-fire prevention does not throw or cancel player hits',()=>{
 for(const id of ['nameless_one','wretched_wraith']){
  const projectile=fixture(`dungeons:${id}_projectile`).entity;
  for(const ally of [true,false]){
   const hurt=fixture().entity;hurt.matches=()=>ally;hurt.applyKnockback=()=>{};
   const e={hurtEntity:hurt,damage:5,damageSource:{damagingProjectile:projectile,cause:EntityDamageCause.projectile}};
   world.beforeEvents.entityHurt.emit(e);assert.equal(!!e.cancel,ally);assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
  }
 }
});
test('Baelgor shockwave damages nearby players, summons blazes and retains shield-break transition',()=>{
 const f=fixture('dungeons:boss_wildfire'),hits=[];
 const target={isValid:true,typeId:'minecraft:player',location:{x:1,y:64,z:0},getGameMode:()=> 'Survival',matches:q=>q.families?.includes('player')??false,applyDamage:(...a)=>{hits.push(a);return true;},runCommand(){},applyKnockback(){}};
 f.dim.getEntities=q=>q.tags?[]:[target];emit(f.entity,'dungeons:destroy_shield');assert.deepEqual(f.events,['dungeons:begin_shockwave']);emit(f.entity,'dungeons:shockwave_damage');assert.equal(hits.length,1);assert.equal(f.spawned.length,2);assert(f.spawned.every(e=>e.typeId==='dungeons:enchanted_blaze'&&e.hasTag('dungeons:hovering_inferno_minion')));
});
test('all active and dormant bosses use native fire immunity and preserve it across damage-sensor phases',()=>{
 for(const path of ['nameless_one/nameless_one','nameless_one/resting_one','wretched_wraith/wretched_wraith','wretched_wraith/resting_wraith','wildfire/wildfire','wildfire/wildfire_resting']){
  const e=JSON.parse(readFileSync(new URL(`../behavior_pack/entities/new/boss/${path}.json`,import.meta.url)))['minecraft:entity'];assert('minecraft:fire_immune' in e.components);
  for(const c of [e.components,...Object.values(e.component_groups??{})])if(c['minecraft:damage_sensor'])for(const cause of ['fire','fire_tick','lava'])assert(c['minecraft:damage_sensor'].triggers.some(t=>t.cause===cause&&t.deals_damage==='no'));
 }
 const controller=JSON.parse(readFileSync(new URL('../behavior_pack/animation_controllers/infernal_lords/nameless.json',import.meta.url))).animation_controllers['controller.animation.nameless_one.casting'];
 assert(controller.states.casting.on_exit.some(s=>s.includes('dungeons:complete_casting')));assert(controller.states.not_casting.on_exit.some(s=>s.includes('dungeons:begin_casting')));
});

test('Malzareth retains the three-shot spell fan and vanguard-driven illusion switch',()=>{
 const f=fixture(),projectile=fixture('dungeons:nameless_one_projectile').entity,shots=[];
 projectile.getComponent=()=>({owner:f.entity});f.dim.spawnEntity=(id,p)=>{const e=fixture(id).entity,comp={shoot:v=>shots.push(v)};e.getComponent=()=>comp;return e;};
 world.afterEvents.entitySpawn.emit({entity:projectile,cause:'Spawned'});flush();assert.equal(shots.length,2); // Original center shot plus two side shots.
 f.dim.getEntities=()=>[{typeId:'dungeons:vanguard'}];f.props.set('dungeons:vanguards',false);emit(f.entity,'dungeons:detect_vanguards');assert.equal(f.props.get('dungeons:vanguards'),true);assert(f.events.includes('dungeons:vanguards_in_range'));
 f.dim.getEntities=()=>[];emit(f.entity,'dungeons:detect_vanguards');assert.equal(f.props.get('dungeons:vanguards'),false);assert(f.events.includes('dungeons:no_vanguards_in_range'));
});

test('Malzareth illusion despawn is delivered even though its original event has no component changes',()=>{
 const f=fixture('dungeons:nameless_one_illusion');emit(f.entity,'dungeons:despawn');assert.equal(f.entity.isValid,false);assert(f.particles.some(([id])=>id==='dungeons:nameless_teleport_out'));
});
