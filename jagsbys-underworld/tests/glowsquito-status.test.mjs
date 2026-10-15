import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,startup} from './mock-server.mjs';
import '../.build/behavior_pack/scripts/glowsquito/main.js';
startup();
function invoke(ray){
 const messages=[];const player={typeId:'minecraft:player',sendMessage:m=>messages.push(m),getBlockFromViewDirection:ray};
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:glowhusk_status',sourceEntity:player});return messages;
}
test('status always acknowledges a command without a target, and reports raycast errors to the player',()=>{
 assert.match(invoke(()=>undefined)[0],/v0.2.108.*Command received/);
 const messages=invoke(()=>{throw Error('raycast unavailable');});assert.match(messages[0],/status failed.*raycast unavailable/);
});
test('status reports saved hive progress and occupancy without changing it',()=>{
 const block={typeId:'jagsby_nether:glowhusk',dimension:{id:'minecraft:nether'},location:{x:7,y:31,z:7},permutation:{getState:()=>3}};
 const key='underworld_glowhusk:minecraft:nether:7,31,7';const record=JSON.stringify({v:1,token:'status',occupants:['a','b']});world.setDynamicProperty(key,record);
 try{assert.match(invoke(()=>({block}))[0],/3\/5 wax, 2\/3 assigned/);assert.equal(world.getDynamicProperty(key),record);}finally{world.setDynamicProperty(key,undefined);}
});
test('a failed entity subscription cannot prevent status registration and exposes its cause',async()=>{
 const signal=world.afterEvents.dataDrivenEntityTrigger,original=signal.subscribe;
 signal.subscribe=()=>{throw Error('native signal unavailable');};
 try{await import('../.build/behavior_pack/scripts/glowsquito/main.js?failed_subscription');}finally{signal.subscribe=original;}
 assert(invoke(()=>undefined).some(m=>m.includes('setup error: dataDrivenEntityTrigger: Error: native signal unavailable')));
});
