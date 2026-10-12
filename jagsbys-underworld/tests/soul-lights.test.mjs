import test from 'node:test';
import assert from 'node:assert/strict';
import {world,intervals} from './mock-server.mjs';
import {isHostileSpawn,suppressHostileSpawn} from '../behavior_pack/scripts/soul_lights.js';
function fixture(typeId='minecraft:zombie',location={x:0.5,y:64.5,z:0.5},family=['monster'],tamed=false){
 const blocks=[];let queries=0,removed=0;
 const dimension={heightRange:{min:-64,max:320},getBlocks(volume,filter,allowUnloaded){
  queries++;assert.equal(allowUnloaded,true);
  assert.deepEqual(filter.includeTypes,['minecraft:soul_torch','minecraft:soul_lantern']);
  assert(volume.from.y>=-64&&volume.to.y<320);
  const matches=blocks.filter(b=>filter.includeTypes.includes(b.typeId)&&['x','y','z'].every(k=>b.location[k]>=volume.from[k]&&b.location[k]<=volume.to[k]));
  return {getBlockLocationIterator(){return matches.map(b=>b.location);}};
 },getBlock(position){return blocks.find(b=>['x','y','z'].every(k=>position[k]===b.location[k]));},spawnItem(){throw Error('Suppression must not drop items');}};
 const entity={typeId,location,dimension,isValid:true,
  hasComponent(id){return id==='minecraft:is_tamed'&&tamed;},getProperty(){return tamed;},
  getComponent(id){return id==='minecraft:type_family'?{hasTypeFamily:f=>family.includes(f)}:undefined;},
  remove(){removed++;this.isValid=false;},kill(){throw Error('Suppression must not kill');},applyDamage(){throw Error('Suppression must not deal damage');}};
 const light=(typeId='minecraft:soul_torch',location={x:0,y:64,z:0})=>blocks.push({typeId,location});
 return {entity,blocks,light,queries:()=>queries,removed:()=>removed};
}
for(const [type,radius] of [['minecraft:soul_torch',12],['minecraft:soul_lantern',16]]){
 test(`${type} suppresses exactly at its ${radius}-block boundary`,()=>{
  const f=fixture('minecraft:zombie',{x:radius+0.5,y:64.5,z:0.5});f.light(type);
  assert.equal(suppressHostileSpawn(f.entity),true);assert.equal(f.removed(),1);assert.equal(f.queries(),1);
 });
 test(`${type} allows spawns just outside its range`,()=>{
  const f=fixture('minecraft:zombie',{x:radius+0.501,y:64.5,z:0.5});f.light(type);
  assert.equal(suppressHostileSpawn(f.entity),false);assert.equal(f.removed(),0);
 });
}
test('distance is spherical, including vertical distance and diagonal corners',()=>{
 const f=fixture('minecraft:zombie',{x:12.5,y:64.5,z:12.5});f.light('minecraft:soul_lantern');
 assert.equal(suppressHostileSpawn(f.entity),false);
 f.entity.location={x:0.5,y:80.5,z:0.5};assert.equal(suppressHostileSpawn(f.entity),true);
});
test('ordinary torches and lanterns do not suppress hostile spawns',()=>{
 const f=fixture();f.light('minecraft:torch');f.light('minecraft:lantern');
 assert.equal(suppressHostileSpawn(f.entity),false);assert.equal(f.removed(),0);
});
test('passive creatures and tamed monster-family pets never trigger a block search',()=>{
 for(const [id,family,tamed] of [['minecraft:villager_v2',['villager'],false],['jagsby_nether:crimson_hongo',['hongo'],false],['jagsby_nether:blackstone_skitterchest',['skitterchest'],false],['test:pet',['monster'],true]]){
  const f=fixture(id,undefined,family,tamed);f.light();assert.equal(suppressHostileSpawn(f.entity),false);assert.equal(f.queries(),0);
 }
});
test('untamed hostile Skitterchests, hoglins and add-on monster mobs are covered',()=>{
 for(const [id,family] of [['jagsby_nether:crimson_skitterchest',['skitterchest']],['jagsby_nether:warped_skitterchest',['skitterchest']],['minecraft:hoglin',['hoglin']],['test:hostile',['monster']]]){
  const f=fixture(id,undefined,family);f.light();assert.equal(suppressHostileSpawn(f.entity),true);
 }
});
test('the spawn event suppresses a new hostile but loading existing mobs does not',()=>{
 const f=fixture();f.light();world.afterEvents.entityLoad.emit({entity:f.entity});assert.equal(f.queries(),0);
 world.afterEvents.entitySpawn.emit({entity:f.entity,cause:'Spawned'});assert.equal(f.removed(),1);
 assert.deepEqual(intervals,[]);
});
test('block queries read current lights, so placing and removing a torch take effect immediately',()=>{
 const f=fixture();assert.equal(suppressHostileSpawn(f.entity),false);f.light();
 assert.equal(suppressHostileSpawn(f.entity),true);
 f.entity.isValid=true;f.blocks.length=0;assert.equal(suppressHostileSpawn(f.entity),false);
 assert.equal(f.removed(),1);
});
test('search bounds are clipped at both world-height limits',()=>{
 for(const y of [-63.5,319.5]){
  const f=fixture('minecraft:zombie',{x:0.5,y,z:0.5});f.light('minecraft:soul_torch',{x:0,y:Math.floor(y),z:0});
  assert.equal(suppressHostileSpawn(f.entity),true);
 }
});
test('already removed entities are ignored before accessing components or blocks',()=>{
 const f=fixture();f.entity.isValid=false;assert.equal(isHostileSpawn(f.entity),false);assert.equal(suppressHostileSpawn(f.entity),false);assert.equal(f.queries(),0);
});
