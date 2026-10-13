import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './mock-server.mjs';
import {farmNearbyCrop} from '../behavior_pack/scripts/villager_farming.js';
function fixture(type='jagsby_nether:rye_crop'){
 let age=7;const harvest=[];const block={typeId:type,get permutation(){return {getState:()=>age,withState:(key,value)=>({age:value})};},setPermutation(p){age=p.age??7;}};
 const dimension={getBlock(p){if(p.x===0&&p.z===0&&p.y===64)return block;if(p.x===0&&p.z===0&&p.y===63)return {typeId:'jagsby_nether:soul_soil_farmland'};},getBlockFromRay(){},spawnItem(stack){harvest.push(stack);}};
 const v={typeId:'minecraft:villager_v2',isValid:true,hasComponent:()=>false,location:{x:.5,y:64,z:.5},dimension,getComponent:k=>k==='minecraft:variant'?{value:1}:undefined,getHeadLocation:()=>({x:.5,y:65.6,z:.5})};
 return {v,dimension,harvest,age:()=>age,setAge:n=>age=n};
}
for(const [type,item] of [['jagsby_nether:rye_crop','jagsby_nether:rye'],['jagsby_nether:polyps','jagsby_nether:polyp']])test(`farmers harvest and replant ${type}`,()=>{
 const f=fixture(type);assert.equal(farmNearbyCrop(f.v),true);assert.equal(f.age(),0);assert.equal(f.harvest[0].typeId,item);assert.equal(farmNearbyCrop(f.v),false);assert.equal(f.harvest.length,1);
});
test('non-farmers, babies, immature crops and mobGriefing=false prevent harvest',()=>{
 let f=fixture();f.v.getComponent=()=>({value:2});assert.equal(farmNearbyCrop(f.v),false);
 f=fixture();f.v.hasComponent=()=>true;assert.equal(farmNearbyCrop(f.v),false);
 f=fixture();f.setAge(6);assert.equal(farmNearbyCrop(f.v),false);
 world.gameRules.mobGriefing=false;try{assert.equal(farmNearbyCrop(fixture().v),false);}finally{world.gameRules.mobGriefing=true;}
});
test('walls and night hours prevent harvest',()=>{
 const f=fixture();f.dimension.getBlockFromRay=()=>({block:{typeId:'minecraft:stone'}});assert.equal(farmNearbyCrop(f.v),false);
 f.dimension.getBlockFromRay=()=>undefined;world.getTimeOfDay=()=>13000;try{assert.equal(farmNearbyCrop(f.v),false);}finally{delete world.getTimeOfDay;}
});
test('failed item spawning restores ripe crop',()=>{
 const f=fixture();f.dimension.spawnItem=()=>{throw Error('unloaded');};assert.throws(()=>farmNearbyCrop(f.v),/unloaded/);assert.equal(f.age(),7);
});
