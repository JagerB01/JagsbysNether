// SPDX-License-Identifier: AGPL-3.0-only
// Fishing-only Bedrock adaptation of TeamSunset Lava Fishing 1.3.1.
import {ItemStack} from '@minecraft/server';
export const ROD='jagsby_nether:obsidian_fishing_rod';
export const FISH=['flame_squat_lobster','obsidian_sword_fish','steam_flying_fish','agni_fish','arowana_fish','quartz_fish','scaly_foot_snail','yeti_crab','lava_lamprey'];
const LAVA=new Set(['minecraft:lava','minecraft:flowing_lava']);
export function isLava(block){return !!block && LAVA.has(block.typeId);}
export function read(dimension,position){try{return dimension.getBlock({x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z)});}catch{return undefined;}}
export function fishPool(dimension,biome){
 if(dimension!=='minecraft:nether')return [['flame_squat_lobster',34],['obsidian_sword_fish',33],['arowana_fish',33]];
 const pool=[['base',30],['lava_lamprey',12],['quartz_fish',12]];
 if(biome===2)pool.push(['agni_fish',10]);
 if(biome===3)pool.push(['steam_flying_fish',12]);
 if(biome===4)pool.push(['scaly_foot_snail',12],['yeti_crab',12]);
 return pool;
}
export function weighted(pool,rng){let roll=rng()*pool.reduce((n,[,weight])=>n+weight,0);for(const [id,weight] of pool){roll-=weight;if(roll<0)return id;}return pool.at(-1)[0];}
export function catchFish(dimension,biome,rng=Math.random){const fish=weighted(fishPool(dimension,biome),rng);return fish==='base'?weighted(fishPool('minecraft:overworld',0),rng):fish;}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const range=(rng,min,max)=>min+Math.floor(rng()*(max-min+1));
function held(player){const container=player.getComponent('minecraft:inventory')?.container;const slot=player.selectedSlotIndex;return {container,slot,item:container?.getItem(slot)};}
function level(item,name){return item?.getComponent('minecraft:enchantable')?.getEnchantment(name)?.level ?? 0;}
function cue(player,sound,position){try{player.dimension.playSound(sound,position);}catch{/* Optional vanilla sound availability varies by game version. */}}
function particle(dimension,id,position){try{dimension.spawnParticle(id,position);}catch{/* Effects never determine the catch result. */}}

// Read liquid blocks directly: native block raycasts can miss passable lava.
// A normal forward cast also falls into lava below the player's crosshair.
export function findLavaTarget(player){
 const start=player.getHeadLocation(),view=player.getViewDirection();
 const inspect=position=>{
  const block=read(player.dimension,position);
  if(!block)return {stop:true};
  if(isLava(block)){
   const location={x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z)};
   if(!read(player.dimension,{...location,y:location.y+1})?.isAir)return {stop:true};
   return {stop:true,hit:{block:location,target:{x:position.x,y:location.y+0.9,z:position.z}}};
  }
  return {stop:!block.isAir && !['minecraft:crimson_roots','minecraft:warped_roots','minecraft:nether_sprouts'].includes(block.typeId)};
 };
 for(let d=0.15;d<=32;d+=0.15){
  const result=inspect({x:start.x+view.x*d,y:start.y+view.y*d,z:start.z+view.z*d});
  if(result.hit)return result.hit;
  if(result.stop)break;
 }
 const position={...start},velocity={x:view.x*1.2,y:view.y*1.2+0.18,z:view.z*1.2};
 for(let step=0;step<400;step++){
  position.x+=velocity.x*0.15;position.y+=velocity.y*0.15;position.z+=velocity.z*0.15;velocity.y-=0.05*0.15;
  if(distance(start,position)>32)break;
  const result=inspect(position);
  if(result.hit)return result.hit;
  if(result.stop)break;
 }
 return undefined;
}

export function createAnglingController({rng=Math.random}={}){
 const sessions=new Map(),lastUses=new Map();let serial=0;
 function cancel(id){const session=sessions.get(id);if(!session)return;try{session.bobber.remove();}catch{/* Already unloaded/removed. */}sessions.delete(id);}
 function identity(item){return item.getDynamicProperty('jagsby_nether:rod_id');}
 function use(player,tick){
  if(player?.typeId!=='minecraft:player' || player.getGameMode()==='Spectator')return false;
  const equipment=held(player);if(equipment.item?.typeId!==ROD)return false;
  if(tick-(lastUses.get(player.id) ?? -Infinity)<4)return false;
  lastUses.set(player.id,tick);
  const active=sessions.get(player.id);
  if(active){
   // onUse/onUseOn can both run for the same native interaction.
   if(active.slot!==equipment.slot || identity(equipment.item)!==active.rodId){cancel(player.id);return false;}
   if(active.state==='bite' && tick<active.deadline && active.dimensionId===player.dimension.id && distance(player.location,active.target)<=32 && isLava(read(player.dimension,active.block))){
    const id=catchFish(active.dimensionId,active.biome,rng);
    // Inserting into the inventory avoids burning catches or losing them in lava.
    const remainder=equipment.container.addItem(new ItemStack(`jagsby_nether:${id}`,1));
    if(remainder)player.dimension.spawnItem(remainder,player.location);
    if(player.getGameMode()!=='Creative'){
     const durability=equipment.item.getComponent('minecraft:durability');
     const chance=durability?.getDamageChance(level(equipment.item,'unbreaking')) ?? 100;
     if(durability && rng()*100<chance){durability.damage++;equipment.container.setItem(equipment.slot,durability.damage>=durability.maxDurability?undefined:equipment.item);}
    }
    player.addExperience(range(rng,1,6));
    player.onScreenDisplay?.setActionBar(`Caught ${id.replaceAll('_',' ')}!`);
   }
   cue(player,'random.bow',active.target);cancel(player.id);return true;
  }
  const hit=findLavaTarget(player);
  if(!hit){player.onScreenDisplay?.setActionBar('Cast toward exposed lava within 32 blocks.');return false;}
  const {block,target}=hit;
  let rodId=identity(equipment.item);
  if(!rodId){rodId=`${player.id}:${tick}:${serial++}`;equipment.item.setDynamicProperty('jagsby_nether:rod_id',rodId);equipment.container.setItem(equipment.slot,equipment.item);}
  const start=player.getHeadLocation();
  const bobber=player.dimension.spawnEntity('jagsby_nether:lava_bobber',start);
  sessions.set(player.id,{bobber,rodId,slot:equipment.slot,dimensionId:player.dimension.id,start,target,visual:start,block,state:'casting',startTick:tick,lastUse:tick,lure:level(equipment.item,'lure')});
  cue(player,'random.bow',start);return true;
 }
 function update(players,tick){
  const online=new Map(players.map(player=>[player.id,player]));
  for(const id of lastUses.keys())if(!online.has(id))lastUses.delete(id);
  for(const [id,s] of sessions){
   const player=online.get(id);
   try{
    const equipment=player&&held(player);
    if(!player || player.getGameMode()==='Spectator' || player.dimension.id!==s.dimensionId || equipment.slot!==s.slot || equipment.item?.typeId!==ROD || identity(equipment.item)!==s.rodId || distance(player.location,s.target)>32 || !s.bobber.isValid || !isLava(read(player.dimension,s.block))){cancel(id);continue;}
    if(tick%600===0)s.bobber.triggerEvent('jagsby_nether:keep_alive');
    if(s.state==='casting'){
     const t=Math.min(1,(tick-s.startTick)/12);
     s.visual={x:s.start.x+(s.target.x-s.start.x)*t,y:s.start.y+(s.target.y-s.start.y)*t+Math.sin(t*Math.PI)*1.5,z:s.start.z+(s.target.z-s.start.z)*t};
     s.bobber.teleport(s.visual);
     if(t===1){s.bobber.triggerEvent('jagsby_nether:classify');s.state='classifying';s.deadline=tick+2;}
    }else if(s.state==='classifying' && tick>=s.deadline){
     s.biome=s.bobber.getProperty('jagsby_nether:fishing_biome');
     if(![0,1,2,3,4].includes(s.biome) || (s.dimensionId==='minecraft:nether' && s.biome===0))throw Error('Unable to classify fishing biome');
     s.state='waiting';s.deadline=tick+Math.max(20,range(rng,100,600)-s.lure*100);
    }else if(s.state==='waiting' && tick>=s.deadline){s.state='approaching';s.deadline=tick+range(rng,20,80);
    }else if(s.state==='approaching'){
     if(tick%5===0)particle(player.dimension,'minecraft:lava_particle',s.target);
     if(tick>=s.deadline){s.state='bite';s.deadline=tick+range(rng,20,40);cue(player,'random.splash',s.target);particle(player.dimension,'minecraft:lava_particle',s.target);player.onScreenDisplay?.setActionBar('Bite! Reel in!');}
    }else if(s.state==='bite' && tick>=s.deadline){s.state='waiting';s.deadline=tick+Math.max(20,range(rng,100,600)-s.lure*100);}
    if(!['casting','classifying'].includes(s.state)){s.visual={...s.target,y:s.target.y+(s.state==='bite'?-0.18:Math.sin(tick/5)*0.04)};s.bobber.teleport(s.visual);}
    const hand=player.getHeadLocation(),dx=hand.x-s.visual.x,dy=hand.y-0.4-s.visual.y,dz=hand.z-s.visual.z;
    s.bobber.setProperty('jagsby_nether:line_length',Math.min(40,Math.hypot(dx,dy,dz)));
    s.bobber.setProperty('jagsby_nether:line_yaw',Math.atan2(dx,dz)*180/Math.PI);
    s.bobber.setProperty('jagsby_nether:line_pitch',-Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI);
   }catch(error){console.warn(`[Underworld lava fishing] ${error}`);cancel(id);}
  }
 }
 return {use,update,cancel,sessions};
}
