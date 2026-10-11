import test from 'node:test';
import assert from 'node:assert/strict';
import {ItemStack} from './mock-server.mjs';
import {worldFixture, playerFixture} from './fixtures.mjs';
import {FARMLAND} from '../behavior_pack/scripts/crops.js';
import {TILLABLE_SOIL, updateTillingTargets, restoreUnusedTillingTarget} from '../behavior_pack/scripts/tilling.js';

function target(mode = 'Survival', dimensionId = 'minecraft:nether') {
  updateTillingTargets([]);
  const {put, dimension} = worldFixture(dimensionId);
  const block = put('minecraft:soul_soil');
  const {player, slots} = playerFixture(dimension, {mode, held: new ItemStack('minecraft:iron_hoe')});
  player.getBlockFromViewDirection = () => ({block, face: 'Up'});
  return {put, dimension, block, player, slots};
}
test('preparing a target does not consume or damage its hoe and repeated targeting does not rewrite it', () => {
  const {block, player, slots} = target();
  const tool = slots.get(0);
  updateTillingTargets([player]); assert.equal(block.typeId, TILLABLE_SOIL);
  const writes = block.writes;
  updateTillingTargets([player]); assert.equal(block.writes, writes);
  assert.equal(slots.get(0), tool); updateTillingTargets([]);
  assert.equal(block.typeId, 'minecraft:soul_soil');
});
test('looking away or changing the held tool restores ordinary soul soil', () => {
  const {block, player, slots} = target();
  updateTillingTargets([player]); player.getBlockFromViewDirection = () => undefined;
  updateTillingTargets([player]); assert.equal(block.typeId, 'minecraft:soul_soil');
  player.getBlockFromViewDirection = () => ({block, face: 'Up'});
  updateTillingTargets([player]); slots.set(0, new ItemStack('minecraft:stick'));
  updateTillingTargets([player]); assert.equal(block.typeId, 'minecraft:soul_soil');
});
test('two players targeting the same soil do not restore each other’s active target', () => {
  const {block, dimension, player} = target();
  const {player: other} = playerFixture(dimension, {held: new ItemStack('minecraft:stone_hoe')});
  other.getBlockFromViewDirection = () => ({block, face: 'Up'});
  updateTillingTargets([player, other]); updateTillingTargets([other]);
  assert.equal(block.typeId, TILLABLE_SOIL);
  restoreUnusedTillingTarget(block); assert.equal(block.typeId, TILLABLE_SOIL);
  updateTillingTargets([]); assert.equal(block.typeId, 'minecraft:soul_soil');
});
for (const [mode, dimension] of [['Adventure', 'minecraft:nether'], ['Spectator', 'minecraft:nether'], ['Survival', 'minecraft:overworld']]) {
  test(`does not prepare soil for ${mode} in ${dimension}`, () => {
    const {block, player} = target(mode, dimension);
    updateTillingTargets([player]); assert.equal(block.typeId, 'minecraft:soul_soil');
  });
}
test('does not prepare blocked or side-facing soil', () => {
  const {block, player, put} = target();
  player.getBlockFromViewDirection = () => ({block, face: 'North'});
  updateTillingTargets([player]); assert.equal(block.typeId, 'minecraft:soul_soil');
  player.getBlockFromViewDirection = () => ({block, face: 'Up'});
  put('minecraft:stone', {x: 0, y: 65, z: 0});
  updateTillingTargets([player]); assert.equal(block.typeId, 'minecraft:soul_soil');
});
test('saved or unloaded targets recover through the native block tick', () => {
  const {block, dimension, player} = target();
  updateTillingTargets([player]); dimension.unloaded = new Set(['0,64,0']);
  updateTillingTargets([]); assert.equal(block.typeId, TILLABLE_SOIL);
  dimension.unloaded.clear(); restoreUnusedTillingTarget(block);
  assert.equal(block.typeId, 'minecraft:soul_soil');
  block.setType(TILLABLE_SOIL); restoreUnusedTillingTarget(block);
  assert.equal(block.typeId, 'minecraft:soul_soil');
});
test('cleanup never overwrites a tilled or subsequently replaced block', () => {
  const {block, player} = target(); updateTillingTargets([player]); block.setType(FARMLAND);
  updateTillingTargets([]); restoreUnusedTillingTarget(block); assert.equal(block.typeId, FARMLAND);
  block.setType('minecraft:soul_soil'); updateTillingTargets([player]); block.setType('minecraft:stone');
  updateTillingTargets([]); assert.equal(block.typeId, 'minecraft:stone');
});
