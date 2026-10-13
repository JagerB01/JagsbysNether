import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './mock-server.mjs';
import {village} from '../.build/behavior_pack/scripts/settlements/main.js';
for(const theme of ['crimson','warped'])test(`${theme} planner includes a farm and plants its biome's crops`,()=>{
 const placed=[],plants=[];const old=world.structureManager;
 world.structureManager={place:id=>placed.push(id)};
 const dimension={id:'minecraft:nether',getBiome:()=>({id:theme==='crimson'?'minecraft:crimson_forest':'minecraft:warped_forest'}),getBlock({x,y,z}){
  return {typeId:y<=64?'minecraft:netherrack':'minecraft:air',isAir:y>64,isLiquid:false,location:{x,y,z},setType(id){plants.push(id);},setPermutation(){}};
 },spawnEntity(){return {id:'resident',triggerEvent(){}};}};
 try{
  let iterations=0;for(const _ of village(dimension,0,0,65,theme,2,()=>{})){assert(++iterations<20000,'Planner must finish');}
  assert(placed.some(id=>id.includes('_farm_')),'At least one farm should fit');
  assert(plants.filter(id=>id===(theme==='crimson'?'jagsby_nether:rye_crop':'jagsby_nether:polyps')).length>=28);
 }finally{world.structureManager=old;}
});
