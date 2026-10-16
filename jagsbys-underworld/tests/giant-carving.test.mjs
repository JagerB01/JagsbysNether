import test from 'node:test';
import assert from 'node:assert/strict';
import {surveyLandmark,carveTile,CARVABLE,supportFor,lavaFootprint,footprintBudget,dragonFootprintBudget} from '../behavior_pack/scripts/landmark_terrain.js';
import {spacingAllows,villageLandmarkClear} from '../behavior_pack/scripts/landmark_sites.js';
import {GiantSearch} from '../behavior_pack/scripts/giant_search.js';
function finish(job){for(let i=0;i<1500000;i++){const s=job.next();if(s.done)return s.value;}assert.fail('Survey stalled');}
function scene({islands=true,protectedBlock=false,ceiling=true}={}){
 const fills=[];
 const d={id:'minecraft:nether',runCommand(){},getBiome:()=>({id:'minecraft:hell'}),getBlock({x,y,z}){
  const island=islands&&x>20&&x<70;
  const type=y<=4?'minecraft:netherrack':y<=31?(island?'minecraft:basalt':'minecraft:lava'):ceiling&&y>=60&&y<=90?'minecraft:netherrack':'minecraft:air';
  return {typeId:type,isAir:type==='minecraft:air',location:{x,y,z}};
 },containsBlock(volume,filter){
  if(protectedBlock&&volume.from.x<=0&&volume.to.x>=0&&volume.from.y<=50&&volume.to.y>=50&&volume.from.z<=0&&volume.to.z>=0)return true;
  const types=filter.includeTypes;
  const intersectsIsland=islands&&volume.from.x<70&&volume.to.x>20&&volume.from.y<=31&&volume.to.y>=5;
  const intersectsCeiling=ceiling&&volume.to.y>=60&&volume.from.y<=90;
  return types?((intersectsIsland&&types.includes('minecraft:basalt'))||(intersectsCeiling&&types.includes('minecraft:netherrack'))):((intersectsIsland&&!filter.excludeTypes.includes('minecraft:basalt'))||(intersectsCeiling&&!filter.excludeTypes.includes('minecraft:netherrack')));
 },fillBlocks(volume,type,options){fills.push({volume,type,options});}};
 d.getBlocks=(v,filter)=>({*getBlockLocationIterator(){
  for(let x=v.from.x;x<=v.to.x;x++)for(let y=v.from.y;y<=v.to.y;y++)for(let z=v.from.z;z<=v.to.z;z++){
   const p={x,y,z},type=d.getBlock(p).typeId;
   if(filter.excludeTypes?!filter.excludeTypes.includes(type):filter.includeTypes.includes(type))yield p;
  }
 }});
 return {d,fills};
}
test('giants reject excessive islands but accept lava sites with natural terrain above',()=>{
 for(const id of ['large_arena','dragon_arena','mega_fortress']){
  assert.equal(finish(surveyLandmark({id,x:0,z:0},scene().d)).outcome,'unsuitable');
  const f=scene({islands:false,ceiling:false}),plan=finish(surveyLandmark({id,x:0,z:0},f.d));
  assert.equal(plan.outcome,'ready');assert.equal(plan.carve,true);assert(plan.solidFoundation);assert.equal(plan.coverage,1);assert.equal(f.fills.length,0);
 }
});
test('90 percent is exact across the complete horizontal footprint, not per section or height',()=>{
 for(const missing of [10,11]){
  const f=scene({islands:false,ceiling:true});
  f.d.getBlock=({x,y,z})=>({typeId:y===31&&x<missing?'minecraft:basalt':y===31?'minecraft:lava':'minecraft:netherrack'});
  f.d.containsBlock=v=>v.from.x<missing;
  const budget=footprintBudget([100,99,1]);
  assert.equal(finish(lavaFootprint(f.d,{x:0,y:0,z:0},[100,99,1],31,budget)),missing===10);
 }
 const f=scene({islands:false,ceiling:true}),budget=footprintBudget([100,99,1]);
 f.d.getBlock=({x,y})=>({typeId:y===31&&x<10?'minecraft:basalt':'minecraft:lava'});f.d.containsBlock=v=>v.from.x<10;
 assert(finish(lavaFootprint(f.d,{x:0,y:0,z:0},[10,99,1],31,budget)),'A dry edge section can use the shared whole-footprint allowance');
 assert(finish(lavaFootprint(f.d,{x:10,y:0,z:0},[90,99,1],31,budget)));
 assert.equal(budget.missing,10);
 for(const id of ['large_arena','dragon_arena'])assert.equal(finish(surveyLandmark({id,x:0,z:0},scene({islands:false,ceiling:true}).d)).outcome,'ready');
});
test('Dragon coverage follows its authored irregular base and ignores rectangular empty corners',()=>{
 const origin={x:-64,y:33,z:-60},budget=dragonFootprintBudget(origin);
 assert(budget.area<129*120);
 const {shape}=budget;
 const d={containsBlock:()=>true,getBlocks:v=>({*getBlockLocationIterator(){
  for(let x=v.from.x;x<=v.to.x;x++)for(let z=v.from.z;z<=v.to.z;z++)
   if(!shape.columns.has((x-origin.x)*shape.stride+z-origin.z))yield {x,y:31,z};
 }})};
 assert(finish(lavaFootprint(d,origin,[129,45,120],31,budget)));
 assert.equal(budget.missing,0,'Land in empty bounding-box corners must not count against coverage');
 let count=0;
 d.getBlocks=v=>({*getBlockLocationIterator(){
  for(let x=v.from.x;x<=v.to.x;x++)for(let z=v.from.z;z<=v.to.z;z++)
   if(shape.columns.has((x-origin.x)*shape.stride+z-origin.z)&&count++<=budget.maxMissing)yield {x,y:31,z};
 }});
 assert.equal(finish(lavaFootprint(d,origin,[129,45,120],31,budget)),false,'Over 10 percent of the actual base is rejected');
});
test('protected blocks still prevent carving; completely dry terrain is not an ocean site',()=>{
 assert.equal(finish(surveyLandmark({id:'mega_fortress',x:0,z:0},scene({protectedBlock:true}).d)).outcome,'unsuitable');
 const f=scene();f.d.getBlock=({y})=>({typeId:y<=31?'minecraft:netherrack':'minecraft:air'});assert.equal(finish(surveyLandmark({id:'large_arena',x:0,z:0},f.d)).outcome,'unsuitable');
});
test('native carving is filtered to ordinary terrain and never includes bedrock, containers or portal blocks',()=>{
 const f=scene();carveTile(f.d,{x:0,y:30,z:0},[16,56,16]);assert.equal(f.fills.length,1);assert.equal(f.fills[0].type,'minecraft:air');assert.deepEqual(f.fills[0].options.blockFilter.includeTypes,CARVABLE);
 for(const id of ['minecraft:bedrock','minecraft:chest','minecraft:obsidian','minecraft:portal','minecraft:lava'])assert(!CARVABLE.includes(id));
});
test('carving removes source and flowing lava above the ocean only within the placement volume',()=>{
 const cells=new Map();const key=p=>`${p.x},${p.y},${p.z}`;
 for(const [p,id] of [[{x:1,y:35,z:1},'lava'],[{x:1,y:36,z:1},'flowing_lava'],[{x:1,y:31,z:1},'lava'],[{x:3,y:35,z:1},'lava'],[{x:1,y:34,z:1},'chest']])cells.set(key(p),`minecraft:${id}`);
 const fills=[];const d={fillBlocks(v,type,{blockFilter}){fills.push(v);for(let x=v.from.x;x<=v.to.x;x++)for(let y=v.from.y;y<=v.to.y;y++)for(let z=v.from.z;z<=v.to.z;z++){const k=key({x,y,z});if(blockFilter.includeTypes.includes(cells.get(k)))cells.set(k,type);}}};
 carveTile(d,{x:0,y:30,z:0},[3,10,3],31);
 assert.equal(cells.get('1,35,1'),'minecraft:air');assert.equal(cells.get('1,36,1'),'minecraft:air');
 assert.equal(cells.get('1,31,1'),'minecraft:lava');assert.equal(cells.get('3,35,1'),'minecraft:lava');assert.equal(cells.get('1,34,1'),'minecraft:chest');
 assert.equal(fills.length,2);assert.equal(fills[1].from.y,32);
 const f=scene();carveTile(f.d,{x:0,y:33,z:0},[16,45,16],31);
 assert.equal(f.fills.length,1,'Fully above-surface tiles clear terrain and lava in one filtered write');
 assert(f.fills[0].options.blockFilter.includeTypes.includes('minecraft:lava'));
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
test('carving stays staged, and interrupted foundations resume without replacing the tile',async()=>{
 const {world}=await import('./mock-server.mjs');const {generateLandmark}=await import('../behavior_pack/scripts/landmarks.js');const {candidateAt}=await import('../behavior_pack/scripts/landmark_sites.js');
 const c={...candidateAt('giant',940,940,123),id:'large_arena',selected:true,selectionRoll:.1},f=scene({islands:false,ceiling:false}),events=[],old=world.structureManager;
 f.d.fillBlocks=(volume,type)=>events.push(type==='minecraft:air'?'carve':'support');world.structureManager={place:id=>events.push(`place:${id}`)};
 try{
  const job=generateLandmark(c,f.d);let saved;
  for(let i=0;i<50000;i++){job.next();saved=JSON.parse(world.getDynamicProperty(c.key)??'null');if(saved?.tilePlaced)break;if(i===49999)assert.fail('No placed tile checkpoint');}
  for(let i=0;i<1000&&!events.includes('support');i++)job.next();
  assert(saved.tilePlaced,'A supported tile must remain checkpointed while its foundation is unfinished');
  assert(events.includes('carve'));assert.deepEqual(events.slice(0,3).map(e=>e.startsWith('place:')?'place':e),['carve','place','support']);
  job.return();const first=events.filter(e=>e.startsWith('place:')).at(-1);finish(generateLandmark({...c,saved},f.d));
  assert.equal(events.filter(e=>e===first).length,1);assert.equal(JSON.parse(world.getDynamicProperty(c.key)).state,'built');
 }finally{world.structureManager=old;world.setDynamicProperty(c.key,undefined);}
});
