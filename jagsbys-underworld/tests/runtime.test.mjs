import test from 'node:test';
import assert from 'node:assert/strict';
import {components, startup, flush, world, system, ItemStack} from './mock-server.mjs';
import {worldFixture, playerFixture} from './fixtures.mjs';
import {NS, AGE, HEATED, HEAT_LEVEL, FARMLAND} from '../.build/behavior_pack/scripts/agriculture/crops.js';
import {TILLABLE_SOIL, updateTillingTargets} from '../.build/behavior_pack/scripts/agriculture/tilling.js';
import '../.build/behavior_pack/scripts/main.js';
startup();
const id = name => `${NS}:${name}`;
function interact(block, player, held) {
  const event = {block, player, itemStack: held, blockFace: 'Up', isFirstEvent: true, cancel: false};
  world.beforeEvents.playerInteractWithBlock.emit(event);
  // Model Bedrock's subsequent native crop interaction, not just its before-event.
  if (!event.cancel && held?.typeId === id('wither_bone_meal')) {
    components.get(id('crop')).onPlayerInteract({block, player});
  }
  return event;
}
test('registers farming and native tilling block components', () => {
  assert.deepEqual([...components.keys()].sort(), [id('crop'),id('farmland'),id('glowhusk'),id('tillable_soil')]);
});
test('crop placement cancels outside the Nether', () => {
  const event = {dimension: {id: 'minecraft:overworld'}, cancel: false};
  components.get(id('crop')).beforeOnPlayerPlace(event); assert.equal(event.cancel, true);
});
test('hoe interaction creates dry farmland, then scheduled ticks warm it', () => {
  const {put, dimension} = worldFixture(); const soil = put('minecraft:soul_soil');
  put('minecraft:lava', {x: 1, y: 64, z: 0});
  const tool = new ItemStack('minecraft:iron_hoe'); const {player} = playerFixture(dimension, {held: tool});
  const event = interact(soil, player, tool); assert.equal(event.cancel, false);
  assert.equal(soil.typeId, 'minecraft:soul_soil'); flush();
  assert.equal(soil.typeId, FARMLAND); assert.equal(soil.permutation.getState(HEATED), false);
  assert.equal(soil.permutation.getState(HEAT_LEVEL), 0);
  for (let i = 0; i < 7; i++) components.get(id('farmland')).onTick({block:soil});
  assert.equal(soil.permutation.getState(HEATED), true);
  assert.equal(dimension.sounds[0].name, 'use.gravel');
});
test('an inventory change before the deferred interaction prevents mutation', () => {
  const {put, dimension} = worldFixture(); const soil = put('minecraft:soul_soil');
  const tool = new ItemStack('minecraft:iron_hoe'); const {player, slots} = playerFixture(dimension, {held: tool});
  interact(soil, player, tool); slots.set(0, new ItemStack('minecraft:stick')); flush();
  assert.equal(soil.typeId, 'minecraft:soul_soil');
});
test('adventure mode cannot till or consume fertilizer', () => {
  const {put, dimension} = worldFixture(); const soil = put('minecraft:soul_soil');
  const tool = new ItemStack('minecraft:iron_hoe'); const {player} = playerFixture(dimension, {mode:'Adventure', held:tool});
  assert.equal(interact(soil, player, tool).cancel, false); flush(); assert.equal(soil.typeId, 'minecraft:soul_soil');
});
test('survival fertilizer on dry farmland consumes one item after successful growth', () => {
  const {put, dimension} = worldFixture(); put(FARMLAND);
  const crop = put(id('polyps'), {x: 0, y: 65, z: 0}, {[AGE]: 0});
  const stack = new ItemStack(id('wither_bone_meal'), 2); const {player, slots} = playerFixture(dimension,{held:stack});
  assert.equal(interact(crop, player, stack).cancel, false); flush(); assert.equal(slots.get(0).amount, 1);
  assert(crop.permutation.getState(AGE) >= 2);
  assert.equal(dimension.sounds[0].name, 'item.bone_meal.use');
  assert.equal(dimension.particles[0].name, 'minecraft:crop_growth_emitter');
});
test('fertilizer is retained on a mature crop', () => {
  const {put, dimension} = worldFixture(); put(FARMLAND);
  const crop = put(id('polyps'), {x: 0, y: 65, z: 0}, {[AGE]: 7});
  const stack = new ItemStack(id('wither_bone_meal'), 2); const {player, slots} = playerFixture(dimension,{held:stack});
  interact(crop, player, stack); flush(); assert.equal(slots.get(0).amount, 2);
  assert.equal(dimension.sounds.length, 0);
  assert.equal(dimension.particles.length, 0);
});
test('berry picking emits crop items and preserves the bush', () => {
  const {put, dimension} = worldFixture(); const bush = put(id('scarberry_bush'), undefined, {[AGE]: 3});
  const {player} = playerFixture(dimension); interact(bush, player); flush();
  assert.equal(bush.permutation.getState(AGE), 1);
  assert.equal(dimension.drops[0].stack.typeId, id('scarberries'));
});
test('shears carve gourds and drop four seeds', () => {
  const {put, dimension} = worldFixture(); const gourd = put(id('murky_gourd'));
  const tool = new ItemStack('minecraft:shears'); const {player} = playerFixture(dimension,{held:tool});
  interact(gourd, player, tool); flush(); assert.equal(gourd.typeId, id('carved_murky_gourd'));
  assert.equal(dimension.drops[0].stack.amount, 4);
});
test('kit delivers all planting items and tools to the invoking player', () => {
  const {dimension} = worldFixture(); const {player,gifts} = playerFixture(dimension);
  system.afterEvents.scriptEventReceive.emit({id:id('kit'), sourceEntity:player});
  assert.equal(gifts.length, 10);
  for (const name of ['rye_seeds','polyp','scarberries','murky_seeds','wither_bone_meal']) {
    assert(gifts.some(item => item.typeId === id(name)));
  }
});
test('Scarberry Bottle removes Wither when consumed', () => {
  const {dimension} = worldFixture(); const {player,effects} = playerFixture(dimension);
  effects.set('wither', 400);
  world.afterEvents.itemCompleteUse.emit({source:player,itemStack:new ItemStack(id('scarberry_bottle'))});
  assert.equal(effects.has('wither'), false);
});
test('Blistered Rye Bread grants sixteen minutes of fire resistance', () => {
  const {dimension} = worldFixture(); const {player,effects} = playerFixture(dimension);
  world.afterEvents.itemCompleteUse.emit({source:player,itemStack:new ItemStack(id('blistered_rye_bread'))});
  assert.equal(effects.get('fire_resistance'), 19200);
});

test('fertilizing a ripe berry bush grows it instead of harvesting it', () => {
  const {put, dimension} = worldFixture();
  const bush = put(id('scarberry_bush'), undefined, {[AGE]: 2});
  const stack = new ItemStack(id('wither_bone_meal'), 2);
  const {player, slots} = playerFixture(dimension, {held: stack});
  assert.equal(interact(bush, player, stack).cancel, false); flush();
  assert.equal(bush.permutation.getState(AGE), 3);
  assert.equal(slots.get(0).amount, 1);
  assert.equal(dimension.drops.length, 0);
});

test('native fertilizer callback respects adventure mode and missing players', () => {
  const {put, dimension} = worldFixture(); put(FARMLAND);
  const crop = put(id('polyps'), {x: 0, y: 65, z: 0}, {[AGE]: 0});
  const stack = new ItemStack(id('wither_bone_meal'), 2);
  const {player, slots} = playerFixture(dimension, {mode: 'Adventure', held: stack});
  components.get(id('crop')).onPlayerInteract({block: crop});
  interact(crop, player, stack); flush();
  assert.equal(crop.permutation.getState(AGE), 0);
  assert.equal(slots.get(0).amount, 2);
  assert.equal(dimension.sounds.length, 0);
});

test('prepared soul soil uses native tilling callback once, with survival durability', () => {
  const {put, dimension} = worldFixture(); const soil = put('minecraft:soul_soil');
  const tool = new ItemStack('minecraft:iron_hoe');
  const durability = {damage: 0, maxDurability: 250};
  tool.getComponent = name => name === 'minecraft:durability' ? durability : undefined;
  const {player} = playerFixture(dimension, {held: tool});
  player.getBlockFromViewDirection = () => ({block: soil, face: 'Up'});
  updateTillingTargets([player]); assert.equal(soil.typeId, TILLABLE_SOIL);
  const event = interact(soil, player, tool); assert.equal(event.cancel, false);
  components.get(id('tillable_soil')).onPlayerInteract({block: soil, player, face: 'Up'});
  flush(); assert.equal(soil.typeId, FARMLAND); assert.equal(durability.damage, 1);
  assert.equal(dimension.sounds.length, 1); assert.equal(dimension.sounds[0].name, 'use.gravel');
  updateTillingTargets([]); assert.equal(soil.typeId, FARMLAND);
});
test('a target prepared between the click and deferred fallback can still be tilled', () => {
  const {put, dimension} = worldFixture(); const soil = put('minecraft:soul_soil');
  const tool = new ItemStack('minecraft:iron_hoe'); const {player} = playerFixture(dimension, {held: tool});
  interact(soil, player, tool);
  player.getBlockFromViewDirection = () => ({block: soil, face: 'Up'});
  updateTillingTargets([player]); flush(); assert.equal(soil.typeId, FARMLAND);
  assert.equal(dimension.sounds.length, 1); updateTillingTargets([]);
});
test('native tilling rejects the side face, blocked top and changed held item', () => {
  const {put, dimension} = worldFixture(); const soil = put(TILLABLE_SOIL);
  const tool = new ItemStack('minecraft:iron_hoe'); const {player, slots} = playerFixture(dimension, {held: tool});
  const component = components.get(id('tillable_soil'));
  component.onPlayerInteract({block: soil, player, face: 'North'});
  assert.equal(soil.typeId, TILLABLE_SOIL);
  const above = put('minecraft:stone', {x: 0, y: 65, z: 0});
  component.onPlayerInteract({block: soil, player, face: 'Up'});
  assert.equal(soil.typeId, TILLABLE_SOIL); above.setType('minecraft:air');
  slots.set(0, new ItemStack('minecraft:stick'));
  component.onPlayerInteract({block: soil, player, face: 'Up'});
  assert.equal(soil.typeId, TILLABLE_SOIL); assert.equal(dimension.sounds.length, 0);
});

test('prepared target still tills if its native callback is skipped', () => {
  const {put, dimension} = worldFixture(); const soil = put(TILLABLE_SOIL);
  const tool = new ItemStack('minecraft:iron_hoe'); const {player} = playerFixture(dimension, {held: tool});
  player.isSneaking = true;
  interact(soil, player, tool); flush();
  assert.equal(soil.typeId, FARMLAND); assert.equal(dimension.sounds.length, 1);
});

test('wild sprouts/roots no longer provide arena-exclusive starter crops while Polyp drops remain',()=>{
 const {put,dimension}=worldFixture(),{player}=playerFixture(dimension),random=Math.random;
 try{
  let values=[.5,0];Math.random=()=>values.shift()??0;
  world.afterEvents.playerBreakBlock.emit({block:put('minecraft:air'),brokenBlockPermutation:{type:{id:'minecraft:nether_sprouts'}},player});assert.equal(dimension.drops.length,0);
  Math.random=()=>0;
  world.afterEvents.playerBreakBlock.emit({block:put('minecraft:air'),brokenBlockPermutation:{type:{id:'minecraft:crimson_roots'}},player});assert.equal(dimension.drops.length,0);
  world.afterEvents.playerBreakBlock.emit({block:put('minecraft:air'),brokenBlockPermutation:{type:{id:'minecraft:warped_roots'}},player});assert.equal(dimension.drops[0].stack.typeId,id('polyp'));
 }finally{Math.random=random;}
});
