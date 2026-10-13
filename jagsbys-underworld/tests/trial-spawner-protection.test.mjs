import test from 'node:test';
import assert from 'node:assert/strict';
import {world,intervals} from './mock-server.mjs';
import '../behavior_pack/scripts/trial_spawner_protection.js';
const block=(typeId,dimension='minecraft:nether')=>({typeId,dimension:{id:dimension}});
test('Nether trial spawners cannot be broken by players, including existing and creative placements',()=>{
 for(const mode of ['survival','creative']){const e={block:block('minecraft:trial_spawner'),player:{getGameMode:()=>mode},cancel:false};world.beforeEvents.playerBreakBlock.emit(e);assert(e.cancel);}
});
test('normal blocks, ordinary spawners, vaults and Overworld trial spawners remain breakable',()=>{
 for(const b of [block('minecraft:stone'),block('minecraft:mob_spawner'),block('minecraft:vault'),block('minecraft:trial_spawner','minecraft:overworld')]){const e={block:b,cancel:false};world.beforeEvents.playerBreakBlock.emit(e);assert(!e.cancel);}
});
test('explosions exclude only protected Nether trial spawners and introduce no recurring checks',()=>{
 const trial=block('minecraft:trial_spawner'),stone=block('minecraft:stone');let result;
 world.beforeEvents.explosion.emit({dimension:{id:'minecraft:nether'},getImpactedBlocks:()=>[trial,stone],setImpactedBlocks:blocks=>result=blocks});assert.deepEqual(result,[stone]);assert.equal(intervals.length,0);
});
