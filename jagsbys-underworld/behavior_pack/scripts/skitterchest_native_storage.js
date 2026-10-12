import {world,system} from '@minecraft/server';
export const STORAGE='jagsby_nether:skitterchest_storage';
const PETS=new Set(['jagsby_nether:crimson_skitterchest','jagsby_nether:warped_skitterchest']);
const LINK='jagsby_nether:storage_entity',OWNER='jagsby_nether:storage_owner';
const tracked=new Map(),viewers=new Map(),waiting=new Map(),links=new Map();
const DEAD='jagsby_nether:dead_storage:';
const inventory=e=>e.getComponent('minecraft:inventory')?.container;
const tamed=e=>e.getProperty('jagsby_nether:tamed')===true||e.hasComponent('minecraft:is_tamed');
const valid=e=>e?.isValid!==false;
const warn=error=>console.warn(`[Underworld native storage] ${error}`);
export function moveInventory(source,destination){
 if(source.size!==destination.size)throw Error('Storage size mismatch');
 // Copy first, clear second. A failed copy leaves the original intact; retrying
 // writes the same slots, so it cannot append or duplicate stacks.
 for(let i=0;i<source.size;i++)destination.setItem(i,source.getItem(i));
 source.clearAll();
}
export function storageOwner(entity){
 if(entity.typeId===STORAGE){const id=entity.getDynamicProperty(OWNER);return typeof id==='string'?world.getEntity(id):undefined;}
 return PETS.has(entity.typeId)?entity:undefined;
}
function restore(pet){pet.triggerEvent('jagsby_nether:resume_storage');pet.triggerEvent(pet.getProperty('jagsby_nether:sitting')?'jagsby_nether:sit':'jagsby_nether:stand');}
export function ensureStorage(pet){
 if(!PETS.has(pet.typeId)||!tamed(pet))return;
 const id=pet.getDynamicProperty(LINK);
 links.set(pet.id,{id,migrated:!!pet.getDynamicProperty('jagsby_nether:storage_migrated')});
 let box=id?world.getEntity(id):undefined;
 if(!box && id){
  // The companion may load shortly after its owner. Never duplicate its items.
  const start=waiting.get(pet.id)??system.currentTick;waiting.set(pet.id,start);
  if(system.currentTick-start<40)return;
  warn(`Storage ${id} unavailable for ${pet.id}; preserving link, not replacing it.`);return;
 }
 if(!box){
  box=pet.dimension.spawnEntity(STORAGE,pet.location);
  box.setDynamicProperty(OWNER,pet.id);
  pet.setDynamicProperty(LINK,box.id);
 }
 if(!pet.getDynamicProperty('jagsby_nether:storage_migrated')){
  moveInventory(inventory(pet),inventory(box));
  pet.setDynamicProperty('jagsby_nether:storage_migrated',true);
 }
 tracked.set(pet.id,{pet,box,migrated:true});links.set(pet.id,{id:box.id,migrated:true});waiting.delete(pet.id);
 if((viewers.get(box.id)??0)>0)pet.triggerEvent('jagsby_nether:pause_storage');
 return box;
}
function register(entity){
 if(PETS.has(entity.typeId)&&tamed(entity)){
  links.set(entity.id,{id:entity.getDynamicProperty(LINK),migrated:!!entity.getDynamicProperty('jagsby_nether:storage_migrated')});
  restore(entity);system.run(()=>{try{ensureStorage(entity);}catch(error){warn(error);}});
 }else if(entity.typeId===STORAGE){
  const dead=world.getDynamicProperty(DEAD+entity.id);
  if(dead==='discard'){entity.remove();world.setDynamicProperty(DEAD+entity.id,undefined);return;}
  if(dead==='drop'||entity.getDynamicProperty('jagsby_nether:owner_dead')){dropStorage(entity);return;}
  const pet=storageOwner(entity);
  if(pet)tracked.set(pet.id,{pet,box:entity,migrated:!!pet.getDynamicProperty('jagsby_nether:storage_migrated')});
 }
}
world.afterEvents.entityLoad.subscribe(({entity})=>register(entity));
world.afterEvents.entitySpawn.subscribe(({entity})=>register(entity));
system.run(()=>{
 for(const dimension of ['overworld','nether','the_end']){
  const dim=world.getDimension(dimension);
  for(const type of PETS)for(const pet of dim.getEntities({type}))register(pet);
 }
});
system.runInterval(()=>{
 for(const [id,pair] of tracked){
  const {pet,box}=pair;
  if(!valid(pet)||!valid(box))continue;
  try{box.teleport(pet.location,{dimension:pet.dimension});}catch(error){warn(error);}
 }
},1);
// Prevent the native container's vehicle damage/death rules from replacing the
// actual pet's health. Forward the engine-calculated hit and attacker to the mob.
world.beforeEvents.entityHurt.subscribe(event=>{
 if(event.hurtEntity.typeId!==STORAGE)return;
 event.cancel=true;
 const pet=storageOwner(event.hurtEntity),damage=event.damage,source=event.damageSource;
 if(!pet)return;
 system.run(()=>{
  try{pet.applyDamage(damage,{cause:source.cause,...(source.damagingEntity?{damagingEntity:source.damagingEntity}:{})});}catch(error){warn(error);}
 });
});
function dropStorage(box){
 const id=box.id;world.setDynamicProperty(DEAD+id,'drop');
 box.setDynamicProperty('jagsby_nether:owner_dead',true);
 const bag=inventory(box);
 for(let slot=0;slot<bag.size;slot++){
  const item=bag.getItem(slot);
  if(item){box.dimension.spawnItem(item,box.location);bag.setItem(slot,undefined);}
 }
 box.remove();viewers.delete(id);world.setDynamicProperty(DEAD+id,undefined);
}
world.afterEvents.entityDie.subscribe(({deadEntity})=>{
 if(PETS.has(deadEntity.typeId)){
  const pair=tracked.get(deadEntity.id);tracked.delete(deadEntity.id);
  const link=links.get(deadEntity.id);links.delete(deadEntity.id);
  if(pair){
   try{
    if(pair.migrated)dropStorage(pair.box);
    else {world.setDynamicProperty(DEAD+pair.box.id,'discard');pair.box.remove();world.setDynamicProperty(DEAD+pair.box.id,undefined);}
   }catch(error){warn(error);}
  }else if(link?.id){world.setDynamicProperty(DEAD+link.id,link.migrated?'drop':'discard');}
 }else if(deadEntity.typeId===STORAGE){
  const pet=storageOwner(deadEntity);
  if(pet){pet.setDynamicProperty(LINK,undefined);tracked.delete(pet.id);}
 }
});
function access(entity,opening){
 if(entity.typeId!==STORAGE)return;
 const pet=storageOwner(entity);if(!pet||!tamed(pet))return;
 const count=Math.max(0,(viewers.get(entity.id)??0)+(opening?1:-1));viewers.set(entity.id,count);
 if(count>0)pet.triggerEvent('jagsby_nether:pause_storage');else restore(pet);
 entity.dimension.playSound(`jagsby_nether.skitterchest.${opening?'open':'close'}`,entity.location,{volume:1,pitch:1});
}
world.afterEvents.entityContainerOpened.subscribe(({entity})=>{try{access(entity,true);}catch(error){warn(error);}});
world.afterEvents.entityContainerClosed.subscribe(({entity})=>{try{access(entity,false);}catch(error){warn(error);}});
