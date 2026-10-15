import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,intervals,flush,startup,itemComponents} from './mock-server.mjs';
import {runtimeStatus,spawnEnchanted,registerEnchantedVariant} from '../behavior_pack/scripts/infernal_lords/main.js';
const dim={id:'minecraft:nether',getEntities(){return[];},getPlayers(){return[];},isChunkLoaded(){return true;}};
world.getDimension=()=>dim;
world.getDifficulty=()=> 'Normal';
function mob(id,type='dungeons:enchanted_necromancer',families=['enchanted','necromancer','monster','mob']){
 const tags=new Set(),props=new Map();
 return {id,typeId:type,dimension:dim,isValid:true,location:{x:0,y:64,z:0},getTags:()=>[...tags],hasTag:tag=>tags.has(tag),addTag:tag=>tags.add(tag),
  getProperty(){return undefined;},getComponent(){return undefined;},getDynamicProperty:key=>props.get(key),setDynamicProperty:(key,value)=>props.set(key,value),getEffect(){},
  matches(q){return (!q.type||q.type===type)&&(!q.families||q.families.every(f=>families.includes(f)))&&(!q.excludeFamilies||!q.excludeFamilies.some(f=>families.includes(f)))&&(!q.tags||q.tags.every(t=>tags.has(t)))&&(!q.excludeTags||!q.excludeTags.some(t=>tags.has(t)));}};
}
function remove(entity){entity.isValid=false;world.afterEvents.entityRemove.emit({removedEntityId:entity.id});flush();}
test('all imported handlers load with no idle interval or unrelated mob conversion',()=>{
 assert.equal(runtimeStatus().ticking,false);assert.equal(intervals.length,0);
 const normal=mob('normal','minecraft:zombie',['monster','mob']);world.afterEvents.entitySpawn.emit({entity:normal,cause:'Spawned'});flush();
 assert.equal(runtimeStatus().loaded,0);assert.equal(normal.getTags().length,0);
 startup();assert(itemComponents.has('dungeons:glaive'));assert(itemComponents.has('dungeons:toughness'));assert(itemComponents.has('dungeons:durability_fix'));
});
test('normal and dormant imported actors do not wake enchanted polling',()=>{
 const boss=mob('rest','dungeons:boss_wildfire_resting',['mob','boss']);world.afterEvents.entityLoad.emit({entity:boss});
 assert.equal(runtimeStatus().loaded,1);assert.equal(runtimeStatus().ticking,false);remove(boss);
});
test('original Easy enchant selection assigns one ability; scheduler sleeps after unload and resumes on load',()=>{
 world.getDifficulty=()=> 'Easy';const entity=mob('ench');const random=Math.random;Math.random=()=>0;
 try{world.afterEvents.entitySpawn.emit({entity,cause:'Spawned'});flush();}finally{Math.random=random;}
 assert(entity.hasTag('dungeons:enchanted'));assert.equal(entity.getDynamicProperty('dungeons:enchant_count'),1);assert(entity.hasTag('dungeons:enchanted_mob_burning'));
 assert.equal(runtimeStatus().ticking,true);const run=intervals.at(-1);world.afterEvents.entityRemove.emit({removedEntityId:entity.id});assert.equal(run.cancelled,true);assert.equal(runtimeStatus().ticking,false);
 world.afterEvents.entityLoad.emit({entity});assert.equal(runtimeStatus().ticking,true);assert.equal(entity.getDynamicProperty('dungeons:enchant_count'),1);remove(entity);
 world.getDifficulty=()=> 'Normal';
});
test('original 1.5x baseline, Double Damage and Protection compose in native before-hurt events',()=>{
 const attacker=mob('attacker');attacker.addTag('dungeons:enchanted_mob_double_damage');
 const target=mob('player','minecraft:player',['player']);
 const event={hurtEntity:target,damage:10,damageSource:{damagingEntity:attacker,cause:'entityAttack'}};
 world.beforeEvents.entityHurt.emit(event);flush();assert.equal(event.damage,30);
 attacker.addTag('dungeons:enchanted_mob_protection');const incoming={hurtEntity:attacker,damage:10,damageSource:{damagingEntity:target,cause:'entityAttack'}};
 world.beforeEvents.entityHurt.emit(incoming);flush();assert.equal(incoming.damage,5);
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
test('Baelgor shield-break event retains the original shockwave transition',()=>{
 const boss=mob('baelgor','dungeons:boss_wildfire',['boss','monster','mob']);const triggered=[];boss.triggerEvent=id=>triggered.push(id);
 world.afterEvents.dataDrivenEntityTrigger.emit({entity:boss,eventId:'dungeons:destroy_shield'});flush();assert.deepEqual(triggered,['dungeons:begin_shockwave']);
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
test('future trial-spawner API rejects tag-only conversions and accepts explicitly registered definitions',()=>{
 assert.throws(()=>spawnEnchanted(dim,'minecraft:zombie',{x:0,y:0,z:0}),/declared enchanted BP variant/);
 registerEnchantedVariant('test:declared_enchanted');dim.spawnEntity=(type,location)=>Object.assign(mob('future',type),{location});
 const entity=spawnEnchanted(dim,'test:declared_enchanted',{x:1,y:2,z:3});assert.equal(entity.typeId,'test:declared_enchanted');assert.equal(runtimeStatus().ticking,true);remove(entity);
 assert.equal(runtimeStatus().ticking,false);
});
test('Hard preserves the original higher multi-enchant chance and three-enchantment cap',()=>{
 world.getDifficulty=()=> 'Hard';const entity=mob('hard');const random=Math.random;const values=[0,.05,.6,.25,.3,.45];Math.random=()=>values.shift()??.8;
 try{world.afterEvents.entitySpawn.emit({entity,cause:'Spawned'});flush();}finally{Math.random=random;world.getDifficulty=()=> 'Normal';}
 assert.equal(entity.getDynamicProperty('dungeons:enchant_count'),3);assert.equal(entity.getTags().filter(t=>t.startsWith('dungeons:enchanted_mob_')).length,3);remove(entity);
});
test('Quick and Regeneration retain source values and use no unbounded native scan while active',()=>{
 const entity=mob('periodic');entity.addTag('dungeons:enchanted_mob_quick');entity.addTag('dungeons:enchanted_mob_regeneration');
 const health={currentValue:30,defaultValue:100,setCurrentValue(n){this.currentValue=n;}};const effects=[];
 entity.getComponent=id=>id==='health'?health:undefined;entity.addEffect=(...args)=>effects.push(args);entity.getAABB=()=>({extent:{x:.5,y:1}});
 dim.spawnParticle=()=>{};const oldQuery=dim.getEntities;dim.getEntities=q=>{assert(q.location,'No full-dimension scan');return[];};
 const oldPlayers=world.getPlayers;let playerReads=0;world.getPlayers=()=>{playerReads++;return[{dimension:dim,getComponent(){},getEntitiesFromViewDirection(){return[];}}];};
 world.afterEvents.entityLoad.emit({entity});system.currentTick=6;intervals.at(-1).callback();
 assert.equal(health.currentValue,31);assert(effects.some(([id,time,o])=>id==='speed'&&time===999999&&o.amplifier===2));assert.equal(playerReads,1);
 assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);remove(entity);world.getPlayers=oldPlayers;dim.getEntities=oldQuery;
});
test('Radiance heals matching allies by the original eight HP instead of checking the result array as an entity',()=>{
 const caster=mob('radiance');caster.addTag('dungeons:enchanted_mob_radiance');const ally=mob('ally','dungeons:necromancer',['monster','mob']);
 const health={currentValue:40,defaultValue:50,setCurrentValue(n){this.currentValue=n;}};ally.getComponent=id=>id==='health'?health:undefined;
 const oldQuery=dim.getEntities,random=Math.random;dim.getEntities=()=>[ally];dim.spawnParticle=()=>{};dim.playSound=()=>{};Math.random=()=>0;
 try{world.afterEvents.entityHurt.emit({hurtEntity:mob('hurt','minecraft:player',['player']),damage:8,damageSource:{damagingEntity:caster,cause:'entityAttack'}});flush();}
 finally{Math.random=random;dim.getEntities=oldQuery;}
 assert.equal(health.currentValue,48);assert.equal(runtimeStatus().failures,0,runtimeStatus().lastError);
});
