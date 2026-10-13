import test from 'node:test';
import assert from 'node:assert/strict';
import {fillSolidFoundation} from '../behavior_pack/scripts/landmark_terrain.js';
function finish(job){for(let i=0;i<10000;i++){if(job.next().done)return;}assert.fail('Foundation stalled');}
test('solid foundations use a blackstone perimeter and netherrack inside, stopping at existing solids',()=>{
 const writes=[],d={getBlock:({x,y,z})=>({typeId:y<=((x===1&&z===1)?3:1)?'minecraft:stone':y===4?'minecraft:lava':'minecraft:air'}),fillBlocks:(v,type,options)=>writes.push({v,type,options})};
 finish(fillSolidFoundation(d,{x:0,y:6,z:0},[3,5,3],{x:0,z:0,sx:3,sz:3},5));
 assert.equal(writes.length,9);
 for(const w of writes){const center=w.v.from.x===1&&w.v.from.z===1;assert.equal(w.type,center?'minecraft:netherrack':'minecraft:blackstone');assert.equal(w.v.from.y,center?4:2);assert.equal(w.v.to.y,5);assert.deepEqual(w.options.blockFilter.includeTypes,['minecraft:air','minecraft:lava','minecraft:flowing_lava']);}
});
test('foundation does not replace or tunnel through a solid block directly underneath',()=>{
 let writes=0;const d={getBlock:()=>({typeId:'minecraft:chest'}),fillBlocks:()=>writes++};finish(fillSolidFoundation(d,{x:0,z:0},[1,1,1],{x:0,z:0,sx:1,sz:1},50));assert.equal(writes,0);
});
test('foundation stops immediately when a player approaches',()=>{
 const d={getBlock:()=>assert.fail('Should not scan'),fillBlocks:()=>assert.fail('Should not fill')};assert.throws(()=>finish(fillSolidFoundation(d,{x:0,z:0},[1,1,1],{x:0,z:0,sx:1,sz:1},50,()=>false)),/Player approached/);
});
test('raised branch foundations begin beneath actual floor columns and stop at existing structures',()=>{
 const writes=[],d={getBlock:({y})=>({typeId:y===15?'minecraft:polished_blackstone_bricks':'minecraft:air'}),fillBlocks:(v,type)=>writes.push({v,type})};
 finish(fillSolidFoundation(d,{x:0,y:20,z:0},[2,40,2],{x:0,z:0,sx:2,sz:2},5,()=>true,'minecraft:polished_blackstone_bricks',[[0,0,10]]));
 assert.equal(writes.length,1);assert.equal(writes[0].v.from.y,16);assert.equal(writes[0].v.to.y,29);assert.equal(writes[0].type,'minecraft:polished_blackstone_bricks');
});
