import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './mock-server.mjs';
import {pools} from '../.build/behavior_pack/scripts/settlements/catalog.js';
import {farEnough,RECORD_PREFIX} from '../.build/behavior_pack/scripts/settlements/navigation.js';
import {village} from '../.build/behavior_pack/scripts/settlements/main.js';
for(const theme of ['crimson','warped'])for(const [seed,minimum] of [[2,6],[123,9],[7000,12]])test(`${theme} seed ${seed} reaches at least ${minimum} homes with a farm on open terrain`,()=>{
 const placed=[],plants=[],residents=[];const old=world.structureManager;
 world.structureManager={place:id=>placed.push(id)};
 const dimension={id:'minecraft:nether',getBiome:()=>({id:theme==='crimson'?'minecraft:crimson_forest':'minecraft:warped_forest'}),getBlock({x,y,z}){
  return {typeId:y<=64?'minecraft:netherrack':'minecraft:air',isAir:y>64,isLiquid:false,location:{x,y,z},setType(id){plants.push(id);},setPermutation(){}};
 },spawnEntity(id){residents.push(id);return {id:'resident',triggerEvent(){}};}};
 try{
  let iterations=0;for(const _ of village(dimension,0,0,65,theme,seed,()=>{})){assert(++iterations<100000,'Planner must finish');}
  assert(residents.filter(id=>id==='minecraft:villager_v2').length>=minimum);
  assert(placed.some(id=>id.includes('_farm_')),'At least one farm should fit');
  assert(plants.filter(id=>id===(theme==='crimson'?'jagsby_nether:rye_crop':'jagsby_nether:polyps')).length>=28);
 }finally{world.structureManager=old;}
});

test('open terrain with no available farm rejects the entire village before writing',()=>{
 const saved=Object.entries(pools).map(([key,value])=>[key,value]);
 const manager=world.structureManager,before=world.getDynamicPropertyIds();let writes=0;const messages=[];
 for(const [key,value] of saved)pools[key]=value.filter(([id])=>!id.includes('_farm_'));
 world.structureManager={place(){writes++;}};
 const dimension={id:'minecraft:nether',getBiome:()=>({id:'minecraft:crimson_forest'}),getBlock({x,y,z}){
  return {typeId:y<=64?'minecraft:netherrack':'minecraft:air',isAir:y>64,isLiquid:false,location:{x,y,z},setType(){writes++;},setPermutation(){writes++;}};
 },spawnEntity(){writes++;throw Error('No residents should spawn');}};
 try{
  for(const _ of village(dimension,0,0,65,'crimson',123,m=>messages.push(m))){}
  assert(messages.some(m=>m.startsWith('No farm fits:')),messages.join('\n'));
  assert.equal(writes,0);assert.deepEqual(world.getDynamicPropertyIds(),before);
 }finally{world.structureManager=manager;for(const [key,value] of saved)pools[key]=value;}
});
test('new village sites require 256 blocks from existing centers, including older small villages',()=>{
 const key=RECORD_PREFIX+'spacing_test';world.setDynamicProperty(key,JSON.stringify({x:0,z:0,houses:3}));
 try{assert.equal(farEnough(world,255,0),false);assert.equal(farEnough(world,256,0),true);assert.equal(farEnough(world,0,-255),false);}
 finally{world.setDynamicProperty(key,undefined);}
});

test('large farms are absent from village catalogs, pools and packed template assets',async()=>{
 const {catalog}=await import('../.build/behavior_pack/scripts/settlements/catalog.js');
 const {readdirSync,readFileSync}=await import('node:fs');
 assert(Object.keys(catalog).every(id=>!id.includes('large_farm')));
 assert(Object.values(pools).every(entries=>entries.every(([id])=>!id.includes('large_farm'))));
 for(const theme of ['crimson','warped']){
  assert(Object.keys(catalog).some(id=>id.includes(`/villages/${theme}/`)&&id.includes('small_farm')));
  for(const base of ['terrain/villages','villages']){
   const path=new URL(`../.build/behavior_pack/structures/nether_settlements/${base}/${theme}/houses/`,import.meta.url);
   assert(readdirSync(path).every(name=>!name.includes('large_farm')));
  }
  for(const file of [`features/${theme}_weighted.json`,`worldgen/template_pools/${theme}_houses.json`])
   assert(!readFileSync(new URL('../.build/behavior_pack/'+file,import.meta.url),'utf8').includes('large_farm'));
 }
});
