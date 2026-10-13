import test from 'node:test';
import assert from 'node:assert/strict';
import {surveyLandmark,clearVolume,obstructionReason} from '../behavior_pack/scripts/landmark_terrain.js';
import {smallSites,GiantSearch,attemptKey} from '../behavior_pack/scripts/giant_search.js';
import {candidateAt} from '../behavior_pack/scripts/landmark_sites.js';
import {TerrainSurvey,terrainSurvey} from '../behavior_pack/scripts/terrain_survey.js';
import {naturalCandidates} from '../behavior_pack/scripts/landmarks.js';
import {BlockVolume} from './mock-server.mjs';
function finish(job){for(let i=0;i<50000;i++){const s=job.next();if(s.done)return s.value;}assert.fail('Survey stalled');}
function scene(){return {id:'minecraft:nether',runCommand(){},getBiome:()=>({id:'minecraft:basalt_deltas'}),getBlock({x,y,z}){const floor=64+(Math.floor(x/8)%2===0?8:0);return {typeId:y<=floor?'minecraft:basalt':'minecraft:air',isAir:y>floor,location:{x,y,z}};},containsBlock:()=>false};}
test('small arena fits uneven ground and cave obstructions that it can carve',()=>{
 const c={id:'small_arena',x:0,z:0,floorHint:64,biome:'nether_wastes'},plan=finish(surveyLandmark(c,scene()));assert.equal(plan.outcome,'ready');assert(plan.carve);assert(plan.supports.flat().length>0);
});
test('giants do not depend on the native biome query and accept higher lava oceans',()=>{
 const d=scene();delete d.getBiome;d.getBlock=({y})=>({typeId:y<=4?'minecraft:netherrack':y<=75?'minecraft:lava':'minecraft:air'});
 const plan=finish(surveyLandmark({id:'large_arena',x:0,z:0},d));assert.equal(plan.outcome,'ready');assert.equal(plan.surface,75);
});
test('small arena regions expose multiple sites, retain observations and remember failure only for one cell',()=>{
 const r=candidateAt('small',10,10,123),x=r.gx*600+200,z=r.gz*600+200;
 const candidates=smallSites(r,[[x,z,64,100,'minecraft:basalt']]);assert(candidates.length>50);assert(candidates.some(c=>c.x===x&&c.observed));
 const m=new Map(),storage={getDynamicProperty:k=>m.get(k),setDynamicProperty:(k,v)=>m.set(k,v)},search=new GiantSearch(storage);
 search.reject(candidates[0],'Uneven');assert(search.failed(candidates[0]));const other=candidates.find(c=>attemptKey(c)!==attemptKey(candidates[0]));assert(!search.failed(other));assert(new GiantSearch(storage).failed(candidates[0]));
});
test('nearby arena sites are no longer excluded by the old 64/128-block survey margins',()=>{
 const r=candidateAt('small',1100,1100,123),x=r.gx*600+300,z=r.gz*600+300;terrainSurvey.ground(x,z,64,100,'minecraft:basalt');
 const online=[{dimension:{id:'minecraft:nether'},location:{x:x+70,y:65,z}}];assert(naturalCandidates(online,123).some(c=>c.family==='small'&&c.x===x));
});
test('protected block diagnostics identify material and position',()=>{
 const d={containsBlock:()=>true,getBlocks:()=>({*getBlockLocationIterator(){yield {x:1,y:40,z:2};}}),getBlock:()=>({typeId:'minecraft:chest'})};
 assert.equal(finish(clearVolume(d,{x:0,y:33,z:0},[16,18,16],31,true)),false);assert.match(obstructionReason(),/minecraft:chest at 1, 40, 2/);
});
