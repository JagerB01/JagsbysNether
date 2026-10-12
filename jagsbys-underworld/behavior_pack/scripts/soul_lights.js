import {world,BlockVolume} from '@minecraft/server';

export const SOUL_LIGHT_RANGES=Object.freeze({
 'minecraft:soul_torch':12,
 'minecraft:soul_lantern':16,
});
// Monster-family add-on mobs are covered automatically. The explicit vanilla
// list also covers hostile mobs such as hoglins that do not use that family.
const VANILLA_HOSTILES=new Set([
 'blaze','bogged','breeze','cave_spider','creeper','drowned','elder_guardian',
 'ender_dragon','enderman','endermite','evocation_illager','evoker','ghast',
 'guardian','hoglin','husk','magma_cube','phantom','piglin','piglin_brute',
 'pillager','ravager','shulker','silverfish','skeleton','slime','spider','stray',
 'vex','vindication_illager','vindicator','warden','witch','wither',
 'wither_skeleton','zoglin','zombie','zombie_pigman','zombified_piglin',
].map(type=>'minecraft:'+type));
const WILD_HOSTILE_CHESTS=new Set(['jagsby_nether:crimson_skitterchest','jagsby_nether:warped_skitterchest']);
export function isHostileSpawn(entity){
 if(entity.isValid===false)return false;
 if(entity.hasComponent('minecraft:is_tamed')||entity.getProperty('jagsby_nether:tamed')===true)return false;
 return VANILLA_HOSTILES.has(entity.typeId)||WILD_HOSTILE_CHESTS.has(entity.typeId)
  ||entity.getComponent('minecraft:type_family')?.hasTypeFamily?.('monster')===true;
}
export function protectedBySoulLight(entity){
 const {dimension,location}=entity;
 const center={x:Math.floor(location.x),y:Math.floor(location.y),z:Math.floor(location.z)};
 const height=dimension.heightRange;
 const from={x:center.x-16,y:Math.max(height.min,center.y-16),z:center.z-16};
 const to={x:center.x+16,y:Math.min(height.max-1,center.y+16),z:center.z+16};
 if(from.y>to.y)return false;
 // One native filtered lookup per hostile spawn, not 35,937 JavaScript block
 // reads or a recurring patrol. Existing lights, wall torches and hanging
 // lanterns are found directly, without placement caches that can go stale.
 const matches=dimension.getBlocks(new BlockVolume(from,to),{includeTypes:Object.keys(SOUL_LIGHT_RANGES)},true);
 for(const position of matches.getBlockLocationIterator()){
  const block=dimension.getBlock(position);if(!block)continue;
  const range=SOUL_LIGHT_RANGES[block.typeId];if(!range)continue;
  const distance=(position.x+0.5-location.x)**2+(position.y+0.5-location.y)**2+(position.z+0.5-location.z)**2;
  if(distance<=range*range)return true;
 }
 return false;
}
export function suppressHostileSpawn(entity){
 if(!isHostileSpawn(entity)||!protectedBySoulLight(entity))return false;
 // remove(), never kill()/damage(): rejected mobs produce no loot or XP.
 entity.remove();return true;
}
// Stable Bedrock has no cancellable before-spawn event. Remove immediately in
// the after-spawn callback; nothing is scanned on entityLoad or every tick.
world.afterEvents.entitySpawn.subscribe(({entity})=>{
 try{suppressHostileSpawn(entity);}catch(error){console.warn(`[Underworld soul lights] ${error}`);}
});
