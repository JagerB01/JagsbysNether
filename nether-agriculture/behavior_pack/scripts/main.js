import {world, system, ItemStack, GameMode} from '@minecraft/server';
import {NS, AGE, CROPS, FARMLAND, HEATED, read, offset, setState, hasHeat, updateFarmland,
  randomTick, fertilize, pickBerries} from './crops.js';

const id = name => `${NS}:${name}`;
function guard(action) {
  try { action(); } catch (error) { console.warn(`[Nether Agriculture] ${error}`); }
}
function inventory(player) { return player.getComponent('minecraft:inventory')?.container; }
function survival(player) { return player.getGameMode() === GameMode.Survival; }
function editable(player) {
  return player.getGameMode() === GameMode.Creative || survival(player);
}
function drop(block, name, count = 1) {
  block.dimension.spawnItem(new ItemStack(name, count), {
    x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5});
}
function give(player, name, count) {
  const remainder = inventory(player)?.addItem(new ItemStack(name, count));
  if (remainder) player.dimension.spawnItem(remainder, player.location);
}
function consume(player, slot, stack) {
  if (!survival(player)) return;
  if (stack.amount === 1) inventory(player).setItem(slot);
  else { stack.amount--; inventory(player).setItem(slot, stack); }
}
function damageTool(player, slot, stack) {
  if (!survival(player)) return;
  const durability = stack.getComponent('minecraft:durability');
  if (!durability) return;
  const unbreaking = stack.getComponent('minecraft:enchantable')?.getEnchantment('unbreaking')?.level ?? 0;
  if (Math.random() >= 1 / (unbreaking + 1)) return;
  if (durability.damage + 1 >= durability.maxDurability) inventory(player).setItem(slot);
  else { durability.damage++; inventory(player).setItem(slot, stack); }
}
function farmingFeedback(player, block, fertilizer = false) {
  // These effects run only after the farming action succeeds.
  const location = {x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5};
  guard(() => player.playAnimation('animation.jagsby_nether.farm_swing', {
    blendOutTime: 0.05, stopExpression: 'q.anim_time >= 0.3',
  }));
  guard(() => block.dimension.playSound(fertilizer ? 'item.bone_meal.use' : 'use.gravel', location));
  if (fertilizer) guard(() => block.dimension.spawnParticle('minecraft:crop_growth_emitter', location));
}

system.beforeEvents.startup.subscribe(({blockComponentRegistry}) => {
  blockComponentRegistry.registerCustomComponent(id('crop'), {
    beforeOnPlayerPlace(event) {
      if (event.dimension.id !== 'minecraft:nether') event.cancel = true;
    },
    onRandomTick({block}) { guard(() => randomTick(block)); },
  });
  blockComponentRegistry.registerCustomComponent(id('farmland'), {
    onPlace({block}) { guard(() => {
      setState(block, HEATED, hasHeat(block));
    }); },
    onRandomTick({block}) { guard(() => updateFarmland(block)); },
  });
});

// Defer mutations out of before-events, and recheck both the target and held item.
world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  const {block, player, itemStack} = event;
  const type = block.typeId, held = itemStack?.typeId;
  const hoe = held?.startsWith('minecraft:') && held.endsWith('_hoe');
  const till = type === 'minecraft:soul_soil' && hoe && event.blockFace === 'Up';
  const feed = !!CROPS[type] && held === id('wither_bone_meal');
  const harvest = !player.isSneaking && type === id('scarberry_bush') && block.permutation.getState(AGE) >= 2;
  const carve = type === id('murky_gourd') && held === 'minecraft:shears';
  if (!(till || feed || harvest || carve) || !editable(player)) return;
  event.cancel = true;
  if (!event.isFirstEvent) return;
  const dimension = block.dimension, location = {...block.location}, slot = player.selectedSlotIndex;
  system.run(() => guard(() => {
    const target = read(dimension, location), stack = inventory(player)?.getItem(slot);
    if (!editable(player) || target?.typeId !== type || player.dimension.id !== dimension.id ||
        player.selectedSlotIndex !== slot || stack?.typeId !== held) return;
    if (till) {
      if (dimension.id !== 'minecraft:nether') {
        player.sendMessage('Soul Soil Farmland needs the Nether and nearby lava.'); return;
      }
      if (!offset(target, 0, 1, 0)?.isAir) return;
      target.setType(FARMLAND);
      setState(target, HEATED, hasHeat(target));
      damageTool(player, slot, stack);
      farmingFeedback(player, target);
    } else if (feed && fertilize(target)) {
      consume(player, slot, stack);
      farmingFeedback(player, target, true);
    } else if (harvest) {
      const count = pickBerries(target);
      if (count) drop(target, id('scarberries'), count);
    } else if (carve) {
      target.setType(id('carved_murky_gourd'));
      drop(target, id('murky_seeds'), 4);
      damageTool(player, slot, stack);
    }
  }));
});

// Additive acquisition drops leave vanilla loot and other add-ons intact.
world.afterEvents.playerBreakBlock.subscribe(({block, brokenBlockPermutation, player}) => guard(() => {
  if (!survival(player) || block.dimension.id !== 'minecraft:nether') return;
  const type = brokenBlockPermutation.type.id;
  if (type === 'minecraft:nether_sprouts') {
    if (Math.random() < 0.125) drop(block, id('rye_seeds'));
    else if (Math.random() < 0.125) drop(block, id('murky_seeds'));
  }
  // Starter acquisition substitutes for the Java mod's natural crop patches.
  if (type === 'minecraft:crimson_roots' && Math.random() < 0.125) drop(block, id('scarberries'));
  if (type === 'minecraft:warped_roots' && Math.random() < 0.125) drop(block, id('polyp'));
}));
world.afterEvents.entityDie.subscribe(({deadEntity}) => guard(() => {
  if (deadEntity.typeId === 'minecraft:wither_skeleton' && deadEntity.dimension.id === 'minecraft:nether') {
    deadEntity.dimension.spawnItem(new ItemStack(id('wither_bone'), 1 + Math.floor(Math.random() * 2)), deadEntity.location);
  }
}));

world.afterEvents.itemCompleteUse.subscribe(({source, itemStack}) => guard(() => {
  const type = itemStack.typeId;
  if (type === id('blistered_rye_bread')) source.addEffect('fire_resistance', 19200);
  if (type === id('scarberries') && Math.random() < 0.8) source.addEffect('poison', 100);
  if (type === id('scarberry_bottle')) {
    source.removeEffect('wither');
    if (Math.random() < 0.8) source.addEffect('poison', 200);
  }
  if (type === id('wither_polyp') && Math.random() < 0.8) source.addEffect('wither', 200);
}));

system.afterEvents.scriptEventReceive.subscribe(({id: eventId, sourceEntity}) => guard(() => {
  if (eventId !== id('kit') || sourceEntity?.typeId !== 'minecraft:player') return;
  const player = /** @type {import('@minecraft/server').Player} */ (sourceEntity);
  for (const [name, count] of [['rye_seeds', 16], ['scarberries', 16], ['polyp', 16],
    ['murky_seeds', 16], ['wither_bone_meal', 64], ['blistered_rye', 6]]) give(player, id(name), count);
  for (const [name, count] of [['minecraft:soul_soil', 32], ['minecraft:iron_hoe', 1],
    ['minecraft:lava_bucket', 1], ['minecraft:shears', 1]]) give(player, name, count);
  player.sendMessage('Nether Agriculture kit received. Till soul soil within four blocks of lava in the Nether.');
}));

console.warn('[Nether Agriculture] v0.1.1 loaded. Starter kit: /scriptevent jagsby_nether:kit');
