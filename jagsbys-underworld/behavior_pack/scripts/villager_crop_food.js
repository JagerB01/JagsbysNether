import {world,system,ItemStack} from '@minecraft/server';

export const VILLAGER_CROPS=new Set(['jagsby_nether:rye','jagsby_nether:polyp']);
export const VILLAGER_PICKUP_RANGE=1.5;
const TYPES=['minecraft:villager_v2','minecraft:villager'];
const CREDIT='jagsby_nether:crop_food_credit';
const tracked=new Map();
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
const inventory=v=>v.getComponent('minecraft:inventory')?.container;
function foodPoints(bag){
 let points=0;
 for(let i=0;i<bag.size;i++){
  const item=bag.getItem(i);if(!item)continue;
  if(item.typeId==='minecraft:bread')points+=4*item.amount;
  else if(['minecraft:carrot','minecraft:potato','minecraft:beetroot'].includes(item.typeId))points+=item.amount;
 }
 return points;
}
export function eligibleVillager(v){
 return v.isValid!==false&&TYPES.includes(v.typeId)&&!v.hasComponent('minecraft:is_baby');
}
function planFood(v,amount){
 if(!eligibleVillager(v))return;
 const bag=inventory(v);if(!bag)return;
 const points=foodPoints(bag);if(points>=12)return;
 const oldCredit=v.getDynamicProperty(CREDIT);
 const credit=typeof oldCredit==='number'?Math.max(0,Math.min(3,Math.floor(oldCredit))):0;
 const consumed=Math.min(amount,Math.ceil((12-points)/4)*4-credit);
 if(consumed<=0)return;
 let slot=-1;
 for(let i=0;i<bag.size;i++){
  const item=bag.getItem(i);
  if(item?.typeId==='minecraft:bread'){slot=i;break;}
  if(!item&&slot<0)slot=i;
 }
 if(slot<0)return;
 const before=bag.getItem(slot),reward=Math.floor((credit+consumed)/4);
 const after=reward?(before?before.clone():new ItemStack('minecraft:bread',reward)):undefined;
 if(after){after.amount=(before?.amount??0)+reward;}
 return {bag,slot,before,after,oldCredit,credit:(credit+consumed)%4,consumed};
}
export function tryFeedDroppedCrop(drop){
 if(drop.isValid===false||drop.typeId!=='minecraft:item'||world.gameRules.mobGriefing===false)return 0;
 const stack=drop.getComponent('minecraft:item')?.itemStack;
 if(!stack||!VILLAGER_CROPS.has(stack.typeId))return 0;
 const {dimension,location}=drop;
 const candidates=new Map();
 for(const type of TYPES)for(const v of dimension.getEntities({type,location,maxDistance:VILLAGER_PICKUP_RANGE})){
  if(eligibleVillager(v)&&distance(location,v.location)<=VILLAGER_PICKUP_RANGE**2)candidates.set(v.id,v);
 }
 for(const villager of [...candidates.values()].sort((a,b)=>distance(location,a.location)-distance(location,b.location))){
  const plan=planFood(villager,stack.amount);if(!plan)continue;
  const original=stack.clone();let remainder;
  // Create the untouched remainder first. If this fails, nothing is consumed.
  if(stack.amount>plan.consumed){const left=stack.clone();left.amount-=plan.consumed;remainder=dimension.spawnItem(left,location);}
  try{drop.remove();}catch(error){remainder?.remove();throw error;}
  let foodWritten=false;
  try{
   if(plan.after){plan.bag.setItem(plan.slot,plan.after);foodWritten=true;}
   villager.setDynamicProperty(CREDIT,plan.credit);
  }catch(error){
   // Keep failed inventory writes from granting food while retaining the crops.
   if(foodWritten)plan.bag.setItem(plan.slot,plan.before);
   remainder?.remove();dimension.spawnItem(original,location);throw error;
  }
  return plan.consumed;
 }
 return 0;
}
function watch(drop){
 if(drop.isValid===false||drop.typeId!=='minecraft:item')return;
 const stack=drop.getComponent('minecraft:item')?.itemStack;
 if(stack&&VILLAGER_CROPS.has(stack.typeId))tracked.set(drop.id,drop);
}
function register({entity}){
 if(entity.typeId==='minecraft:item')system.run(()=>{try{watch(entity);}catch{}});
}
world.afterEvents.entitySpawn.subscribe(register);
world.afterEvents.entityLoad.subscribe(register);
system.run(()=>{
 for(const id of ['overworld','nether','the_end'])for(const drop of world.getDimension(id).getEntities({type:'minecraft:item'}))watch(drop);
});
// Track only custom crop drops. A fixed per-pass budget avoids a global mob scan.
system.runInterval(()=>{
 const selected=[];
 for(const pair of tracked){selected.push(pair);if(selected.length===64)break;}
 for(const [id,drop] of selected){
  tracked.delete(id);
  try{
   if(drop.isValid===false)continue;
   if(!tryFeedDroppedCrop(drop))watch(drop);
  }catch(error){console.warn(`[Underworld villager crop food] ${error}`);if(drop.isValid!==false)watch(drop);}
 }
},10);
