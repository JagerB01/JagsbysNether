import {world} from '@minecraft/server';

const storagePets = new Set([
  'jagsby_nether:crimson_skitterchest',
  'jagsby_nether:warped_skitterchest',
  'jagsby_nether:blackstone_skitterchest',
]);

// Wild Skitterchests may despawn until used. Once interacted with, retain the
// chest so distance despawning cannot silently remove the player's storage.
world.afterEvents.playerInteractWithEntity.subscribe(({target}) => {
  if (!storagePets.has(target.typeId)) return;
  try { target.triggerEvent('jagsby_nether:retain_storage'); }
  catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
});
