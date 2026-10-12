import {world, system} from '@minecraft/server';

const tameableChests = new Set([
  'jagsby_nether:crimson_skitterchest',
  'jagsby_nether:warped_skitterchest',
]);
const blackstone = 'jagsby_nether:blackstone_skitterchest';

// Native container titles use the entity's custom name. Do not rename vanilla
// minecarts or replace names deliberately applied by players.
function nameStoragePet(entity) {
  if (tameableChests.has(entity.typeId) && !entity.nameTag) entity.nameTag = 'Skitterchest';
}
world.afterEvents.entitySpawn.subscribe(({entity}) => nameStoragePet(entity));
world.afterEvents.entityLoad.subscribe(({entity}) => nameStoragePet(entity));
system.run(() => {
  for (const dimension of ['overworld', 'nether', 'the_end']) {
    for (const type of tameableChests) {
      for (const entity of world.getDimension(dimension).getEntities({type})) nameStoragePet(entity);
    }
  }
});

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
  // The native animal runtime supplies container interaction for a chested pet.
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
    if (isTamed(target)) {
      nameStoragePet(target);
      target.triggerEvent('jagsby_nether:retain_storage');
    }
  } catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
});

// Native container access does not emit the entity sound mappings used before.
// Stable server 2.8 supplies actual open/close events, so there is no guessed
// timeout, crouching-click approximation, or replacement of vanilla sounds.
function storageSound(entity, sound) {
  if (!tameableChests.has(entity.typeId)) return;
  try {
    if (!isTamed(entity)) return;
    entity.dimension.playSound(sound, entity.location, {volume: 1, pitch: 1});
  } catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
}
world.afterEvents.entityContainerOpened.subscribe(({entity}) => {
  storageSound(entity, 'jagsby_nether.skitterchest.open');
});
world.afterEvents.entityContainerClosed.subscribe(({entity}) => {
  storageSound(entity, 'jagsby_nether.skitterchest.close');
});
