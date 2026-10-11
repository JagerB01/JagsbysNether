import {GameMode} from '@minecraft/server';
import {NS, read, offset, isNether} from './crops.js';

export const TILLABLE_SOIL = `${NS}:tillable_soul_soil`;
const previews = new Map();
const key = block => `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
export function isVanillaHoe(type) {
  return typeof type === 'string' && type.startsWith('minecraft:') && type.endsWith('_hoe');
}
export function isEditable(player) {
  const mode = player.getGameMode();
  return mode === GameMode.Survival || mode === GameMode.Creative;
}

// Vanilla soul soil cannot receive a custom interaction component. Prepare only
// the single block each hoe-wielding player aims at. Its appearance and loot
// remain soul soil; the native callback supplies the same use path as crops.
export function updateTillingTargets(players) {
  const wanted = new Map();
  for (const player of players) {
    try {
      if (player.dimension.id !== 'minecraft:nether' || !isEditable(player)) continue;
      const stack = player.getComponent('minecraft:inventory')?.container?.getItem(player.selectedSlotIndex);
      if (!isVanillaHoe(stack?.typeId)) continue;
      const hit = player.getBlockFromViewDirection({maxDistance: 6, includeLiquidBlocks: true,
        includePassableBlocks: true});
      const block = hit?.block;
      if (hit?.face !== 'Up' || !block || !isNether(block) ||
          !['minecraft:soul_soil', TILLABLE_SOIL].includes(block.typeId) || !offset(block, 0, 1, 0)?.isAir) continue;
      wanted.set(key(block), {dimension: block.dimension, location: {...block.location}});
    } catch { /* A player/target may unload or disconnect during this tick. */ }
  }
  for (const [position, target] of previews) {
    if (wanted.has(position)) continue;
    const block = read(target.dimension, target.location);
    if (block?.typeId === TILLABLE_SOIL) block.setType('minecraft:soul_soil');
    previews.delete(position);
  }
  for (const [position, target] of wanted) {
    const block = read(target.dimension, target.location);
    if (block?.typeId === 'minecraft:soul_soil') block.setType(TILLABLE_SOIL);
    if (block?.typeId === TILLABLE_SOIL) previews.set(position, target);
  }
}

// The native block tick also restores saved/unloaded previews once reloaded,
// even when the original player is no longer present after a server restart.
export function restoreUnusedTillingTarget(block) {
  if (block.typeId === TILLABLE_SOIL && !previews.has(key(block))) block.setType('minecraft:soul_soil');
}
