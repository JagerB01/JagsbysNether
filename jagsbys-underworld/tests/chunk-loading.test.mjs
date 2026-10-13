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
