import {world,system,ItemStack} from '@minecraft/server';
import {eligibleVillager} from './villager_crop_food.js';
const CROPS=new Map([
 ['jagsby_nether:rye_crop','jagsby_nether:rye'],
 ['jagsby_nether:polyps','jagsby_nether:polyp'],
]);
// Keep native movement, professions and inventories; only handle custom plants
// within arm's reach. One ripe plant per farmer per second limits work.
export function farmNearbyCrop(v){
 if(world.gameRules.mobGriefing===false||!eligibleVillager(v))return false;
 if(v.getComponent('minecraft:variant')?.value!==1)return false;
 if(v.getComponent('minecraft:tradeable')?.isTrading)return false;
 const time=world.getTimeOfDay?.();
 if(time!==undefined&&(time<2000||time>=9000))return false;
 const dimension=v.dimension,origin=v.location;
 const x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z);
 for(let dy=-1;dy<=1;dy++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
  const location={x:x+dx,y:y+dy,z:z+dz};
  if((location.x+.5-origin.x)**2+(location.y-origin.y)**2+(location.z+.5-origin.z)**2>2.25**2)continue;
  const block=dimension.getBlock(location);
  const item=CROPS.get(block?.typeId);
  if(!item||block.permutation.getState('jagsby_nether:age')!==7)continue;
  if(dimension.getBlock({...location,y:location.y-1})?.typeId!=='jagsby_nether:soul_soil_farmland')continue;
  // Require a clear line of sight instead of harvesting through farm walls.
  const eye=v.getHeadLocation(),delta={x:location.x+.5-eye.x,y:location.y+.5-eye.y,z:location.z+.5-eye.z};
  const length=Math.hypot(delta.x,delta.y,delta.z);
  const hit=dimension.getBlockFromRay(eye,{x:delta.x/length,y:delta.y/length,z:delta.z/length},{maxDistance:length,includePassableBlocks:false,includeLiquidBlocks:true});
  if(hit&&(hit.block.location?.x!==location.x||hit.block.location?.y!==location.y||hit.block.location?.z!==location.z))continue;
  const mature=block.permutation,young=mature.withState('jagsby_nether:age',0);
  // Replant using the seed/propagule from this harvest; leave edible yield as a
  // real dropped item, handled by the existing breeding-food pickup bridge.
  block.setPermutation(young);
  try{dimension.spawnItem(new ItemStack(item,1),{x:location.x+.5,y:location.y+.5,z:location.z+.5});}
  catch(error){block.setPermutation(mature);throw error;}
  return true;
 }
 return false;
}
system.runInterval(()=>{
 for(const id of ['overworld','nether','the_end']){
  const dimension=world.getDimension(id);
  for(const v of dimension.getEntities({type:'minecraft:villager_v2'})){
   try{farmNearbyCrop(v);}catch(error){console.warn(`[Underworld villager farming] ${error}`);}
  }
 }
},20);
