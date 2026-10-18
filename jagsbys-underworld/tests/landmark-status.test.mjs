import test from 'node:test';
import assert from 'node:assert/strict';
import {system} from './mock-server.mjs';
import '../behavior_pack/scripts/landmarks.js';
import {chunkLease} from '../behavior_pack/scripts/chunk_loading.js';
const status=()=>{const messages=[];system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:structures_status',sourceEntity:{typeId:'minecraft:player',sendMessage:m=>messages.push(m)}});return messages[0];};
test('status distinguishes inactive last stage and reports its age without a polling job',()=>{
 const before=status();assert.match(before,/No landmark job active/);
 system.currentTick+=140;
 assert.match(status(),/updated 7s ago/);
});
test('status reports a pending chunk load and elapsed time instead of only the previous stage',()=>{
 const lease=chunkLease({id:'minecraft:nether',getBlock:()=>undefined,runCommand(){}},'survey');
 const job=lease.load({x:128,y:0,z:-64},[64,128,64]);
 try{job.next();system.currentTick+=80;assert.match(status(),/Loading survey at 128, -64: command preload, 4s elapsed/);}
 finally{job.return();lease.release();}
 assert.match(status(),/No landmark job active/);
});
