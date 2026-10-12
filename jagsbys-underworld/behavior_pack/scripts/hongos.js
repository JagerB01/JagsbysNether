import {world,system,ItemStack} from '@minecraft/server';
import {ensureStorage} from './skitterchest_native_storage.js';

export const HONGO_SYNERGY=Object.freeze({
 'jagsby_nether:crimson_hongo':{chest:'jagsby_nether:crimson_skitterchest',item:'minecraft:iron_nugget',minSeconds:40,maxSeconds:60},
 'jagsby_nether:warped_hongo':{chest:'jagsby_nether:warped_skitterchest',item:'minecraft:gold_nugget',minSeconds:25,maxSeconds:35},
});
export const NUGGET_RANGE=8;
const DUE='jagsby_nether:nugget_due',SCHEDULE='jagsby_nether:nugget_schedule';
const SCHEDULE_VERSION=1;
const tamed=e=>e.getProperty('jagsby_nether:tamed')===true||e.hasComponent('minecraft:is_tamed');
const delay=(recipe,random)=>(recipe.minSeconds+Math.floor(random()*(recipe.maxSeconds-recipe.minSeconds+1)))*20;
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
// Absolute world time survives save/reload. Missed unloaded time never produces
// catch-up stacks: at most one nugget is deposited on each completed cooldown.
export function tickHongo(hongo,now=world.getAbsoluteTime(),random=Math.random){
 const recipe=HONGO_SYNERGY[hongo.typeId];
 if(!recipe||!tamed(hongo))return false;
 const due=hongo.getDynamicProperty(DUE);
 // Reset the former fast-test timer once on upgrade, then persist normal timers.
 if(typeof due!=='number'||hongo.getDynamicProperty(SCHEDULE)!==SCHEDULE_VERSION){
  hongo.setDynamicProperty(DUE,now+delay(recipe,random));
  hongo.setDynamicProperty(SCHEDULE,SCHEDULE_VERSION);return false;
 }
 if(now<due)return false;
 // Reserve the next cooldown before touching storage, preventing a repeated
 // deposit if saving/unloading interrupts the end of this operation.
 hongo.setDynamicProperty(DUE,now+delay(recipe,random));
 const chests=hongo.dimension.getEntities({type:recipe.chest,location:hongo.location,maxDistance:NUGGET_RANGE})
  .filter(e=>tamed(e)&&e.getProperty('jagsby_nether:sitting')===true&&e.isValid!==false&&distance(hongo.location,e.location)<=NUGGET_RANGE**2)
  .sort((a,b)=>distance(hongo.location,a.location)-distance(hongo.location,b.location));
 for(const chest of chests){
  const box=ensureStorage(chest);if(!box)continue;
  const bag=box.getComponent('minecraft:inventory')?.container;if(!bag)continue;
  const remaining=bag.addItem(new ItemStack(recipe.item,1));
  if(!remaining)return true;
 }
 // No matching available storage or every container is full. Retry gently;
 // nuggets are never dropped into the world or written to the old pet inventory.
 hongo.setDynamicProperty(DUE,now+40);
 return false;
}
system.runInterval(()=>{
 const now=world.getAbsoluteTime();
 for(const id of ['overworld','nether','the_end']){
  const dimension=world.getDimension(id);
  for(const type of Object.keys(HONGO_SYNERGY))for(const hongo of dimension.getEntities({type})){
   try{tickHongo(hongo,now);}catch(error){console.warn(`[Underworld Hongo synergy] ${error}`);}
  }
 }
},20);
