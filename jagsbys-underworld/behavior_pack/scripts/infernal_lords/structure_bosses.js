/** One-shot placement at verified authored boss sites. No subscriptions, timers or backfill. */
import {world} from '@minecraft/server';
import {chunkLease} from '../chunk_loading.js';
import {BOSS_SITES} from './boss_sites.js';

export function bossSite(structureId, origin, modular = false) {
  const profile = BOSS_SITES[structureId];
  if (!profile) return undefined;
  const [x,y,z] = modular && profile.modularOffset ? profile.modularOffset : profile.offset;
  return {profile, position:{x:origin.x+x, y:origin.y+y, z:origin.z+z}};
}
export function bossPlacementKey(structureId, position, dimensionId) {
  const dimension = {'minecraft:nether':'n','minecraft:overworld':'o','minecraft:the_end':'e'}[dimensionId] ?? dimensionId;
  const coords = [position.x*2,position.y*2,position.z*2].map(n => n.toString(36)).join('_');
  return `underworld_lords:placed_${dimension}_${structureId}_${coords}`;
}
export function* placeStructureBoss(structureId, origin, dimension, {modular=false}={}) {
  const site = bossSite(structureId,origin,modular);
  if (!site) return {state:'not_applicable'};
  const {profile,position} = site;
  const key = bossPlacementKey(structureId,position,dimension.id);
  const previous = world.getDynamicProperty(key);
  // A claim survives a crash between spawning and its final save. Never guess
  // that a missing/defeated/transformed entity should be spawned a second time.
  if (previous !== undefined) return {...JSON.parse(previous), alreadyPlaced:true};
  const lease = chunkLease(dimension,'dormant_boss');
  try {
    // Reacquire only the small boss site: the last structure tile may be far
    // away or in another chunk. Floor/clearance are checked offline in templates.
    yield* lease.load({x:Math.floor(position.x)-2,y:Math.floor(position.y)-1,z:Math.floor(position.z)-2},[5,12,5]);
    const record = {revision:1,state:'claimed',structureId,entityId:profile.entityId,position};
    world.setDynamicProperty(key,JSON.stringify(record));
    let entity;
    try {
      entity = world.getDimension(dimension.id).spawnEntity(profile.entityId,position,{initialPersistence:true});
    } catch (error) {
      world.setDynamicProperty(key,undefined);
      throw error;
    }
    record.state='placed';record.spawnedEntityId=entity.id;
    world.setDynamicProperty(key,JSON.stringify(record));
    try { entity.addTag(key); } catch (error) { console.warn(`[Underworld bosses] Site tag: ${error}`); }
    return record;
  } finally {
    lease.release();
  }
}
// An old partially-built structure has no opt-in marker and is left unchanged.
export function* placePlannedStructureBoss(record, dimension) {
  if (record.infernalLordsVersion !== 1) return;
  record.infernalBoss = yield* placeStructureBoss(record.id,record.origin,dimension,{modular:record.modular??false});
}
