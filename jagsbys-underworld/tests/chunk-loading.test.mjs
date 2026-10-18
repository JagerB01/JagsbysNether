import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system} from './mock-server.mjs';
import {chunkLease} from '../behavior_pack/scripts/chunk_loading.js';
async function finish(job,before=()=>{}){for(let i=0;i<700;i++){before(i);const next=job.next();await Promise.resolve();if(next.done)return;system.currentTick++;}throw Error('Job did not finish');}
test('command loader requests preload and waits beyond two ticks for real chunk readiness',async()=>{
 const start=system.currentTick,calls=[];
 const dim={id:'minecraft:nether',runCommand:c=>calls.push(c),getBlock:()=>system.currentTick-start>=12?{}:undefined};
 const lease=chunkLease(dim);try{await finish(lease.load({x:-71,y:154,z:213},[64,56,64]));}finally{lease.release();}
 assert(system.currentTick-start>=12);assert(calls[0].endsWith(' true'));assert(calls.at(-1).startsWith('tickingarea remove '));
});
test('native loader waits for the API load promise and cleans up its own area',async()=>{
 const old=world.tickingAreaManager,areas=new Set();let resolve,created=0;
 world.tickingAreaManager={hasCapacity:()=>true,createTickingArea(id){created++;areas.add(id);return new Promise(r=>{resolve=r;});},hasTickingArea:id=>areas.has(id),removeTickingArea:id=>areas.delete(id)};
 const dim={getBlock:()=>({}),runCommand(){throw Error('Native loader must not use commands');}},lease=chunkLease(dim);
 try{await finish(lease.load({x:0,y:32,z:0},[64,56,64]),i=>{if(i===8)resolve();});assert.equal(created,1);assert.equal(areas.size,1);}finally{lease.release();world.tickingAreaManager=old;}
 assert.equal(areas.size,0);
});
test('unloaded terrain times out before placement and is cleaned up',async()=>{
 const calls=[],lease=chunkLease({id:'minecraft:nether',getBlock:()=>undefined,runCommand:c=>calls.push(c)});
 try{await assert.rejects(()=>finish(lease.load({x:0,y:32,z:0},[16,16,16],8)),/timed out/);}finally{lease.release();}
 assert(calls.at(-1).startsWith('tickingarea remove '));
});
test('native completion is authoritative even when the secondary chunk flag disagrees',async()=>{
 const old=world.tickingAreaManager,areas=new Set();let probes=0;
 world.tickingAreaManager={hasCapacity:()=>true,createTickingArea(id){areas.add(id);return Promise.resolve();},hasTickingArea:id=>areas.has(id),removeTickingArea:id=>areas.delete(id)};
 const lease=chunkLease({id:'minecraft:nether',isChunkLoaded(){probes++;return false;},getBlock:()=>undefined,runCommand(){assert.fail('Successful API load must not fall back');}});
 try{await finish(lease.load({x:32,y:0,z:64},[64,128,64]));assert.equal(probes,0);}finally{lease.release();world.tickingAreaManager=old;}
 assert.equal(areas.size,0);
});
test('stalled native request falls back once, reports live loading, and cleans up a late promise',async()=>{
 const {chunkLoadingStatus}=await import('../behavior_pack/scripts/chunk_loading.js');
 const old=world.tickingAreaManager,areas=new Set(),calls=[];let resolve,preloaded=false;
 world.tickingAreaManager={hasCapacity:()=>true,createTickingArea(id){areas.add(id);return new Promise(r=>{resolve=r;});},hasTickingArea:id=>areas.has(id),removeTickingArea:id=>areas.delete(id)};
 const lease=chunkLease({id:'minecraft:nether',getBlock:()=>preloaded?{}:undefined,runCommand(c){calls.push(c);if(c.startsWith('tickingarea add'))preloaded=true;}},'survey');
 try{
  await finish(lease.load({x:-71,y:0,z:213},[64,128,64]),i=>{if(i===2)assert.match(chunkLoadingStatus(),/Loading survey at -71, 213: native/);});
  assert.equal(calls.filter(c=>c.startsWith('tickingarea add')).length,1);
  assert.equal(areas.size,0);assert.equal(chunkLoadingStatus(),'');
  resolve();await Promise.resolve();assert.equal(areas.size,0);
 }finally{lease.release();world.tickingAreaManager=old;}
 assert(calls.at(-1).startsWith('tickingarea remove'));
});
test('native rejection uses command preload instead of discarding the site',async()=>{
 const old=world.tickingAreaManager,areas=new Set();let forced=false;
 world.tickingAreaManager={hasCapacity:()=>true,createTickingArea(id){areas.add(id);return Promise.reject(Error('Native request failed'));},hasTickingArea:id=>areas.has(id),removeTickingArea:id=>areas.delete(id)};
 const lease=chunkLease({id:'minecraft:nether',getBlock:()=>forced?{}:undefined,runCommand(c){if(c.startsWith('tickingarea add'))forced=true;}});
 try{await finish(lease.load({x:0,y:0,z:0},[16,128,16]));assert(forced);}finally{lease.release();world.tickingAreaManager=old;}
 assert.equal(areas.size,0);
});
test('synchronous native failure also falls back and command refusal fails immediately',async()=>{
 const old=world.tickingAreaManager;
 world.tickingAreaManager={hasCapacity:()=>true,createTickingArea(){throw Error('Native creation refused');},hasTickingArea:()=>false};
 const lease=chunkLease({id:'minecraft:nether',getBlock:()=>undefined,runCommand:()=>({successCount:0})},'survey');
 const start=system.currentTick;
 try{await assert.rejects(()=>finish(lease.load({x:20,y:0,z:40},[16,128,16])),/Chunk preload rejected for survey at 20, 40/);assert.equal(system.currentTick,start);}finally{lease.release();world.tickingAreaManager=old;}
});
test('wall-clock deadline prevents low tick rates stretching a load into minutes',async()=>{
 const old=world.tickingAreaManager,realNow=Date.now;let now=1000,commands=0;
 const areas=new Set();
 Date.now=()=>now;
 world.tickingAreaManager={hasCapacity:()=>true,createTickingArea(id){areas.add(id);return new Promise(()=>{});},hasTickingArea:id=>areas.has(id),removeTickingArea:id=>areas.delete(id)};
 const lease=chunkLease({id:'minecraft:nether',getBlock:()=>undefined,runCommand(){commands++;}},'survey');
 try{
  await assert.rejects(()=>finish(lease.load({x:0,y:0,z:0},[16,128,16]),i=>{if(i===1)now=7000;if(i===2)now=32000;}),/timed out/);
  assert.equal(commands,1,'one command fallback before timeout');
  assert.equal(areas.size,0);
 }finally{lease.release();world.tickingAreaManager=old;Date.now=realNow;}
});
