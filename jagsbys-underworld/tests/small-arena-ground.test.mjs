import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSmallGroundLevel,surveySmallGround,SMALL_FOUNDATION_DEPTH} from '../behavior_pack/scripts/small_arena_terrain.js';
import {NATURAL_ARENAS} from '../behavior_pack/scripts/natural_arena_catalog.js';
import {surveyLandmark,fillSolidFoundation} from '../behavior_pack/scripts/landmark_terrain.js';
function finish(job){let s;for(let i=0;i<200000;i++){s=job.next();if(s.done)return s.value;}assert.fail('Stalled');}
test('Small Arena selects the broad lower ground instead of its center pillar and rejects unsupported terrain',()=>{
 assert.equal(chooseSmallGroundLevel([65,65,65,65,65,65,65,65,65,85]),65);
 assert.equal(chooseSmallGroundLevel([65,65,undefined,undefined,undefined]),undefined);
 assert.equal(SMALL_FOUNDATION_DEPTH,6);
});
test('Small Arena terrain sampling ignores every empty bounding-box corner',()=>{
 const arena=NATURAL_ARENAS.small_arena,mask=new Set(arena.sections.flatMap(s=>s.foundationColumns.map(([x,z])=>`${x+s.offset[0]},${z+s.offset[2]}`))),queried=[];
 const x=-Math.floor(arena.size[0]/2),z=-Math.floor(arena.size[2]/2);
 const d={id:'minecraft:nether',runCommand(){},getBlock(p){if(p.y!==0){assert(mask.has(`${p.x-x},${p.z-z}`));queried.push(p);}return {typeId:p.y<=60?'minecraft:basalt':'minecraft:air',isAir:p.y>60};}};
 assert.equal(finish(surveySmallGround({x:0,z:0},d,76)),60);assert(queried.length>0);
});
test('Small Arena foundation connects to its authored floor and never builds a tall pedestal',()=>{
 const writes=[],d={getBlock:({y})=>({typeId:y<=60?'minecraft:basalt':'minecraft:air'}),fillBlocks:(v,type)=>writes.push({v,type})};
 finish(fillSolidFoundation(d,{x:0,y:64,z:0},[16,18,16],{x:0,z:0,sx:56,sz:93},63,()=>true,undefined,[[3,4,1,true]],6));
 assert.equal(writes.length,1);assert.equal(writes[0].v.to.y,64);assert.equal(writes[0].v.from.y,61);assert.equal(writes[0].v.from.x,3);assert.equal(writes[0].v.from.z,4);
 writes.length=0;finish(fillSolidFoundation(d,{x:0,y:90,z:0},[16,18,16],{x:0,z:0,sx:56,sz:93},89,()=>true,undefined,[[3,4,1,true]],6));assert.equal(writes.length,0);
});
test('Small Arena protected-block queries use its real build outline rather than unused corners',()=>{
 const arena=NATURAL_ARENAS.small_arena,queried=[];
 const d={id:'minecraft:nether',runCommand(){},getBiome:()=>({id:'minecraft:basalt_deltas'}),getBlock:({y})=>({typeId:y<=60?'minecraft:basalt':'minecraft:air',isAir:y>60}),containsBlock(volume){queried.push(volume);return false;}};
 const plan=finish(surveyLandmark({id:'small_arena',x:0,z:0},d));assert.equal(plan.outcome,'ready');
 const corner={x:plan.origin.x,z:plan.origin.z};assert(!queried.some(v=>v.from.x<=corner.x&&v.to.x>=corner.x&&v.from.z<=corner.z&&v.to.z>=corner.z));assert(queried.length>0);
});
