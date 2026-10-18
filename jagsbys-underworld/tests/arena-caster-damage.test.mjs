import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,timeouts,flush} from './mock-server.mjs';
import {runtimeStatus} from '../behavior_pack/scripts/infernal_lords/main.js';
import {fireCastHits} from '../behavior_pack/scripts/infernal_lords/arena_damage.js';
function target(id='player'){
 const hits=[];return {id,typeId:'minecraft:player',isValid:true,location:{x:0,y:64,z:0},hits,getComponent:id=>id.includes('health')?{currentValue:20,defaultValue:20}:undefined,getEffect(){},getGameMode:()=> 'Survival',matches:q=>q.families?.includes('player')??false,applyDamage:(damage)=>{hits.push(damage);return true;},applyKnockback(){},addEffect(){},setOnFire(){}};
}
function fire(id,cast,player,type='tower_wraith'){
 const dim={id:'minecraft:nether',getEntitiesAtBlockLocation:()=>[player],spawnParticle(){}};
 return {id,typeId:'dungeons:wraith_fire',isValid:true,dimension:dim,location:player.location,getDynamicProperty:key=>key==='dungeons:fire_type'?type:cast,hasTag:()=>false,getComponent(){}};
}
function emit(entity,id){system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:boss_event',sourceEntity:entity,message:id});flush();assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);}
test('necromancer projectile base hits scale to 6/10/14 and preserve upstream modifiers and enchanted multiplier',()=>{
 const projectile={typeId:'dungeons:necromancer_shot',hasTag:()=>false};
 for(const [difficulty,expected] of [['Easy',6],['Normal',10],['Hard',14]]){
  world.getDifficulty=()=>difficulty;
  const e={hurtEntity:target(),damage:10,damageSource:{damagingProjectile:projectile,cause:'projectile'}};world.beforeEvents.entityHurt.emit(e);assert.equal(e.damage,expected);
 }
 world.getDifficulty=()=> 'Hard';
 const reduced={hurtEntity:target(),damage:5,damageSource:{damagingProjectile:projectile,cause:'projectile'}};world.beforeEvents.entityHurt.emit(reduced);assert.equal(reduced.damage,7);
 const caster={typeId:'dungeons:enchanted_necromancer',isValid:true,hasTag:()=>false,getComponent:()=>({currentValue:100,defaultValue:100}),addEffect(){},matches:q=>!!q.families?.includes('enchanted')&&!q.tags?.length};
 const enchanted={hurtEntity:target(),damage:10,damageSource:{damagingEntity:caster,damagingProjectile:projectile,cause:'projectile'}};world.beforeEvents.entityHurt.emit(enchanted);assert.equal(enchanted.damage,21);assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
test('Tower Wraith opening fire hit is shared across patches; subsequent pulses and new casts behave separately',()=>{
 world.getDifficulty=()=> 'Hard';const p=target(),first=fire('first','cast-A',p),second=fire('second','cast-A',p);
 emit(first,'dungeons:wraith_fire_hit');emit(first,'dungeons:wraith_fire_hit');emit(second,'dungeons:wraith_fire_hit');assert.deepEqual(p.hits,[14,2,2]);
 emit(fire('third','cast-B',p),'dungeons:wraith_fire_hit');assert.equal(p.hits.at(-1),14);
 emit(fire('ordinary','ordinary',p,'wraith'),'dungeons:wraith_fire_hit');assert.equal(p.hits.at(-1),3);
});
test('Tower Wraith poison gives each player one full hit per cloud, then lower lingering pulses',()=>{
 world.getDifficulty=()=> 'Hard';const p=target(),later=target('later');let players=[p];
 const cloud={id:'poison',typeId:'dungeons:tower_wraith_poison',isValid:true,hasTag:()=>false,location:p.location,dimension:{id:'minecraft:nether',spawnParticle(){},playSound(){},getEntities:()=>players}};
 const start=timeouts.length;emit(cloud,'minecraft:entity_spawned');assert.deepEqual(p.hits,[14]);players=[p,later];
 timeouts[start].callback();assert.deepEqual(p.hits,[14,2]);assert.deepEqual(later.hits,[14]);
 emit({...cloud,id:'new-poison'},'minecraft:entity_spawned');assert.equal(p.hits.at(-1),14);assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
test('fire opening history expires only during active access without recurring work',()=>{
 fireCastHits('expires',0).add('player');assert(fireCastHits('expires',500).has('player'));assert.equal(fireCastHits('expires',601).has('player'),false);
});
