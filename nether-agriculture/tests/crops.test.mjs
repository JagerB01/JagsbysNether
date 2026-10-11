import test from 'node:test';
import assert from 'node:assert/strict';
import {NS, AGE, HEATED, HEAT_LEVEL, ATTACHED, FACING, FARMLAND, hasHeat, updateFarmland,
  randomTick, fertilize, pickBerries} from '../behavior_pack/scripts/crops.js';
import {worldFixture, rng} from './fixtures.mjs';
const id = name => `${NS}:${name}`;
function farm(name = 'rye_crop', age = 0, dimension = 'minecraft:nether') {
  const world = worldFixture(dimension);
  const soil = world.put(FARMLAND, {x: 0, y: 64, z: 0}, {[HEATED]: true, [HEAT_LEVEL]: 7});
  const crop = world.put(id(name), {x: 0, y: 65, z: 0}, {[AGE]: age, [ATTACHED]: false, [FACING]: 0});
  return {...world, soil, crop};
}
for (const [x, y, z, expected] of [[4,0,4,true], [-4,1,-4,true], [5,0,0,false], [0,-1,0,false], [0,2,0,false]]) {
  test(`heat bounds ${x},${y},${z}`, () => {
    const {soil, put} = farm();
    put('minecraft:lava', {x, y: 64 + y, z});
    assert.equal(hasHeat(soil), expected);
  });
}
test('lava does not heat farmland outside the Nether', () => {
  const {soil, put} = farm('rye_crop', 0, 'minecraft:overworld');
  put('minecraft:lava', {x: 1, y: 64, z: 0}); assert.equal(hasHeat(soil), false);
});
test('unloaded heat cells are safe', () => {
  const {soil, dimension} = farm(); dimension.unloaded = new Set(['-4,64,-4']);
  assert.equal(hasHeat(soil), false);
});
test('heated soil cools in seven steps then reverts after removal of lava', () => {
  const {soil} = farm(); updateFarmland(soil);
  assert.equal(soil.permutation.getState(HEATED), false);
  assert.equal(soil.permutation.getState(HEAT_LEVEL), 6);
  for (let i = 0; i < 6; i++) updateFarmland(soil);
  assert.equal(soil.permutation.getState(HEAT_LEVEL), 0);
  assert.equal(soil.typeId, FARMLAND);
  updateFarmland(soil); assert.equal(soil.typeId, 'minecraft:soul_soil');
});
test('new farmland warms gradually through all seven stages', () => {
  const {soil} = farm(); soil.setType(FARMLAND);
  for (let level = 1; level <= 7; level++) {
    updateFarmland(soil, true);
    assert.equal(soil.permutation.getState(HEAT_LEVEL), level);
    assert.equal(soil.permutation.getState(HEATED), level === 7);
  }
});
test('fertilizer does not instantly heat warming farmland', () => {
  const {soil, crop, put} = farm(); soil.setType(FARMLAND);
  put('minecraft:lava', {x: 1, y: 64, z: 0});
  updateFarmland(soil);
  assert.equal(fertilize(crop, rng(0)), true);
  assert.equal(soil.permutation.getState(HEAT_LEVEL), 1);
  assert.equal(soil.permutation.getState(HEATED), false);
  assert.equal(crop.permutation.getState(AGE), 2);
  randomTick(crop, rng(0));
  assert.equal(crop.permutation.getState(AGE), 2);
});
test('heated farmland from an old world upgrades without cooling', () => {
  const {soil} = farm(); soil.setPermutation(soil.permutation.withState(HEAT_LEVEL, 0));
  updateFarmland(soil, true);
  assert.equal(soil.permutation.getState(HEAT_LEVEL), 7);
  assert.equal(soil.permutation.getState(HEATED), true);
});
test('lava keeps farmland heated', () => {
  const {soil, put} = farm(); put('minecraft:flowing_lava', {x: 1, y: 64, z: 0});
  updateFarmland(soil); assert.equal(soil.permutation.getState(HEATED), true);
});
test('already-heated farmland is not rewritten on random ticks', () => {
  const {soil, put} = farm(); put('minecraft:lava', {x: 1, y: 64, z: 0});
  for (let i = 0; i < 10; i++) updateFarmland(soil);
  assert.equal(soil.writes, 0);
});
for (const name of ['rye_crop','polyps','murky_gourd_stem']) {
  test(`${name} advances on a successful growth roll`, () => {
    const {crop} = farm(name, 2); randomTick(crop, rng(0)); assert.equal(crop.permutation.getState(AGE), 3);
  });
  test(`${name} requires heated farmland`, () => {
    const {crop, soil} = farm(name, 2); soil.setType('minecraft:soul_soil');
    randomTick(crop, rng(0)); assert.equal(crop.permutation.getState(AGE), 2);
  });
  test(`${name} does not grow outside the Nether`, () => {
    const {crop} = farm(name, 2, 'minecraft:overworld');
    randomTick(crop, rng(0)); assert.equal(crop.permutation.getState(AGE), 2);
  });
}
test('rye remains unchanged on a failed roll', () => {
  const {crop} = farm('rye_crop', 3); randomTick(crop, rng(0.9)); assert.equal(crop.permutation.getState(AGE), 3);
});
test('only stage-six rye mutates into blistered rye', () => {
  const {crop} = farm('rye_crop', 6); randomTick(crop, rng(0)); assert.equal(crop.typeId, id('blistered_rye_crop'));
});
test('mature rye never mutates or grows beyond maturity', () => {
  const {crop} = farm('rye_crop', 7); randomTick(crop, rng(0));
  assert.equal(crop.typeId, id('rye_crop')); assert.equal(crop.permutation.getState(AGE), 7);
});
test('scarberries grow without heated farmland', () => {
  const {crop, soil} = farm('scarberry_bush', 1); soil.setType('minecraft:netherrack');
  randomTick(crop, rng(0)); assert.equal(crop.permutation.getState(AGE), 2);
});
test('berry picking yields two to three ripe berries and resets to stage one', () => {
  const {crop} = farm('scarberry_bush', 3);
  assert.equal(pickBerries(crop, rng(0.99)), 3); assert.equal(crop.permutation.getState(AGE), 1);
  assert.equal(pickBerries(crop), 0);
});
test('stage-two berries yield one to two berries', () => {
  const {crop} = farm('scarberry_bush', 2); assert.equal(pickBerries(crop, rng(0)), 1);
});
test('fertilizer advances two to five stages with a maturity cap', () => {
  const {crop, put} = farm('polyps', 5); put('minecraft:lava', {x: 1, y: 64, z: 0});
  assert.equal(fertilize(crop, rng(0.99)), true); assert.equal(crop.permutation.getState(AGE), 7);
  assert.equal(fertilize(crop), false);
});
for (const name of ['rye_crop', 'polyps', 'murky_gourd_stem']) {
  test(`${name} accepts fertilizer on dry farmland without lava`, () => {
    const {crop, soil} = farm(name); soil.setType(FARMLAND);
    assert.equal(fertilize(crop, rng(0)), true);
    assert.equal(crop.permutation.getState(AGE), 2);
    assert.equal(soil.permutation.getState(HEAT_LEVEL), 0);
    assert.equal(soil.permutation.getState(HEATED), false);
    randomTick(crop, rng(0));
    assert.equal(crop.permutation.getState(AGE), 2);
  });
}
test('fertilizer refuses unsupported soil', () => {
  const {crop, soil} = farm(); soil.setType('minecraft:soul_soil');
  assert.equal(fertilize(crop), false); assert.equal(crop.permutation.getState(AGE), 0);
});
test('scarberry fertilizer advances one stage', () => {
  const {crop} = farm('scarberry_bush', 1); assert.equal(fertilize(crop), true);
  assert.equal(crop.permutation.getState(AGE), 2);
});
test('mature gourd stem produces one adjacent fruit and detaches after harvest', () => {
  const {crop, put, dimension} = farm('murky_gourd_stem', 7);
  put('minecraft:soul_soil', {x: 0, y: 64, z: -1});
  randomTick(crop, rng(0,0)); assert.equal(crop.permutation.getState(ATTACHED), true);
  const fruit = dimension.getBlock({x: 0, y: 65, z: -1}); assert.equal(fruit.typeId, id('murky_gourd'));
  randomTick(crop, rng(0)); assert.equal(dimension.drops.length, 0);
  fruit.setType('minecraft:air'); randomTick(crop, rng(0));
  assert.equal(crop.permutation.getState(ATTACHED), false);
  randomTick(crop, rng(0,0)); assert.equal(fruit.typeId, id('murky_gourd'));
});
test('immature gourd stems cannot produce fruit', () => {
  const {crop, put, dimension} = farm('murky_gourd_stem', 1);
  put('minecraft:soul_soil', {x: 0, y: 64, z: -1}); randomTick(crop, rng(0));
  assert.equal(dimension.getBlock({x: 0, y: 65, z: -1}).typeId, 'minecraft:air');
});
test('gourd growth never overwrites a neighboring block', () => {
  const {crop, put} = farm('murky_gourd_stem', 7);
  put('minecraft:soul_soil', {x: 0, y: 64, z: -1}); const obstruction = put('minecraft:chest', {x: 0, y: 65, z: -1});
  randomTick(crop, rng(0,0)); assert.equal(obstruction.typeId, 'minecraft:chest');
  assert.equal(crop.permutation.getState(ATTACHED), false);
});
