import test from 'node:test';
import assert from 'node:assert/strict';
import {populate} from '../.build/behavior_pack/scripts/settlements/population.js';
function item(x,kind='house',countsAsHouse=true){return {piece:{id:`test:house_${x}`,kind,countsAsHouse,size:[3,4,3]},rotation:0,origin:{x,z:0},baseY:64};}
function fixture(blocked=false){const calls=[];return {calls,getBlock({y}){return {typeId:y===64?'minecraft:warped_planks':blocked?'minecraft:stone':'minecraft:air',isAir:y!==64&&!blocked};},spawnEntity(...args){calls.push(args);return new Proxy({},{set(){throw Error('Defaults modified');},get(){throw Error('Defaults accessed');}});}};}
function finish(job){let result;do{result=job.next();}while(!result.done);return result.value;}
test('one default vanilla entity per residential house and none for amenities or center',()=>{
 const d=fixture(),messages=[];
 assert.deepEqual(finish(populate(d,[item(0),item(10),item(20,'center'),item(30,'road'),item(40,'house',false)],m=>messages.push(m))),{villagers:2});
 assert.equal(d.calls.length,2);
 for(const [type,position,...extra] of d.calls){assert.equal(type,'minecraft:villager_v2');assert.equal(position.y,65);assert.deepEqual(extra,[]);}
 assert.deepEqual(messages,['Residents placed: 2 villagers.']);
});
test('standalone house gets one villager',()=>{const d=fixture();assert.deepEqual(finish(populate(d,[item(0)])),{villagers:1});});
test('unsafe houses are skipped and spawn errors do not abort later houses',()=>{
 const blocked=fixture(true);assert.deepEqual(finish(populate(blocked,[item(0)])),{villagers:0});assert.equal(blocked.calls.length,0);
 const d=fixture(),spawn=d.spawnEntity;let attempts=0;d.spawnEntity=(...args)=>{if(attempts++===0)throw Error('unloaded');return spawn(...args);};
 assert.deepEqual(finish(populate(d,[item(0),item(10)])),{villagers:1});assert.equal(attempts,2);
});
