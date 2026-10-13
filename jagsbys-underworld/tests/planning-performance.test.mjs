import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,timeouts} from './mock-server.mjs';
import {runPlanningJob} from '../behavior_pack/scripts/planning_jobs.js';
import {planningCache} from '../behavior_pack/scripts/settlements/planning_cache.js';
import {RejectedSites} from '../behavior_pack/scripts/settlements/rejected_sites.js';
test('cooperative jobs cap work per tick and suspend tick waits without spinning',()=>{
 timeouts.length=0;let steps=0;
 const job=(function*(){for(let i=0;i<6;i++){steps++;yield;}yield {waitTicks:20};steps++;})();
 runPlanningJob(job,{steps:3,milliseconds:Infinity});
 const tick=()=>{system.currentTick++;const due=timeouts.filter(t=>t.due<=system.currentTick);for(const t of due){timeouts.splice(timeouts.indexOf(t),1);t.callback();}};
 tick();assert.equal(steps,3);tick();assert.equal(steps,6);tick();assert.equal(steps,6);
 for(let i=0;i<19;i++)tick();assert.equal(steps,6);tick();assert.equal(steps,7);
});
test('planning snapshots reduce native reads without caching unloaded terrain or exceeding their bound',()=>{
 let reads=0;const dimension={getBlock(p){reads++;return p.x===99?undefined:{typeId:'minecraft:netherrack',isAir:false,isLiquid:false};}};
 const cache=planningCache(dimension,2);
 assert.equal(cache.getBlock({x:0,y:64,z:0}).typeId,'minecraft:netherrack');cache.getBlock({x:0,y:64,z:0});assert.equal(reads,1);
 cache.getBlock({x:1,y:64,z:0});cache.getBlock({x:2,y:64,z:0});assert.equal(cache.stats.cached,2);
 cache.getBlock({x:99,y:64,z:0});assert(cache.missing);
});
test('unsuitable areas persist across reloads and are geometric footprints rather than rejected chunks',()=>{
 const data=new Map(),storage={getDynamicProperty:k=>data.get(k),getDynamicPropertyIds:()=>[...data.keys()],setDynamicProperty:(k,v)=>data.set(k,v)};
 const before=new RejectedSites(storage);before.reject({x:5,z:5,sx:145,sz:145},'Only two houses fit');
 const after=new RejectedSites(storage);
 assert(after.blocksPoint(6,6));assert(after.blocksPoint(149,149));assert(!after.blocksPoint(4,6));
 assert(after.blocksBox({x:149,z:100,sx:8,sz:8}));assert(!after.blocksBox({x:150,z:100,sx:8,sz:8}));
 assert.equal(data.size,1);
});
for(const theme of ['crimson','warped'])for(const seed of [2,123,7000])test(`${theme} ${seed}: caching preserves the complete layout and cuts native terrain reads`,async()=>{
 const {village}=await import('../.build/behavior_pack/scripts/settlements/main.js');
 function run(cache){
  let reads=0;const trace=[],old=world.structureManager;
  world.structureManager={place(id,dim,pos,options){trace.push(['place',id,pos,options]);}};
  const dimension={id:'minecraft:nether',getBiome:()=>({id:theme==='crimson'?'minecraft:crimson_forest':'minecraft:warped_forest'}),getBlock(p){
   reads++;return {typeId:p.y<=64?'minecraft:netherrack':'minecraft:air',isAir:p.y>64,isLiquid:false,location:p,setType(id){trace.push(['block',p,id]);},setPermutation(){}};
  },spawnEntity(id,p){trace.push(['entity',id,p]);return {id:'resident',triggerEvent(){}};}};
  try{for(const _ of village(dimension,0,0,65,theme,seed,()=>{},undefined,()=>{},{cache})){};}
  finally{world.structureManager=old;}
  return {reads,trace};
 }
 const baseline=run(false),optimized=run(true);assert.deepEqual(optimized.trace,baseline.trace);
 assert(optimized.reads<baseline.reads*.3,`${optimized.reads} versus ${baseline.reads} native reads`);
});
test('incomplete terrain is deferred while fully loaded unsuitable terrain is a durable assessment',async()=>{
 const {village}=await import('../.build/behavior_pack/scripts/settlements/main.js');
 for(const [missing,expected] of [[true,'deferred'],[false,'unsuitable']]){
  const dimension={id:'minecraft:nether',heightRange:{min:0,max:128},getBlock(){return missing?undefined:{typeId:'minecraft:air',isAir:true,isLiquid:false};}};
  const job=village(dimension,0,0,64,'crimson',123,()=>{},undefined,()=>{});
  let result;for(let i=0;i<10000;i++){const next=job.next();if(next.done){result=next.value;break;}}
  assert.equal(result?.outcome,expected);
 }
});
