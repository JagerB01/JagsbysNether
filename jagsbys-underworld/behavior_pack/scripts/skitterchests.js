import {world, system} from '@minecraft/server';

const storagePets = new Set([
  'jagsby_nether:crimson_skitterchest',
  'jagsby_nether:warped_skitterchest',
  'jagsby_nether:blackstone_skitterchest',
]);

// The chest-minecart runtime supplies the real container screen. Crouching
// reaches that native interaction; standing use is intercepted before it opens.
world.beforeEvents.playerInteractWithEntity.subscribe(event => {
  const {target, player, itemStack} = event;
  if (!storagePets.has(target.typeId)) return;
  if (player.isSneaking) return;
  const tamed = target.getProperty('jagsby_nether:tamed') === true
    || target.hasComponent('minecraft:is_tamed');
  // Preserve Scrap taming for wild Crimson/Warped, without consuming it on use
  // of a tamed chest. Blackstone never receives a taming route.
  if (!tamed && target.typeId !== 'jagsby_nether:blackstone_skitterchest'
      && itemStack?.typeId === 'minecraft:netherite_scrap') return;
  event.cancel = true;
  if (!tamed) return;
  const nextEvent = target.getProperty('jagsby_nether:sitting') === true
    ? 'jagsby_nether:stand' : 'jagsby_nether:sit';
  system.run(() => {
    try {
      target.triggerEvent('jagsby_nether:retain_storage');
      target.triggerEvent(nextEvent);
    } catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
  });
});

// Once used, retain storage so distance despawning cannot remove player items.
world.afterEvents.playerInteractWithEntity.subscribe(({target}) => {
  if (!storagePets.has(target.typeId)) return;
  try { target.triggerEvent('jagsby_nether:retain_storage'); }
  catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
});
