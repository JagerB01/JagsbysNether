import {ItemStack} from '@minecraft/server';
import {AGE,CROPS,HEATED,ATTACHED,canGrow,setState,offset} from '../agriculture/crops.js';
export const MOB='jagsby_nether:glowsquito',HIVE='jagsby_nether:glowhusk',WAX='jagsby_nether:glow_wax';
export const LEVEL='jagsby_nether:wax_level',HOME='underworld_glowsquito:home',POLLEN='underworld_glowsquito:pollen',INSIDE='underworld_glowsquito:inside';
export const PREFIX='underworld_glowhusk:';
const CROPS_TO_HELP=new Set(['jagsby_nether:rye_crop','jagsby_nether:murky_gourd_stem','jagsby_nether:scarberry_bush']);
const center=p=>({x:p.x+.5,y:p.y+.5,z:p.z+.5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function hiveKey(block){const p=block.location;return `${PREFIX}${block.dimension.id}:${p.x},${p.y},${p.z}`;}
function parse(value){try{return JSON.parse(value??'null');}catch{return null;}}
function read(d,p){try{return d.getBlock(p);}catch{return undefined;}}
export function campfireCalms(block){
 for(let depth=1;depth<=5;depth++){
  const b=read(block.dimension,{...block.location,y:block.location.y-depth});if(!b)return false;
  if(['minecraft:campfire','minecraft:soul_campfire'].includes(b.typeId))return b.permutation.getState('extinguished')!==true;
  if(b.isSolid&&!b.typeId.endsWith('_trapdoor'))return false;
 }
 return false;
}
export function helpCrop(bee,rng=Math.random){
 if(bee.dimension.id!=='minecraft:nether'||rng()>=.03)return false;
 const p={x:Math.floor(bee.location.x),y:Math.floor(bee.location.y)-1,z:Math.floor(bee.location.z)};
 for(let depth=0;depth<2;depth++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
  const block=read(bee.dimension,{x:p.x+x,y:p.y-depth,z:p.z+z});
  if(!block||!CROPS_TO_HELP.has(block.typeId)||!canGrow(block))continue;
  const age=block.permutation.getState(AGE),max=CROPS[block.typeId]?.max;
  if(!Number.isInteger(age)||age>=max||block.permutation.getState(ATTACHED))continue;
  // Retain the existing one-third rate on dry/warming soil; bushes need no heat.
  const heated=block.typeId==='jagsby_nether:scarberry_bush'||offset(block,0,-1,0)?.permutation.getState(HEATED)===true;
  if(!heated&&rng()>=1/3)return false;
  setState(block,AGE,age+1);return true;
 }
 return false;
}
function exitPosition(block){
 for(const [x,y,z] of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,0,0]]){
  const p={x:block.location.x+x,y:block.location.y+y,z:block.location.z+z},b=read(block.dimension,p);
  if(b?.isAir)return center(p);
 }
 return undefined;
}
export function createColonyController({world,system,rng=Math.random,crop=helpCrop}={}){
 const cache=new Map(),active=new Map();let scheduled=false,serial=0;
 function record(key){
  if(cache.has(key))return cache.get(key);
  const value=parse(world.getDynamicProperty(key));if(value?.v===1&&Array.isArray(value.occupants)){cache.set(key,value);return value;}
 }
 function save(key,value){world.setDynamicProperty(key,value?JSON.stringify(value):undefined);if(value)cache.set(key,value);else cache.delete(key);if(cache.size>256)cache.delete(cache.keys().next().value);}
 function home(bee){return parse(bee.getDynamicProperty(HOME));}
 function homeBlock(h){try{return read(world.getDimension(h.dimension),h.position);}catch{return undefined;}}
 function eligible(bee){return bee?.typeId===MOB&&bee.isValid!==false;}
 function event(bee,name){bee.triggerEvent(`jagsby_nether:${name}`);}
 function ensureHive(block){
  if(block.typeId!==HIVE)return undefined;
  const key=hiveKey(block);let r=record(key);
  if(!r){r={v:1,token:`${Date.now()}-${++serial}-${rng().toString(36).slice(2)}`,occupants:[]};save(key,r);}
  return r;
 }
 function forgetHome(bee){
  const h=home(bee),r=h&&record(h.key);
  if(r?.token===h.token&&r.occupants.includes(bee.id)){r.occupants=r.occupants.filter(id=>id!==bee.id);save(h.key,r);}
  bee.setDynamicProperty(HOME,undefined);bee.setDynamicProperty(INSIDE,undefined);
  event(bee,'homeless');if(!bee.hasComponent('minecraft:is_baby'))event(bee,'forage');
  bee.setDynamicProperty(POLLEN,undefined);active.delete(bee.id);
 }
 function remember(bee){
  if(!eligible(bee))return;
  if(!bee.getDynamicProperty(INSIDE)&&(home(bee)||bee.getDynamicProperty(POLLEN))){active.set(bee.id,bee);schedule();}
 }
 function schedule(){if(scheduled||!active.size)return;scheduled=true;system.runTimeout(step,40);}
 function step(){
  scheduled=false;const count=Math.min(4,active.size);
  for(let i=0;i<count;i++){
   const [id,bee]=active.entries().next().value;active.delete(id);
   try{
    if(!eligible(bee)||bee.getDynamicProperty(INSIDE))continue;
    const h=home(bee);
    if(h){
     const block=homeBlock(h),r=record(h.key);
     if(bee.dimension.id!==h.dimension||block&&block.typeId!==HIVE||r?.token!==h.token){forgetHome(bee);continue;}
     if(block&&distance(bee.location,center(h.position))>16){
      const p=exitPosition(block);if(p){bee.clearVelocity();bee.teleport(p);}
     }
    }
    if(world.gameRules?.mobGriefing!==false&&bee.getDynamicProperty(POLLEN)&&!bee.hasComponent('minecraft:is_baby'))crop(bee,rng);
    if(h||bee.getDynamicProperty(POLLEN))active.set(id,bee);
   }catch(error){console.warn(`[Underworld Glowsquito] ${error}`);}
  }
  schedule();
 }
 function reject(bee){bee.setDynamicProperty(POLLEN,undefined);event(bee,'reject_home');active.delete(bee.id);}
 function enter(block,bee){
  if(!eligible(bee)||bee.hasComponent('minecraft:is_baby')||bee.getDynamicProperty(INSIDE))return false;
  const h=home(bee),r=ensureHive(block);
  if(!h||h.dimension!==bee.dimension.id||block.dimension.id!==bee.dimension.id||!r||h.key!==hiveKey(block)||r.token!==h.token||!r.occupants.includes(bee.id))return false;
  // Pollen and phase are entity-persistent guards, independent of deferred client properties.
  const pollen=bee.getDynamicProperty(POLLEN)===true;
  bee.clearVelocity();bee.teleport(center(block.location));
  event(bee,'enter');bee.setDynamicProperty(INSIDE,true);active.delete(bee.id);
  if(pollen){
   const level=block.permutation.getState(LEVEL)??0;
   if(level<5)block.setPermutation(block.permutation.withState(LEVEL,level+1));
  }
  bee.setDynamicProperty(POLLEN,undefined);return true;
 }
 function reach(block,bee){
  if(block.typeId!==HIVE||!eligible(bee)||block.dimension.id!==bee.dimension.id||bee.hasComponent('minecraft:is_baby'))return false;
  let h=home(bee);
  if(h&&h.dimension!==bee.dimension.id){forgetHome(bee);h=undefined;}
  if(h){
   const own=homeBlock(h),r=record(h.key);
   if(!own)return false; // A missing/unloaded block is never interpreted as a destroyed home.
   if(own.typeId!==HIVE||r?.token!==h.token){forgetHome(bee);h=undefined;}
   else {
    if(!r.occupants.includes(bee.id)){
     if(r.occupants.length>=3){forgetHome(bee);return false;}
     r.occupants.push(bee.id);save(h.key,r);
    }
    // Native move-to-block cannot target a unique custom hive. Correct only on
    // arrival at another hive, never steer every tick or steal another colony.
    return enter(own,bee);
   }
  }
  const r=ensureHive(block);
  if(r.occupants.length>=3){reject(bee);return false;}
  h={key:hiveKey(block),token:r.token,dimension:block.dimension.id,position:{...block.location}};
  bee.setDynamicProperty(HOME,JSON.stringify(h));
  if(!r.occupants.includes(bee.id)){r.occupants.push(bee.id);save(h.key,r);}
  event(bee,'claim_home');remember(bee);
  if(bee.getDynamicProperty(POLLEN))return enter(block,bee);
  return true;
 }
 function wake(bee){
  if(!eligible(bee)||!bee.getDynamicProperty(INSIDE))return false;
  const h=home(bee);if(!h||h.dimension!==bee.dimension.id){forgetHome(bee);return true;}
  const block=homeBlock(h);if(!block)return false;
  const r=record(h.key),p=exitPosition(block);if(!p)return false;
  bee.clearVelocity();bee.teleport(p);bee.setDynamicProperty(INSIDE,undefined);
  if(block.typeId!==HIVE||r?.token!==h.token){forgetHome(bee);return true;}
  event(bee,'exit');remember(bee);return true;
 }
 function load(bee){
  if(!eligible(bee))return;
  const h=home(bee);
  if(h){
   const b=homeBlock(h),r=record(h.key);
   if(b&&(b.typeId!==HIVE||r?.token!==h.token)){
    if(bee.getDynamicProperty(INSIDE)){wake(bee);return;}
    forgetHome(bee);return;
   }
  }
  remember(bee);
 }
 function pollinated(bee){
  if(!eligible(bee)||bee.hasComponent('minecraft:is_baby')||bee.getDynamicProperty(INSIDE))return;
  bee.setDynamicProperty(POLLEN,true);remember(bee);
 }
 function clearedPollen(bee){if(!eligible(bee))return;bee.setDynamicProperty(POLLEN,undefined);if(!home(bee))active.delete(bee.id);}
 function destroy(block){
  const key=hiveKey(block),r=record(key);if(!r)return;
  save(key,undefined);
  for(const id of r.occupants){
   const bee=world.getEntity(id);if(!eligible(bee))continue;
   const h=home(bee);if(h?.key!==key||h.token!==r.token)continue;
   if(bee.getDynamicProperty(INSIDE)){const p=exitPosition(block);if(p){bee.clearVelocity();bee.teleport(p);}}
   forgetHome(bee);
  }
 }
 function died(bee){
  if(bee?.typeId!==MOB)return;active.delete(bee.id);
  const h=home(bee),r=h&&record(h.key);
  if(r?.token===h.token){r.occupants=r.occupants.filter(id=>id!==bee.id);save(h.key,r);}
 }
 function harvest(block,player){
  if(block.typeId!==HIVE||!player||player.getGameMode()==='Spectator'||block.permutation.getState(LEVEL)!==5)return false;
  const inventory=player.getComponent('minecraft:inventory')?.container,slot=player.selectedSlotIndex,tool=inventory?.getItem(slot);
  if(tool?.typeId!=='minecraft:shears')return false;
  // Reserve the cycle before delivery; re-entrant interactions see level zero.
  block.setPermutation(block.permutation.withState(LEVEL,0));
  let collected=false;
  try{
   const overflow=inventory.addItem(new ItemStack(WAX,1));collected=!overflow;
   if(overflow)block.dimension.spawnItem(overflow,{...center(block.location),y:block.location.y+1.1});
  }catch(error){block.setPermutation(block.permutation.withState(LEVEL,5));throw error;}
  if(player.getGameMode()!=='Creative'){
   const durability=tool.getComponent('minecraft:durability'),unbreaking=tool.getComponent('minecraft:enchantable')?.getEnchantment('unbreaking')?.level??0;
   if(durability&&rng()<1/(unbreaking+1)){durability.damage++;inventory.setItem(slot,durability.damage>=durability.maxDurability?undefined:tool);}
  }
  if(!campfireCalms(block)){
   for(const id of ensureHive(block).occupants){const bee=world.getEntity(id);if(!eligible(bee))continue;if(bee.getDynamicProperty(INSIDE))wake(bee);event(bee,'defend');}
  }
  // MineScape 1.5.18 already exposes this successful-collection hook. No pack
  // edits, dependency, XP polling, dispenser XP or command-side XP injection.
  if(collected)try{player.runCommand(`scriptevent minescape:apiary_harvest ${JSON.stringify({playerId:player.id,count:1})}`);}catch{/* Optional compatibility receiver or command unavailable. */}
  try{block.dimension.playSound('mob.sheep.shear',center(block.location));}catch{}
  return true;
 }
 function placed(block){if(record(hiveKey(block)))destroy(block);return ensureHive(block);}
 return {placed,ensureHive,reach,enter,wake,load,pollinated,clearedPollen,destroy,died,harvest,remove:id=>active.delete(id),active,record};
}
