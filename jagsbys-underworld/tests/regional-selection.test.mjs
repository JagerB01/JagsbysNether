import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonCandidates,rankComparedSites,compareVillageSite} from '../.build/behavior_pack/scripts/settlements/regional_selection.js';
import {world,system} from './mock-server.mjs';
function finish(job){for(let i=0;i<100000;i++){const s=job.next();system.currentTick++;if(s.done)return s.value;}assert.fail('Job did not finish');}
test('comparison includes distinct loaded regions and distant areas across the full permitted range',()=>{
 const nearby=[{key:'local',distance:20},{key:'local',distance:21},{key:'second',distance:40}],remote=[{key:'close',distance:150},{key:'mid',distance:300},{key:'far',distance:500},{key:'outer',distance:700}];
 const sites=comparisonCandidates(nearby,remote);assert.equal(sites.length,6);assert.equal(new Set(sites.map(c=>c.key)).size,6);assert(sites.some(c=>c.distance===700));assert(sites.some(c=>c.key==='local'));
});
test('better distant terrain wins over first loaded terrain and equal quality does not prefer player proximity',()=>{
 const near={x:0,z:0,seed:123,distance:20,assessment:{score:100,buildingSpace:10}},far={x:500,z:0,seed:456,distance:500,assessment:{score:200,buildingSpace:20}};
 assert.equal(rankComparedSites([near,far])[0],far);
 const equal={...near,assessment:far.assessment};const first=rankComparedSites([equal,far]).map(c=>c.seed);assert.deepEqual(rankComparedSites([{...equal,distance:700},{...far,distance:10}]).map(c=>c.seed),first);
});
test('completed comparative surveys reuse native reads, while missing data defers',()=>{
 let reads=0;const d={id:'minecraft:nether',heightRange:{min:0,max:128},getBlock({x,y,z}){reads++;return {typeId:y<=64?'minecraft:netherrack':'minecraft:air',isAir:y>64,isLiquid:false,location:{x,y,z}};}};
 const c={key:'comparison-cache',x:10000,z:10000,floor:64};assert.equal(finish(compareVillageSite(d,c)).outcome,'ready');const first=reads;assert.equal(finish(compareVillageSite(d,c)).outcome,'ready');assert.equal(reads,first);
 const missing={...d,getBlock:()=>undefined};assert.equal(finish(compareVillageSite(missing,{...c,key:'comparison-missing'})).outcome,'deferred');
});
test('actual automatic job compares multiple regions before writing and chooses better terrain away from arrival',async()=>{
 const {automaticSearch}=await import('../.build/behavior_pack/scripts/settlements/main.js');
 const px=180000,pz=180000,oldPlayers=world.getPlayers,oldManager=world.structureManager,keys=world.getDynamicPropertyIds();let forced=false,comparisons=0,comparisonsAtWrite;
 const dimension={id:'minecraft:nether',heightRange:{min:0,max:128},getBiome:()=>({id:'minecraft:crimson_forest'}),isChunkLoaded:({x,z})=>forced||(Math.abs(x-px)<24&&Math.abs(z-pz)<24),runCommand(c){forced=c.startsWith('tickingarea add ');if(forced&&c.includes('village_compare'))comparisons++;},getBlock({x,y,z}){
  const close=Math.hypot(x-px,z-pz)<180,floor=64+(close?((Math.floor(x/8)%2+2)%2):0);
  return {typeId:y<=floor?'minecraft:netherrack':'minecraft:air',isAir:y>floor,isLiquid:false,location:{x,y,z},setType(){},setPermutation(){}};
 },spawnEntity(){return {id:'resident',triggerEvent(){}};}};
 world.getPlayers=()=>[{dimension,location:{x:px,y:65,z:pz}}];world.structureManager={place(){comparisonsAtWrite??=comparisons;}};
 try{
  finish(automaticSearch(31011));assert(comparisonsAtWrite>=4,'Multiple distinct regions must be assessed before first placement');
  const villageKey=world.getDynamicPropertyIds().find(k=>k.startsWith('nether_settlements:village_location_')&&!keys.includes(k));assert(villageKey);
  const v=JSON.parse(world.getDynamicProperty(villageKey));assert(Math.hypot(v.x-px,v.z-pz)>=180,'Better flat terrain must beat the nearer uneven terrain');assert.equal(forced,false);
 }finally{world.getPlayers=oldPlayers;world.structureManager=oldManager;for(const key of world.getDynamicPropertyIds())if(!keys.includes(key))world.setDynamicProperty(key,undefined);}
});
