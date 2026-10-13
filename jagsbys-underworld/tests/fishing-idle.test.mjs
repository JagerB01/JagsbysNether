import test from 'node:test';
import assert from 'node:assert/strict';
import {world,intervals,flush,system} from './mock-server.mjs';
import '../.build/behavior_pack/scripts/lava_fishing/main.js';
test('idle fishing performs no repeated player enumeration, inventory reads or effect queries',()=>{
 let enumerations=0,inventoryReads=0,effectReads=0;
 const player={id:'idle-player',typeId:'minecraft:player',getComponent(){inventoryReads++;return {container:{size:1,getItem(){inventoryReads++;}}};},getDynamicProperty(){effectReads++;}};
 world.getAllPlayers=()=>{enumerations++;return [player];};flush();
 const initial=[enumerations,inventoryReads,effectReads];
 for(let tick=1;tick<=200;tick++){system.currentTick=tick;for(const i of intervals)if(tick%i.ticks===0)i.callback();}
 assert.deepEqual([enumerations,inventoryReads,effectReads],initial);
});
test('spawn retires old effect timers and eating fish starts no scripted effects',()=>{
 const props=new Map([['jagsby_nether:endless_flame_until',999999],['jagsby_nether:lava_walker_until',999999]]);
 const player={id:'effect-player',typeId:'minecraft:player',getComponent(){return undefined;},getDynamicProperty:k=>props.get(k),setDynamicProperty(k,v){if(v===undefined)props.delete(k);else props.set(k,v);},addEffect(){assert.fail('Fish must not add effects');},setOnFire(){assert.fail('Fish must not ignite players');}};
 world.afterEvents.playerSpawn.emit({player});assert.equal(props.size,0);
 for(const typeId of ['jagsby_nether:agni_fish','jagsby_nether:steam_flying_fish','jagsby_nether:obsidian_sword_fish'])world.afterEvents.itemCompleteUse.emit({source:player,itemStack:{typeId}});
 assert.equal(props.size,0);assert(!intervals.some(i=>i.ticks===10));
});
