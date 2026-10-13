import {world, system, ItemStack, GameMode} from '@minecraft/server';
import {NS, AGE, CROPS, FARMLAND, read, offset, updateFarmland,
  randomTick, fertilize, pickBerries} from './crops.js';
import {TILLABLE_SOIL, isVanillaHoe, updateTillingTargets, restoreUnusedTillingTarget} from './tilling.js';

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
function tillSoil(block, player, face) {
  if (!player || !editable(player) || face !== 'Up' ||
      player.dimension.id !== block.dimension.id || block.dimension.id !== 'minecraft:nether' ||
      !['minecraft:soul_soil', TILLABLE_SOIL].includes(block.typeId) || !offset(block, 0, 1, 0)?.isAir) return;
  const slot = player.selectedSlotIndex, stack = inventory(player)?.getItem(slot);
  if (!isVanillaHoe(stack?.typeId)) return;
  block.setType(FARMLAND);
  damageTool(player, slot, stack);
  farmingFeedback(block);
}
function farmingFeedback(block, fertilizer = false) {
  // These effects run only after the farming action succeeds.
  const location = {x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5};
  guard(() => block.dimension.playSound(fertilizer ? 'item.bone_meal.use' : 'use.gravel', location));
  if (fertilizer) guard(() => block.dimension.spawnParticle('minecraft:crop_growth_emitter', location));
}

// Track hoe selection through native events; idle players need no per-tick enumeration.
const hoePlayers = new Map();
let hadTargets = false;
function trackHoe(player) {
  try {
    const held = inventory(player)?.getItem(player.selectedSlotIndex);
    if (isVanillaHoe(held?.typeId)) hoePlayers.set(player.id, player);
    else hoePlayers.delete(player.id);
  } catch { hoePlayers.delete(player.id); }
}
world.afterEvents.playerSpawn.subscribe(({player}) => trackHoe(player));
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(({player}) => trackHoe(player));
world.afterEvents.playerInventoryItemChange.subscribe(({player, slot}) => {
  if (slot === player.selectedSlotIndex) trackHoe(player);
});
world.afterEvents.playerLeave.subscribe(({playerId}) => hoePlayers.delete(playerId));
system.run(() => { for (const player of world.getAllPlayers()) trackHoe(player); });
system.runInterval(() => guard(() => {
  if (!hoePlayers.size && !hadTargets) return;
  for (const player of hoePlayers.values()) trackHoe(player);
  updateTillingTargets([...hoePlayers.values()]);
  hadTargets = hoePlayers.size > 0;
}), 1);

system.beforeEvents.startup.subscribe(({blockComponentRegistry}) => {
  blockComponentRegistry.registerCustomComponent(id('tillable_soil'), {
    onPlayerInteract({block, player, face}) { guard(() => tillSoil(block, player, face)); },
    onTick({block}) { guard(() => restoreUnusedTillingTarget(block)); },
  });
  blockComponentRegistry.registerCustomComponent(id('crop'), {
    beforeOnPlayerPlace(event) {
      if (event.dimension.id !== 'minecraft:nether') event.cancel = true;
    },
    onRandomTick({block}) { guard(() => randomTick(block)); },
    // Use the block's native interaction callback rather than simulating use
    // through a deferred before-event. Native arm motion still needs game testing.
    onPlayerInteract({block, player}) { guard(() => {
      if (!player || !editable(player) || player.dimension.id !== block.dimension.id) return;
      const slot = player.selectedSlotIndex, stack = inventory(player)?.getItem(slot);
      if (stack?.typeId !== id('wither_bone_meal') || !fertilize(block)) return;
      consume(player, slot, stack);
      farmingFeedback(block, true);
    }); },
  });
  blockComponentRegistry.registerCustomComponent(id('farmland'), {
    // Two-second ticks warm/cool the soil and revert cold, empty plots after 30 seconds.
    onTick({block}) { guard(() => updateFarmland(block)); },
  });
});

// Defer mutations out of before-events, and recheck both the target and held item.
world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  const {block, player, itemStack} = event;
  const type = block.typeId, held = itemStack?.typeId;
  const hoe = isVanillaHoe(held);
  // Leave native interaction uncancelled. The deferred fallback does nothing
  // if its native callback has already tilled the block.
  const till = ['minecraft:soul_soil', TILLABLE_SOIL].includes(type) && hoe && event.blockFace === 'Up';
  // Let the crop's native onPlayerInteract handle fertilizer, including ripe bushes.
  if (CROPS[type] && held === id('wither_bone_meal')) return;
  const harvest = !player.isSneaking && type === id('scarberry_bush') && block.permutation.getState(AGE) >= 2;
  const carve = type === id('murky_gourd') && held === 'minecraft:shears';
  if (!(till || harvest || carve) || !editable(player)) return;
  // A vanilla hoe has no competing vanilla action on soul soil.
  if (harvest || carve) event.cancel = true;
  if (!event.isFirstEvent) return;
  const dimension = block.dimension, location = {...block.location}, slot = player.selectedSlotIndex;
  system.run(() => guard(() => {
    const target = read(dimension, location), stack = inventory(player)?.getItem(slot);
    if (!editable(player) || !target ||
        (target.typeId !== type && !(till && ['minecraft:soul_soil', TILLABLE_SOIL].includes(target.typeId))) ||
        player.dimension.id !== dimension.id ||
        player.selectedSlotIndex !== slot || stack?.typeId !== held) return;
    if (till) {
      if (dimension.id !== 'minecraft:nether') {
        player.sendMessage('Soul Soil Farmland needs the Nether.'); return;
      }
      // Fallback for a click before preparation or a skipped native callback.
      tillSoil(target, player, 'Up');
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
  // Root drops substitute for the Java mod's piglin-bartering acquisition.
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
  player.sendMessage('Nether Agriculture kit received. Till soul soil in the Nether. Nearby lava speeds up growth.');
}));

console.warn('[Nether Agriculture] v0.1.6 loaded. Starter kit: /scriptevent jagsby_nether:kit');
