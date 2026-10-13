import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './mock-server.mjs';
import {village} from '../.build/behavior_pack/scripts/settlements/main.js';
import {RECORD_PREFIX} from '../.build/behavior_pack/scripts/settlements/navigation.js';
// Real catalog planning on finite Nether terrain: these floor sizes fit 0–3 homes.
function run(radius,automatic=false){
 const placed=[],spawned=[],notifications=[];let writes=0,completed=false;
 const manager=world.structureManager;
 world.structureManager={place(id){placed.push(id);}};
 const dimension={id:'minecraft:nether',getBiome:()=>({id:'minecraft:crimson_forest'}),getBlock({x,y,z}){
  const inside=Math.abs(x)<=radius&&Math.abs(z)<=radius;
  const typeId=y<=64?(inside?'minecraft:netherrack':'minecraft:lava'):'minecraft:air';
  return {typeId,isAir:typeId==='minecraft:air',isLiquid:typeId==='minecraft:lava',location:{x,y,z},
   setType(){writes++;},setPermutation(){writes++;}};
 },spawnEntity(type){spawned.push(type);return {id:'test-resident',getProperty(){return 1;},triggerEvent(){},remove(){}};}};
 const region=automatic?`test:minimum_region_${radius}`:undefined;
 try{for(const _ of village(dimension,0,0,65,'crimson',123,m=>notifications.push(m),region,()=>{completed=true;})){};}
 finally{world.structureManager=manager;}
 return {placed,spawned,notifications,writes,completed,region};
}
for(const automatic of [false,true])for(const [radius,houses] of [[12,0],[10,1],[15,2]]){
 test(`${automatic?'natural':'command'} planning rejects ${houses} houses without world writes or records`,()=>{
  const before=world.getDynamicPropertyIds(),f=run(radius,automatic);
  assert(f.notifications.some(m=>m.startsWith(`Only ${houses} residential houses fit:`)));
  assert.equal(f.writes,0);assert.deepEqual(f.placed,[]);assert.deepEqual(f.spawned,[]);
  assert.deepEqual(world.getDynamicPropertyIds(),before);assert.equal(f.completed,true);
  if(f.region)assert.equal(world.getDynamicProperty(f.region),undefined);
 });
}
test('a real layout with exactly three residential houses still places and records a village',()=>{
 const f=run(16,true);
 assert(f.notifications.some(m=>m.includes('3 houses, 0 amenities')));
 assert(f.writes>0);assert(f.placed.length>0);
 assert.equal(f.spawned.filter(id=>id==='minecraft:villager_v2').length,3);
 assert.equal(world.getDynamicProperty(f.region),true);
 const records=world.getDynamicPropertyIds().filter(k=>k.startsWith(RECORD_PREFIX));
 assert.equal(records.length,1);assert.equal(JSON.parse(world.getDynamicProperty(records[0])).houses,3);
 for(const k of [...records,f.region])world.setDynamicProperty(k,undefined);
});
