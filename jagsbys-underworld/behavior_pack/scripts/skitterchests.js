import {world, system} from '@minecraft/server';
import {openStorage} from './skitterchest_storage.js';

const tameableChests = new Set([
  'jagsby_nether:crimson_skitterchest',
  'jagsby_nether:warped_skitterchest',
]);
const blackstone = 'jagsby_nether:blackstone_skitterchest';

// The menu has its own title: no overhead name is required.
function clearStorageLabel(entity) {
  if ((tameableChests.has(entity.typeId) || entity.typeId === blackstone) && entity.nameTag) entity.nameTag = '';
  if (tameableChests.has(entity.typeId) && isTamed(entity) && !entity.getProperty('jagsby_nether:sitting')) entity.triggerEvent('jagsby_nether:stand');
}
world.afterEvents.entitySpawn.subscribe(({entity}) => clearStorageLabel(entity));
world.afterEvents.entityLoad.subscribe(({entity}) => clearStorageLabel(entity));
system.run(() => {
  for (const dimension of ['overworld', 'nether', 'the_end']) {
    for (const type of [...tameableChests, blackstone]) {
      for (const entity of world.getDimension(dimension).getEntities({type})) clearStorageLabel(entity);
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
  // Standing opens the storage menu; crouching toggles the seated pose.
  event.cancel = true;
  if (!player.isSneaking) {system.run(() => openStorage(player, target)); return;}
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
      if(target.nameTag) target.nameTag='';
      target.triggerEvent('jagsby_nether:retain_storage');
    }
  } catch (error) { console.warn(`[Underworld Skitterchests] ${error}`); }
});
