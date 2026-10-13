import test from 'node:test';
import assert from 'node:assert/strict';
import {world,intervals,flush,ItemStack} from './mock-server.mjs';
import {worldFixture,playerFixture} from './fixtures.mjs';
import '../.build/behavior_pack/scripts/agriculture/main.js';
import {accessibleSites} from '../.build/behavior_pack/scripts/settlements/accessible_search.js';
test('idle tilling never enumerates players or raycasts; selecting and removing a hoe activates and clears its target',()=>{
 let enumerations=0;world.getAllPlayers=()=>{enumerations++;return [];};flush();assert.equal(enumerations,1);
 const tick=intervals.find(x=>x.ticks===1).callback;
 for(let i=0;i<100;i++)tick();assert.equal(enumerations,1);
 const {dimension,put}=worldFixture('minecraft:nether');const block=put('minecraft:soul_soil');
 const {player,slots}=playerFixture(dimension,{held:new ItemStack('minecraft:iron_hoe')});player.id='hoe-test';let rays=0;
 player.getBlockFromViewDirection=()=>{rays++;return {block,face:'Up'};};
 world.afterEvents.playerHotbarSelectedSlotChange.emit({player});tick();assert.equal(rays,1);assert.equal(block.typeId,'jagsby_nether:tillable_soul_soil');
 slots.set(0,new ItemStack('minecraft:stick'));world.afterEvents.playerInventoryItemChange.emit({player,slot:0});tick();assert.equal(block.typeId,'minecraft:soul_soil');
 for(let i=0;i<100;i++)tick();assert.equal(rays,1);assert.equal(enumerations,1);
});
test('stationary preliminary village survey reuses rankings without repeating block reads',()=>{
 let reads=0;const dimension={id:'survey-test',isChunkLoaded:({x,z})=>x>=0&&x<16&&z>=0&&z<16,getBlock({x,y,z}){reads++;return {typeId:y<=63?'minecraft:netherrack':'minecraft:air',isAir:y>63,isLiquid:false,location:{x,y,z}};}};
 const players=[{dimension,location:{x:0,y:64,z:0}}];const storage={getDynamicProperty:()=>undefined,getDynamicPropertyIds:()=>[]};
 function survey(){const job=accessibleSites(dimension,players,storage,123,new Map(),0);let s;do{s=job.next();}while(!s.done);return s.value;}
 const first=survey();assert(first.length);const before=reads;assert.deepEqual(survey(),first);assert.equal(reads,before);
});
