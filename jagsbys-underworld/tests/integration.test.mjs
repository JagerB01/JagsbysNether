import test from 'node:test';
import assert from 'node:assert/strict';
import {components, startup, world, system, intervals, jobs} from './mock-server.mjs';
import {worldFixture, playerFixture} from './fixtures.mjs';
import {RECORD_PREFIX} from '../.build/behavior_pack/scripts/settlements/navigation.js';
import '../.build/behavior_pack/scripts/main.js';
startup();

test('one combined entry registers crop components and both subsystem schedules exactly once', () => {
  assert.deepEqual([...components.keys()].sort(), ['jagsby_nether:crop', 'jagsby_nether:farmland', 'jagsby_nether:tillable_soil']);
  assert.deepEqual(intervals.map(i => i.ticks).sort((a,b) => a-b), [1,100]);
  for (const {callback} of intervals) assert.doesNotThrow(callback);
});
test('agriculture starter command is handled once without scheduling a village', () => {
  const {dimension} = worldFixture(); const {player, gifts} = playerFixture(dimension);
  const count = jobs.length;
  system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:kit', message:'', sourceEntity:player});
  assert.equal(gifts.length, 10); assert.equal(jobs.length, count);
});
test('village command reaches settlement generator without giving a crop kit', () => {
  const {dimension} = worldFixture(); const {player, gifts} = playerFixture(dimension);
  const count = jobs.length;
  system.afterEvents.scriptEventReceive.emit({id:'nether_settlements:test', message:'crimson', sourceEntity:player});
  assert.equal(jobs.length, count+1); assert.equal(gifts.length, 0);
  assert.equal(typeof jobs.at(-1).next, 'function');
});
test('village lookup and crop kit coexist on the same player', () => {
  const {dimension} = worldFixture(); const {player, gifts, messages} = playerFixture(dimension);
  world.setDynamicProperty(`${RECORD_PREFIX}test`, JSON.stringify({x:10,y:65,z:20,theme:'warped',houses:5,roads:4}));
  system.afterEvents.scriptEventReceive.emit({id:'nether_settlements:find', message:'village', sourceEntity:player});
  assert(messages.some(m => m.includes('Nearest recorded warped village')));
  system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:kit', message:'', sourceEntity:player});
  assert.equal(gifts.length, 10);
});
