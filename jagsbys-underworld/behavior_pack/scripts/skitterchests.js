import {world, system} from '@minecraft/server';

const tameableChests = new Set([
  'jagsby_nether:crimson_skitterchest',
  'jagsby_nether:warped_skitterchest',
]);
const blackstone = 'jagsby_nether:blackstone_skitterchest';
const isTamed = target => target.getProperty('jagsby_nether:tamed') === true
  || target.hasComponent('minecraft:is_tamed');

world.beforeEvents.playerInteractWithEntity.subscribe(event => {
  const {target, player, itemStack} = event;
  if (target.typeId === blackstone) { event.cancel = true; return; }
  if (!tameableChests.has(target.typeId)) return;
  const tamed = isTamed(target);
  // Wild chests can be tamed with Scrap while standing, but never opened.
  if (!tamed) {
    event.cancel = player.isSneaking || itemStack?.typeId !== 'minecraft:netherite_scrap';
    return;
  }
  // The native chest-minecart runtime supplies the real container screen.
  // Crouching reaches that interaction without changing the sitting state.
  if (player.isSneaking) return;
  event.cancel = true;
  const nextEvent = target.getProperty('jagsby_nether:sitting') === true
    ? 'jagsby_nether:stand' : 'jagsby_nether:sit';
  system.run(() => {
    try {
      target.triggerEvent('jagsby_nether:retain_storage');
      target.triggerEvent(nextEvent);
    } catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
  });
});

world.afterEvents.playerInteractWithEntity.subscribe(({target}) => {
  if (!tameableChests.has(target.typeId)) return;
  try {
    if (isTamed(target)) target.triggerEvent('jagsby_nether:retain_storage');
  } catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
});
