import test from 'node:test';
import assert from 'node:assert/strict';
import {surveyLandmark,carveTile,CARVABLE,supportFor} from '../behavior_pack/scripts/landmark_terrain.js';
import {spacingAllows,villageLandmarkClear} from '../behavior_pack/scripts/landmark_sites.js';
import {GiantSearch} from '../behavior_pack/scripts/giant_search.js';
function finish(job){for(let i=0;i<50000;i++){const s=job.next();if(s.done)return s.value;}assert.fail('Survey stalled');}
function scene({islands=true,protectedBlock=false}={}){
 const fills=[];
 const d={id:'minecraft:nether',runCommand(){},getBiome:()=>({id:'minecraft:hell'}),getBlock({x,y,z}){
  const island=islands&&x>20&&x<70;
  const type=y<=4?'minecraft:netherrack':y<=31?(island?'minecraft:basalt':'minecraft:lava'):y>=60&&y<=90?'minecraft:netherrack':'minecraft:air';
  return {typeId:type,isAir:type==='minecraft:air',location:{x,y,z}};
 },containsBlock(volume,filter){
  if(protectedBlock&&volume.from.x<=0&&volume.to.x>=0&&volume.from.y<=50&&volume.to.y>=50&&volume.from.z<=0&&volume.to.z>=0)return true;
  return !filter.excludeTypes.includes('minecraft:netherrack')&&volume.to.y>=60;
 },fillBlocks(volume,type,options){fills.push({volume,type,options});}};
 return {d,fills};
}
test('giants accept partial islands and ordinary cavern terrain rather than requiring an empty box',()=>{
 for(const id of ['large_arena','dragon_arena','mega_fortress']){
  const f=scene(),plan=finish(surveyLandmark({id,x:0,z:0},f.d));assert.equal(plan.outcome,'ready');assert(plan.carve);assert(plan.coverage<1);assert.equal(f.fills.length,0,'Survey must not carve before complete size selection');
 }
});
test('protected blocks still prevent carving; completely dry terrain is not an ocean site',()=>{
 assert.equal(finish(surveyLandmark({id:'mega_fortress',x:0,z:0},scene({protectedBlock:true}).d)).outcome,'unsuitable');
 const f=scene();f.d.getBlock=({y})=>({typeId:y<=31?'minecraft:netherrack':'minecraft:air'});assert.equal(finish(surveyLandmark({id:'large_arena',x:0,z:0},f.d)).outcome,'unsuitable');
});
test('native carving is filtered to ordinary terrain and never includes bedrock, containers or portal blocks',()=>{
 const f=scene();carveTile(f.d,{x:0,y:30,z:0},[16,56,16]);assert.equal(f.fills.length,1);assert.equal(f.fills[0].type,'minecraft:air');assert.deepEqual(f.fills[0].options.blockFilter.includeTypes,CARVABLE);
 for(const id of ['minecraft:bedrock','minecraft:chest','minecraft:obsidian','minecraft:portal','minecraft:lava'])assert(!CARVABLE.includes(id));
});
test('supports reach ground below the carve plane instead of relying on an island that will be removed',()=>{
 const d={getBlock:({y})=>({typeId:y<=35?'minecraft:netherrack':'minecraft:air'})};
 const support=finish(supportFor(d,{x:0,y:30,z:0},[0,7,0],true));assert.deepEqual(support,{x:0,z:0,bottom:30,top:36});
});
test('giant spacing is 50 from village edges, 150 from small arena centers and 1500 from other giants',()=>{
 const c={key:'new',id:'mega_fortress',family:'giant',x:0,z:0},box={x:-122,z:-124,sx:245,sz:248};
 assert(spacingAllows(c,box,[],[{x:172,z:0,sx:20,sz:20}]));assert(!spacingAllows(c,box,[],[{x:171,z:0,sx:20,sz:20}]));
 // Use Large Arena geometry to avoid the independent 32-block footprint overlap rule.
 const large={...c,id:'large_arena'},b={x:-31,z:-49,sx:62,sz:99};
 assert(spacingAllows(large,b,[{key:'small',id:'small_arena',x:150,z:0,box:{x:122,z:-46,sx:56,sz:93}}],[]));
 assert(!spacingAllows(large,b,[{key:'small',id:'small_arena',x:149,z:0,box:{x:121,z:-46,sx:56,sz:93}}],[]));
 assert(!spacingAllows(large,b,[{key:'giant',id:'dragon_arena',x:1499,z:0,box:{x:1435,z:-60,sx:129,sz:120}}],[]));
});
test('older strict-policy failed cells reopen once; new-policy failures stay permanent after restart',()=>{
 const m=new Map(),store={getDynamicProperty:k=>m.get(k),setDynamicProperty:(k,v)=>m.set(k,v)},c={family:'giant',gx:0,gz:0,x:32,z:32,key:'underworld_landmarks:site_giant_0_0'};
 m.set('underworld_landmarks:search_0_0',JSON.stringify({version:1,failed:['0,0']}));const search=new GiantSearch(store);assert(!search.failed(c));search.reject(c,'Protected block');assert(new GiantSearch(store).failed(c));
});
test('carving precedes template placement, supports follow it, and interrupted supports resume without replacing the tile',async()=>{
 const {world}=await import('./mock-server.mjs');const {generateLandmark}=await import('../behavior_pack/scripts/landmarks.js');const {candidateAt}=await import('../behavior_pack/scripts/landmark_sites.js');
 const c={...candidateAt('giant',940,940,123),id:'large_arena',selectionRoll:.1},f=scene({islands:false}),events=[],old=world.structureManager;
 f.d.fillBlocks=(volume,type)=>events.push(type==='minecraft:air'?'carve':'support');world.structureManager={place:id=>events.push(`place:${id}`)};
 try{
  const job=generateLandmark(c,f.d);let saved;
  for(let i=0;i<50000;i++){job.next();saved=JSON.parse(world.getDynamicProperty(c.key)??'null');if(saved?.tilePlaced)break;if(i===49999)assert.fail('No placed tile checkpoint');}
  for(let i=0;i<1000&&!events.includes('support');i++)job.next();
  assert.equal(saved.next,0);assert.deepEqual(events.slice(0,3).map(e=>e.startsWith('place:')?'place':e),['carve','place','support']);
  job.return();const first=events.find(e=>e.startsWith('place:'));finish(generateLandmark({...c,saved},f.d));
  assert.equal(events.filter(e=>e===first).length,1);assert.equal(JSON.parse(world.getDynamicProperty(c.key)).state,'built');
 }finally{world.structureManager=old;world.setDynamicProperty(c.key,undefined);}
});
