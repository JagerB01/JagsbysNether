import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './mock-server.mjs';
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
