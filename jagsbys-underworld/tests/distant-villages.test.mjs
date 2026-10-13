import test from 'node:test';
import assert from 'node:assert/strict';
import {distantCandidates,distantClear} from '../.build/behavior_pack/scripts/settlements/distant_sites.js';
import {world,system} from './mock-server.mjs';
const player=(x=0,z=0)=>({location:{x,y:64,z},dimension:{id:'minecraft:nether'}});
test('candidates are within 768 blocks and retain nearby sites and honor completed regions and cooldowns',()=>{
 const players=[player(),player(200)],sites=distantCandidates(world,players,123);
 assert(sites.length);assert(sites.some(s=>s.distance<128));
 for(const s of sites){const distances=players.map(p=>Math.hypot(p.location.x-s.x,p.location.z-s.z));assert(Math.min(...distances)>=0);assert(Math.min(...distances)<=768);}
 const c=sites[0],cooldown=new Map([[c.key,100]]);
 assert(!distantCandidates(world,players,123,cooldown,0).some(s=>s.key===c.key));
 world.setDynamicProperty(c.key,true);try{assert(!distantCandidates(world,players,123).some(s=>s.key===c.key));}finally{world.setDynamicProperty(c.key,undefined);}
});
test('player collision clearance is measured from the nearest footprint edge',()=>{
 const box={x:300,z:0,sx:88,sz:88};
 assert(distantClear([player()],box));assert(!distantClear([player(300)],box));
});
test('actual distant village job force-loads a remote survey then cleans up when no valid village fits',async()=>{
 const {automaticSearch}=await import('../.build/behavior_pack/scripts/settlements/main.js');
 const calls=[],writes=[];let forced=false;
 const dimension={id:'minecraft:nether',isChunkLoaded:()=>forced,runCommand(c){calls.push(c);forced=true;},getBlock({y}){return {typeId:y===0?'minecraft:bedrock':'minecraft:air',isAir:y!==0,isLiquid:false,setType:id=>writes.push(id)};}};
 const p=player();p.dimension=dimension;const old=world.getPlayers;world.getPlayers=()=>[p];
 try{const job=automaticSearch(123);for(let i=0;i<20000;i++){const s=job.next();if(s.done)break;system.currentTick++;if(i===19999)assert.fail('Job did not finish');}}
 finally{world.getPlayers=old;}
 assert(calls[0].startsWith('tickingarea add '));assert(calls[0].endsWith(' true'));assert(calls.at(-1).startsWith('tickingarea remove '));assert.deepEqual(writes,[]);
});
test('automatic generation succeeds even with the player inside its survey square',async()=>{
 const {automaticSearch}=await import('../.build/behavior_pack/scripts/settlements/main.js');
 const oldPlayers=world.getPlayers,oldManager=world.structureManager,placed=[],spawned=[];
 const keys=world.getDynamicPropertyIds();let forced=false;
 const dimension={id:'minecraft:nether',getBiome:()=>({id:'minecraft:crimson_forest'}),
  isChunkLoaded({x,z}){return forced||(x>=-16&&x<32&&z>=-16&&z<32);},
  runCommand(c){forced=c.startsWith('tickingarea add ');},
  getBlock({x,y,z}){return {typeId:y<=64?'minecraft:netherrack':'minecraft:air',isAir:y>64,isLiquid:false,location:{x,y,z},setType(){},setPermutation(){}};},
  spawnEntity(type){spawned.push(type);return {id:'resident',triggerEvent(){}};}};
 const p=player();p.dimension=dimension;world.getPlayers=()=>[p];world.structureManager={place:id=>placed.push(id)};
 try{
  const job=automaticSearch(31011);for(let i=0;i<100000;i++){const s=job.next();if(s.done)break;system.currentTick++;if(i===99999)assert.fail('Job stalled');}
  assert(placed.length,'The real village planner must place structures');
  assert(spawned.filter(t=>t==='minecraft:villager_v2').length>=3);
  assert.equal(forced,false,'Temporary area must be removed');
 }finally{
  world.getPlayers=oldPlayers;world.structureManager=oldManager;
  for(const key of world.getDynamicPropertyIds())if(!keys.includes(key))world.setDynamicProperty(key,undefined);
 }
});
