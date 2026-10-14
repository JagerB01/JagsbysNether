import {modularSections} from '../behavior_pack/scripts/modular_fortress.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,timeouts} from './mock-server.mjs';
import {candidateAt,boxGap,spacingAllows,GIANT_REGION} from '../behavior_pack/scripts/landmark_sites.js';
import {surveyLandmark,biomeAllows,biomeName} from '../behavior_pack/scripts/landmark_terrain.js';
import {generateLandmark,naturalCandidates,playersClear} from '../behavior_pack/scripts/landmarks.js';
import {runGenerationJob,generationBusy} from '../behavior_pack/scripts/generation_queue.js';
import {ARENAS} from '../behavior_pack/scripts/arena_catalog.js';
import {NATURAL_ARENAS} from '../behavior_pack/scripts/natural_arena_catalog.js';
function finish(job,limit=50000){for(let i=0;i<limit;i++){const step=job.next();system.currentTick++;if(step.done)return step.value;}assert.fail('Job did not finish');}
function fixture(ocean=true,biome='minecraft:basalt_deltas'){
 const loads=[],placed=[],fills=[];let reads=0,queries=0,obstruction;
 const dimension={id:'minecraft:nether',getBiome:()=>({id:biome}),runCommand:c=>loads.push(c),getBlock({x,y,z}){reads++;return {typeId:y<=4?'minecraft:netherrack':y<=31?(ocean?'minecraft:lava':'minecraft:basalt'):'minecraft:air',location:{x,y,z}};},containsBlock(volume){queries++;return !!obstruction&&volume.from.x<=obstruction.x&&volume.to.x>=obstruction.x&&volume.from.y<=obstruction.y&&volume.to.y>=obstruction.y&&volume.from.z<=obstruction.z&&volume.to.z>=obstruction.z;},fillBlocks(volume,type){fills.push({volume,type});}};
 return {dimension,loads,placed,fills,get reads(){return reads;},get queries(){return queries;},obstruct:p=>obstruction=p};
}
test('region choices and biome preferences are deterministic with agreed selection distributions',()=>{
 assert.equal(GIANT_REGION,1600);let large=0,dragon=0,mega=0,basalt=0;
 for(let x=0;x<10000;x++){
  const c=candidateAt('giant',x,-2,123);assert.deepEqual(c,candidateAt('giant',x,-2,123));assert(c.x>=x*1600+250&&c.x<x*1600+1350);
  if(c.id==='large_arena')large++;else if(c.id==='dragon_arena')dragon++;else mega++;
  if(candidateAt('small',x,-2,123).biome==='basalt_deltas')basalt++;
 }
 assert(Math.abs(large/10000-1/3)<.03);assert(Math.abs(dragon/10000-1/3)<.03);assert(Math.abs(mega/10000-1/3)<.03);assert.equal(basalt,10000);
 assert(biomeAllows({id:'small_arena',biome:'basalt_deltas'},biomeName('minecraft:basalt_deltas')));
 assert(!biomeAllows({id:'small_arena',biome:'basalt_deltas'},'nether_wastes'));
 assert(biomeAllows({id:'grave_yard'},'soulsand_valley'));assert(!biomeAllows({id:'grave_yard'},'crimson_forest'));
});
test('spacing is measured between giants, arenas and actual village edges',()=>{
 const c={key:'new',id:'mega_fortress',family:'giant',x:0,z:0},box={x:-122,z:-124,sx:245,sz:248};
 assert(!spacingAllows(c,box,[{key:'old',id:'large_arena',x:1499,z:0,box:{x:1468,z:0,sx:62,sz:99}}],[]));
 assert(spacingAllows(c,box,[{key:'old',id:'large_arena',x:1500,z:0,box:{x:1469,z:0,sx:62,sz:99}}],[]));
 assert(!spacingAllows(c,box,[],[{x:171,z:0,sx:50,sz:50}]));assert(spacingAllows(c,box,[],[{x:172,z:0,sx:50,sz:50}]));
 assert.equal(boxGap({x:0,z:0,sx:10,sz:10},{x:20,z:0,sx:10,sz:10}),11);
 assert(!playersClear([{location:{x:0,z:0}}],box));
});
for(const id of Object.keys(ARENAS))test(`${id} surveys valid terrain and clears all leases`,()=>{
 const ocean=['large_arena','dragon_arena','mega_fortress'].includes(id),f=fixture(ocean,id==='grave_yard'?'minecraft:soulsand_valley':'minecraft:basalt_deltas');
 const c={id,x:0,z:0,biome:'basalt_deltas'},plan=finish(surveyLandmark(c,f.dimension));
 assert.equal(plan.outcome,'ready');assert(plan.supports.length===ARENAS[id].sections.length);assert(f.queries>0);assert(f.loads.at(-1).startsWith('tickingarea remove'));
 if(ocean){assert.equal(plan.origin.y,id==='mega_fortress'?30:33);assert(plan.supports.flat().length>0);}
});
test('protected blocks, insufficient oceans and unloaded reads cause no placement',()=>{
 const c={id:'large_arena',x:0,z:0},f=fixture();f.obstruct({x:0,y:50,z:0});assert.equal(finish(surveyLandmark(c,f.dimension)).outcome,'unsuitable');assert.equal(f.fills.length,0);
 const dry=fixture(false);assert.equal(finish(surveyLandmark(c,dry.dimension)).outcome,'unsuitable');
 const missing=fixture();missing.dimension.getBlock=()=>undefined;assert.throws(()=>finish(surveyLandmark(c,missing.dimension)));assert(missing.loads.at(-1).startsWith('tickingarea remove'));
});
test('natural placement saves completion, supports actual foundations and cannot repeat its candidate',()=>{
 const f=fixture(),old=world.structureManager;world.structureManager={place:(id,dim,pos)=>f.placed.push({id,pos})};
 const c={...candidateAt('giant',100,100,124),id:'large_arena',selectionRoll:.1};
 try{
  finish(generateLandmark(c,f.dimension),1500000);const record=JSON.parse(world.getDynamicProperty(c.key));assert.equal(record.state,'built');assert.equal(record.next,NATURAL_ARENAS.large_arena.sections.length);assert(f.fills.length>0);
  assert.equal(f.placed.length,NATURAL_ARENAS.large_arena.sections.length);
  const nearby=[{dimension:f.dimension,location:{x:c.x+500,y:64,z:c.z}}];assert(!naturalCandidates(nearby,124).some(x=>x.key===c.key));
 }finally{world.structureManager=old;world.setDynamicProperty(c.key,undefined);}
});
test('fully surveyed failures are permanently excluded while unavailable biomes defer',()=>{
 const bad={...candidateAt('small',120,120,111),id:'small_arena',biome:'basalt_deltas'},f=fixture(false,'minecraft:crimson_forest');
 finish(generateLandmark(bad,f.dimension));assert.equal(world.getDynamicProperty(bad.key),undefined);
 const c={...candidateAt('small',121,121,111),id:'small_arena',biome:'basalt_deltas'};f.dimension.getBiome=()=>undefined;finish(generateLandmark(c,f.dimension));assert.equal(world.getDynamicProperty(c.key),undefined);
 world.setDynamicProperty(bad.key,undefined);
});
test('shared generation worker serializes jobs and releases ownership after failures',()=>{
 const before=timeouts.length,trace=[];
 runGenerationJob((function*(){trace.push('first-start');yield;trace.push('first-end');})());
 runGenerationJob((function*(){trace.push('second');})());assert(generationBusy());
 for(let i=before;i<timeouts.length;i++)timeouts[i].callback();assert.deepEqual(trace,['first-start','first-end','second']);assert(!generationBusy());
});
test('interrupted natural builds resume at the next tile without duplicating completed tiles',()=>{
 const c={...candidateAt('giant',150,150,222),id:'large_arena',selectionRoll:.1},f=fixture(),old=world.structureManager;
 world.structureManager={place:id=>f.placed.push(id)};
 try{
  const job=generateLandmark(c,f.dimension);
  for(let i=0;i<20000;i++){job.next();system.currentTick++;const saved=world.getDynamicProperty(c.key);if(saved&&JSON.parse(saved).next===1)break;if(i===19999)assert.fail('First tile not placed');}
  job.return();const saved=JSON.parse(world.getDynamicProperty(c.key));assert.equal(saved.state,'placing');assert.equal(saved.next,1);
  finish(generateLandmark({...c,saved},f.dimension),1500000);assert.equal(JSON.parse(world.getDynamicProperty(c.key)).state,'built');
  assert.equal(f.placed.length,NATURAL_ARENAS.large_arena.sections.length);assert.equal(new Set(f.placed).size,f.placed.length);
 }finally{world.structureManager=old;world.setDynamicProperty(c.key,undefined);}
});
test('cancelling a queued worker before its first tick releases the shared queue',()=>{
 const cancel=runGenerationJob((function*(){assert.fail('Cancelled job ran');})());cancel();assert(!generationBusy());
});
