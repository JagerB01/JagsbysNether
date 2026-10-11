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
function cue(player,sound,position,options){try{player.dimension.playSound(sound,position,options);}catch{/* Optional vanilla sound availability varies by game version. */}}
function particle(dimension,id,position){try{dimension.spawnParticle(id,position);}catch{/* Effects never determine the catch result. */}}

// AdvancedFishing's working approach: native entity motion for the cast,
// then a surface anchor. Sample the traveled path to catch steep casts too.
function lavaContact(dimension,from,to){
 const count=Math.max(1,Math.ceil(distance(from,to)*4));
 for(let i=0;i<=count;i++){
  const t=i/count,point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t};
  for(const y of [point.y,point.y-0.25]){
   const block={x:Math.floor(point.x),y:Math.floor(y),z:Math.floor(point.z)};
   if(!isLava(read(dimension,block)))continue;
   let surface=block.y;
   for(let j=0;j<16 && isLava(read(dimension,{...block,y:surface+1}));j++)surface++;
   if(!read(dimension,{...block,y:surface+1})?.isAir)continue;
   return {block:{...block,y:surface},target:{x:point.x,y:surface+0.92,z:point.z}};
  }
 }
 return undefined;
}

// Short-lived black particles avoid model-space yaw mistakes and float actor
// properties. The curve is recomputed in world coordinates as the player moves.
export function linePoints(start,end){
 const length=distance(start,end),steps=Math.max(40,Math.min(220,Math.ceil(length/0.022)));
 const sag=Math.min(0.65,length*0.048);
 return Array.from({length:steps+1},(_,i)=>{
  const t=i/steps;
  return {x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t-Math.sin(t*Math.PI)*sag,z:start.z+(end.z-start.z)*t};
 });
}

export function createAnglingController({rng=Math.random}={}){
 const sessions=new Map(),lastUses=new Map();let serial=0;
 function cancel(id){const session=sessions.get(id);if(!session)return;try{session.bobber.remove();}catch{/* Already unloaded/removed. */}sessions.delete(id);}
 function identity(item){return item.getDynamicProperty('jagsby_nether:rod_id');}
 function swing(player){
  try{player.playAnimation('animation.jagsby_nether.fishing_use',{blendOutTime:0.05});}
  catch(error){console.warn(`[Underworld lava fishing] Rod swing unavailable: ${error}`);}
 }
 function throwSound(player){cue(player,'random.bow',player.location,{volume:0.5,pitch:0.33+Math.random()*0.17});}
 function use(player,tick){
  if(player?.typeId!=='minecraft:player' || player.getGameMode()==='Spectator')return false;
  const equipment=held(player);if(equipment.item?.typeId!==ROD)return false;
  if(tick-(lastUses.get(player.id) ?? -Infinity)<4)return false;
  lastUses.set(player.id,tick);
  const active=sessions.get(player.id);
  if(active){
   if(active.slot!==equipment.slot || identity(equipment.item)!==active.rodId){cancel(player.id);return false;}
   if(active.state==='bite' && tick<active.deadline && active.dimensionId===player.dimension.id && distance(player.location,active.visual)<=32 && isLava(read(player.dimension,active.block))){
    const id=catchFish(active.dimensionId,active.biome,rng);
    const remainder=equipment.container.addItem(new ItemStack(`jagsby_nether:${id}`,1));
    if(remainder)player.dimension.spawnItem(remainder,player.location);
    if(player.getGameMode()!=='Creative'){
     const durability=equipment.item.getComponent('minecraft:durability');
     const chance=durability?.getDamageChance(level(equipment.item,'unbreaking')) ?? 100;
     if(durability && rng()*100<chance){durability.damage++;equipment.container.setItem(equipment.slot,durability.damage>=durability.maxDurability?undefined:equipment.item);}
    }
    player.addExperience(range(rng,1,6));
    cue(player,'liquid.lavapop',player.location,{volume:0.9,pitch:1.2});
    cue(player,'random.fizz',player.location,{volume:0.35,pitch:1.6});
   }
   swing(player);throwSound(player);cancel(player.id);return true;
  }
  let rodId=identity(equipment.item);
  if(!rodId){rodId=`${player.id}:${tick}:${serial++}`;equipment.item.setDynamicProperty('jagsby_nether:rod_id',rodId);equipment.container.setItem(equipment.slot,equipment.item);}
  const head=player.getHeadLocation(),view=player.getViewDirection();
  // Raise the release above the rod-side shoulder, even when aiming down.
  const horizontal=Math.hypot(view.x,view.z);
  const yaw=player.getRotation().y*Math.PI/180;
  const forward=horizontal>0.001?{x:view.x/horizontal,z:view.z/horizontal}:{x:-Math.sin(yaw),z:Math.cos(yaw)};
  const start={x:head.x-forward.z*0.35+forward.x*0.35,y:head.y+0.35,z:head.z+forward.x*0.35+forward.z*0.35};
  const bobber=player.dimension.spawnEntity('jagsby_nether:lava_bobber',start);
  try{bobber.applyImpulse({x:view.x*1.75,y:view.y*1.75+0.38,z:view.z*1.75});}catch(error){bobber.remove();throw error;}
  sessions.set(player.id,{bobber,rodId,slot:equipment.slot,dimensionId:player.dimension.id,visual:start,state:'casting',startTick:tick,lastTick:tick,lure:level(equipment.item,'lure')});
  swing(player);throwSound(player);return true;
 }
 function update(players,tick){
  const online=new Map(players.map(player=>[player.id,player]));
  for(const id of lastUses.keys())if(!online.has(id))lastUses.delete(id);
  for(const [id,s] of sessions){
   const player=online.get(id);
   try{
    const equipment=player&&held(player);
    if(!player || player.getGameMode()==='Spectator' || player.dimension.id!==s.dimensionId || equipment.slot!==s.slot || equipment.item?.typeId!==ROD || identity(equipment.item)!==s.rodId || distance(player.location,s.visual)>32 || !s.bobber.isValid || (s.block && !isLava(read(player.dimension,s.block)))){cancel(id);continue;}
    if(tick%600===0)s.bobber.triggerEvent('jagsby_nether:keep_alive');
    if(s.state==='casting'){
     const current=s.bobber.location;
     const hit=lavaContact(player.dimension,s.visual,current);
     s.visual={...current};
     if(hit){
      s.block=hit.block;s.target=hit.target;s.visual={...hit.target};
      s.bobber.clearVelocity();s.bobber.triggerEvent('jagsby_nether:float');
      try{s.bobber.triggerEvent('jagsby_nether:classify');}catch(error){console.warn(`[Underworld lava fishing] Biome query failed: ${error}`);}
      s.state='classifying';s.deadline=tick+2;s.classifyTimeout=tick+40;
      cue(player,'random.splash',s.target,{volume:0.25,pitch:0.6+Math.random()*0.8});
      particle(player.dimension,'minecraft:lava_particle',{...s.target,y:s.target.y+0.12});
     }else if(s.bobber.isOnGround){s.state='grounded';}
    }else if(s.state==='classifying' && tick>=s.deadline){
     try{s.biome=s.bobber.getProperty('jagsby_nether:fishing_biome');}catch{s.biome=undefined;}
     if(![0,1,2,3,4].includes(s.biome) || (s.dimensionId==='minecraft:nether' && s.biome===0)){
      if(tick>=s.classifyTimeout){s.biome=s.dimensionId==='minecraft:nether'?1:0;console.warn('[Underworld lava fishing] Biome unavailable; using common fish pool.');}
      else s.biome=undefined;
     }
     if(s.biome!==undefined){s.state='waiting';s.deadline=tick+Math.max(20,range(rng,100,600)-s.lure*100);}
    }else if(s.state==='waiting' && tick>=s.deadline){s.state='approaching';s.approachStart=tick;s.deadline=tick+range(rng,20,80);s.approachAngle=Math.random()*Math.PI*2;
    }else if(s.state==='approaching'){
     if(tick%2===0 && tick<s.deadline){
      const radius=2*Math.max(0,s.deadline-tick)/Math.max(1,s.deadline-s.approachStart);
      particle(player.dimension,'minecraft:lava_particle',{x:s.target.x+Math.cos(s.approachAngle)*radius,y:s.target.y+0.12,z:s.target.z+Math.sin(s.approachAngle)*radius});
     }
     if(tick>=s.deadline){s.state='bite';s.biteStart=tick;s.deadline=tick+range(rng,20,40);cue(player,'random.splash',s.target,{volume:0.25,pitch:0.6+Math.random()*0.8});
      for(let spark=0;spark<12;spark++){
       const angle=spark*Math.PI/6,radius=spark%2===0?0.08:0.18;
       particle(player.dimension,'minecraft:lava_particle',{x:s.target.x+Math.cos(angle)*radius,y:s.target.y+0.12,z:s.target.z+Math.sin(angle)*radius});
      }}
    }else if(s.state==='bite' && tick>=s.deadline){s.state='waiting';s.deadline=tick+Math.max(20,range(rng,100,600)-s.lure*100);}
    if(!sessions.has(id))continue;
    if(['classifying','waiting','approaching','bite'].includes(s.state)){
     const dip=s.state==='bite'?0.32+Math.sin((tick-s.biteStart)*0.8)*0.025:Math.sin(tick/8)*0.025;
     s.visual={...s.target,y:s.target.y-dip};
    }
    if(['classifying','waiting','approaching','bite'].includes(s.state)){s.bobber.clearVelocity();s.bobber.teleport(s.visual,{rotation:{x:0,y:0}});}
    try{
     const head=player.getHeadLocation(),view=player.getViewDirection(),horizontal=Math.hypot(view.x,view.z)||1;
     const tip={x:head.x-view.z/horizontal*0.35+view.x*0.52,y:head.y-0.04+view.y*0.36,z:head.z+view.x/horizontal*0.35+view.z*0.52};
     const hook={...s.visual,y:s.visual.y+0.22};
     for(const point of linePoints(tip,hook))particle(player.dimension,'jagsby_nether:fishing_line',point);
    }catch(error){if(!s.lineWarning){console.warn(`[Underworld lava fishing] Line update failed: ${error}`);s.lineWarning=true;}}
   }catch(error){console.warn(`[Underworld lava fishing] ${error}`);cancel(id);}
  }
 }
 return {use,update,cancel,sessions};
}
