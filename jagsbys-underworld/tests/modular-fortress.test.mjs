import test from 'node:test';
import {system} from './mock-server.mjs';
import assert from 'node:assert/strict';
import {FORTRESS_MODULES} from '../behavior_pack/scripts/modular_fortress_catalog.js';
import {surveyModularFortress,modularSections} from '../behavior_pack/scripts/modular_fortress.js';
function finish(job){for(let i=0;i<200000;i++){const r=job.next();system.currentTick++;if(r.done)return r.value;}assert.fail('Modular survey stalled');}
function scene(obstruction){return {id:'minecraft:nether',runCommand(){},getBlock:({x,y,z})=>({typeId:y<=4?'minecraft:netherrack':x===0&&z===0&&y<=31?'minecraft:lava':y>31&&x===0&&z===0?'minecraft:air':'minecraft:netherrack'}),containsBlock:v=>!!obstruction&&v.from.x<=obstruction.x&&v.to.x>=obstruction.x&&v.from.y<=obstruction.y&&v.to.y>=obstruction.y&&v.from.z<=obstruction.z&&v.to.z>=obstruction.z};}
test('required fortress core includes centre and roof and optional modules remain connected',()=>{
 assert.deepEqual(FORTRESS_MODULES[0].size,[43,56,43]);assert.equal(FORTRESS_MODULES[0].source.length,2);
 for(const m of FORTRESS_MODULES.slice(1)){assert(m.parent<m.index);assert(m.sections.every(s=>s.size[0]<=16&&s.size[2]<=16));}
});
test('only the core needs to fit; blocked branches and their descendants are omitted',()=>{
 const p=finish(surveyModularFortress({x:0,z:0},scene({x:-30,y:60,z:0})));assert.equal(p.outcome,'ready');assert(p.modular);assert(p.modules.includes(0));assert(!p.modules.includes(1));assert(p.modules.length>1);assert(p.skippedModules.includes(1));
 for(const i of p.modules)if(i!==0)assert(p.modules.includes(FORTRESS_MODULES[i].parent));assert.equal(p.sections.length,modularSections(p.modules).length);
});
test('a protected block in the required core rejects the site',()=>{
 const p=finish(surveyModularFortress({x:0,z:0},scene({x:0,y:60,z:0})));assert.equal(p.outcome,'unsuitable');assert.match(p.reason,/core/);
});
test('incomplete modular surveys defer instead of recording a failed site',()=>{
 const d=scene();d.getBlock=()=>undefined;const p=finish(surveyModularFortress({x:0,z:0},d));assert.equal(p.outcome,'deferred');
});

test('core-only initiation reserves no distant module footprints',()=>{
 const p=finish(surveyModularFortress({x:0,z:0},scene(),{coreOnly:true}));assert.equal(p.outcome,'ready');assert.deepEqual(p.modules,[0]);assert.deepEqual(p.box,{x:-21,z:-21,sx:43,sz:43});
});
test('a player near a future branch does not prevent core placement',async()=>{
 const {world}=await import('./mock-server.mjs'),{generateLandmark}=await import('../behavior_pack/scripts/landmarks.js'),{candidateAt}=await import('../behavior_pack/scripts/landmark_sites.js');
 const c={...candidateAt('giant',903,903,12),id:'mega_fortress',selected:true},oldPlayers=world.getPlayers,oldStructures=world.structureManager,placed=[];
 const d={id:'minecraft:nether',runCommand(){},getBlock:({y})=>({typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air'}),containsBlock:()=>false,fillBlocks(){}};
 world.getPlayers=()=>[{dimension:d,location:{x:c.x+65,y:64,z:c.z}}];world.structureManager={place:id=>placed.push(id)};
 const job=generateLandmark(c,d);
 try{
  for(let i=0;i<20000&&!placed.length;i++){job.next();system.currentTick++;}
  assert.equal(placed.length,1);const saved=JSON.parse(world.getDynamicProperty(c.key));assert.deepEqual(saved.modules,[0]);assert.equal(saved.box.sx,43);assert.equal(saved.box.sz,43);assert(saved.incremental);
 }finally{job.return();world.getPlayers=oldPlayers;world.structureManager=oldStructures;world.setDynamicProperty(c.key,undefined);}
});
test('blocked required lower chambers pause without pruning, then resume after the obstruction is removed',async()=>{
 const {world}=await import('./mock-server.mjs'),{generateLandmark}=await import('../behavior_pack/scripts/landmarks.js'),{candidateAt}=await import('../behavior_pack/scripts/landmark_sites.js');
 const c={...candidateAt('giant',923,923,12),id:'mega_fortress',selected:true},old=world.structureManager;let blocked=true;
 const d={id:'minecraft:nether',runCommand(){},getBlock:({y})=>({typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air'}),containsBlock:v=>blocked&&v.from.x<=c.x-30&&v.to.x>=c.x-30&&v.from.z<=c.z&&v.to.z>=c.z&&v.from.y<=60&&v.to.y>=60,fillBlocks(){}};
 world.structureManager={place(){}};
 function run(job){for(let i=0;i<1500000;i++){const r=job.next();system.currentTick++;if(r.done)return;}assert.fail('Build stalled');}
 try{
  run(generateLandmark(c,d));let saved=JSON.parse(world.getDynamicProperty(c.key));assert.equal(saved.state,'placing');assert.equal(saved.expansionNext,1);assert.deepEqual(saved.modules,[0]);
  blocked=false;run(generateLandmark({...c,saved},d));saved=JSON.parse(world.getDynamicProperty(c.key));assert.equal(saved.state,'built');for(const index of [0,1,2,3,4])assert(saved.modules.includes(index));
 }finally{world.structureManager=old;world.setDynamicProperty(c.key,undefined);}
});

test('foundations extend authored pier feet while leaving bridge decks and upper pieces unsupported',()=>{
 const bridge=FORTRESS_MODULES.find(m=>m.source.some(s=>s.endsWith('/roofless_single_straight_5')));
 const feet=bridge.sections.flatMap(s=>s.foundationColumns.map(([x,z,y])=>[s.offset[0]-bridge.offset[0]+x,s.offset[2]-bridge.offset[2]+z,s.offset[1]-bridge.offset[1]+y]));
 assert(feet.some(([x,z,y])=>x===6&&z===3&&y===0),'Authored central pier foot needs its foundation');
 assert(!feet.some(([x,z])=>x===0&&z===3),'Raised bridge deck must remain open underneath');
 assert(feet.length>0&&feet.length<16*7);
 for(const m of FORTRESS_MODULES){
  for(const s of m.sections)for(const [x,z,y] of s.foundationColumns){
   assert(s.offset[1]-m.offset[1]+y<=1,'Only authored base layers can initiate foundations');
   assert(x>=0&&x<s.size[0]&&z>=0&&z<s.size[2]);
  }
  if(m.source.some(src=>src.includes('/ends/')||src.includes('staircase_upper')||src.includes('staircase_side')))
   assert(m.sections.every(s=>s.foundationColumns.length===0),'Elevated stairs/end caps must not acquire foundations');
 }
 assert(FORTRESS_MODULES[0].sections.some(s=>s.foundationColumns.length>0));
});

test('optional modules allow small trims, end moderate-carve branches and reject mountains with bounded counting',async()=>{
 const {surveyFortressModule}=await import('../behavior_pack/scripts/modular_fortress.js');
 for(const [amount,outcome,stop] of [[0,'ready',false],[20,'ready',false],[200,'ready',true],[10000,'unsuitable',undefined]]){
  let counted=0;const d={id:'minecraft:nether',runCommand(){},getBlock:()=>({typeId:'minecraft:air'}),containsBlock:(volume,filter)=>!!filter.includeTypes&&amount>0,
   getBlocks:()=>({*getBlockLocationIterator(){for(let i=0;i<amount;i++){counted++;yield {x:i,y:64,z:0};}}})};
  const result=finish(surveyFortressModule({x:0,z:0},d,{origin:{x:0,y:30,z:0},surface:31},5));
  assert.equal(result.outcome,outcome);assert.equal(result.stopExpansion,stop);
  assert(counted<=225,'Over-budget mountain counting must stop early');
  if(outcome==='unsuitable')assert.match(result.reason,/Excessive carving/);
 }
 const d={id:'minecraft:nether',runCommand(){},getBlock:()=>({typeId:'minecraft:air'}),containsBlock:(volume,filter)=>!!filter.includeTypes,getBlocks(){throw Error('Unloaded terrain');}};
 assert.equal(finish(surveyFortressModule({x:0,z:0},d,{origin:{x:0,y:30,z:0},surface:31},5)).outcome,'deferred');
 assert.equal(finish(surveyFortressModule({x:0,z:0},d,{origin:{x:0,y:30,z:0},surface:31},1)).outcome,'ready','Required lower chambers retain carving permission');
});
test('carving branch stops survive interrupted builds while other directions continue expanding',async()=>{
 const {world}=await import('./mock-server.mjs'),{generateLandmark}=await import('../behavior_pack/scripts/landmarks.js'),{candidateAt}=await import('../behavior_pack/scripts/landmark_sites.js');
 const c={...candidateAt('giant',943,943,12),id:'mega_fortress',selected:true},old=world.structureManager;
 const m=FORTRESS_MODULES[5],s=m.sections[0],tx=c.x+s.offset[0],tz=c.z+s.offset[2];
 const d={id:'minecraft:nether',runCommand(){},getBlock:({y})=>({typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air'}),
  containsBlock:(v,filter)=>!!filter.includeTypes&&v.from.x===tx&&v.from.z===tz,
  getBlocks:()=>({*getBlockLocationIterator(){for(let i=0;i<200;i++)yield {x:tx,y:60,z:tz};}}),fillBlocks(){}};
 world.structureManager={place(){}};let job=generateLandmark(c,d);
 try{
  let saved;
  for(let i=0;i<1500000;i++){const r=job.next();system.currentTick++;const value=world.getDynamicProperty(c.key);if(value){saved=JSON.parse(value);if(saved.carvingStops?.includes(5))break;}if(r.done)assert.fail('Branch stop not saved');}
  assert(saved.carvingStops.includes(5));job.return();
  job=generateLandmark({...c,saved},d);finish(job);
  saved=JSON.parse(world.getDynamicProperty(c.key));assert.equal(saved.state,'built');assert(saved.modules.includes(5));
  assert(!saved.modules.includes(13),'Child beyond moderate carving must be pruned');
  assert(saved.modules.includes(14),'An independent open branch should keep expanding');
  assert(saved.carvingStops.includes(5));
 }finally{job.return();world.structureManager=old;world.setDynamicProperty(c.key,undefined);}
});

test('the keep requires its entire lava footprint and clear volume while retaining module expansion',()=>{
 for(const obstacle of [{x:20,y:31,z:0,type:'minecraft:basalt'},{x:0,y:45,z:0,type:'minecraft:netherrack'}]){
  const d={id:'minecraft:nether',runCommand(){},getBlock:({y})=>({typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air'}),
   containsBlock:(v,filter)=>v.from.x<=obstacle.x&&v.to.x>=obstacle.x&&v.from.y<=obstacle.y&&v.to.y>=obstacle.y&&v.from.z<=obstacle.z&&v.to.z>=obstacle.z&&!filter.excludeTypes.includes(obstacle.type)};
  assert.equal(finish(surveyModularFortress({x:0,z:0},d,{coreOnly:true})).outcome,'unsuitable');
 }
 const d={id:'minecraft:nether',runCommand(){},getBlock:({y})=>({typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air'}),containsBlock:()=>false};
 const p=finish(surveyModularFortress({x:0,z:0},d,{coreOnly:true}));assert.equal(p.outcome,'ready');assert(p.coreNoCarve);assert(p.solidFoundation);assert(p.carve,'Expansion modules retain their bounded carving policy');assert.deepEqual(p.modules,[0]);assert.equal(p.box.sx,43);
});
test('keep tiles never carve but later fortress modules retain their carving stage',async()=>{
 const {world}=await import('./mock-server.mjs'),{generateLandmark}=await import('../behavior_pack/scripts/landmarks.js'),{candidateAt}=await import('../behavior_pack/scripts/landmark_sites.js');
 const c={...candidateAt('giant',963,963,12),id:'mega_fortress',selected:true},old=world.structureManager,events=[];
 const d={id:'minecraft:nether',runCommand(){},getBlock:({y})=>({typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air'}),containsBlock:()=>false,fillBlocks(v,type){if(type==='minecraft:air')events.push('carve');}};
 world.structureManager={place(id){events.push(id);}};const job=generateLandmark(c,d);
 try{
  for(let i=0;i<200000;i++){job.next();system.currentTick++;if(events.some(e=>e.includes('module_1/')))break;if(i===199999)assert.fail('Expansion never started');}
  const core=events.filter(e=>e.includes('module_0/'));assert.equal(core.length,FORTRESS_MODULES[0].sections.length);
  const firstCarve=events.indexOf('carve');assert(firstCarve>events.findLastIndex(e=>e.includes('module_0/')));
 }finally{job.return();world.structureManager=old;world.setDynamicProperty(c.key,undefined);}
});
