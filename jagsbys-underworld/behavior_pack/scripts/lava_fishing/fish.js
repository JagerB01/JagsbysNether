// SPDX-License-Identifier: AGPL-3.0-only
import {FISH,isLava,read} from './angling.js';
const motion=new Map();
const family='jagsby_lava_fish';
const amphibious=new Set(['flame_squat_lobster','scaly_foot_snail','yeti_crab']);
const integer=(rng,min,max)=>min+Math.floor(rng()*(max-min+1));
function sourceLava(dimension,p){return isLava(read(dimension,p)) && (read(dimension,p)?.permutation.getState('liquid_depth') ?? 0)===0;}
export function validFishSpawn(dimension,p){
 return p.y>=0 && p.y<=31 && [[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(([x,z])=>sourceLava(dimension,{...p,x:p.x+x,z:p.z+z}));
}
export function updateFish(players,tick,rng=Math.random){
 const seen=new Set();
 for(const player of players){
  if(player.dimension.id!=='minecraft:nether' || player.getGameMode()==='Spectator')continue;
  const dimension=player.dimension;
  const nearby=dimension.getEntities({families:[family],location:player.location,maxDistance:48});
  // A small bounded school budget, sampled only in source-lava oceans below Y32.
  if(tick%100===0 && nearby.length<12){
   for(let attempt=0;attempt<8;attempt++){
    const p={x:Math.floor(player.location.x)+integer(rng,-32,32),y:integer(rng,20,31),z:Math.floor(player.location.z)+integer(rng,-32,32)};
    if(Math.hypot(p.x-player.location.x,p.y-player.location.y,p.z-player.location.z)<12 || !validFishSpawn(dimension,p))continue;
    const fish=dimension.spawnEntity(`jagsby_nether:${FISH[integer(rng,0,FISH.length-1)]}`,{x:p.x+0.5,y:p.y+0.2,z:p.z+0.5});
    fish.triggerEvent('jagsby_nether:swimming');break;
   }
  }
  for(const fish of nearby){
   if(seen.has(fish.id))continue;seen.add(fish.id);
   try{
    const inLava=isLava(read(dimension,fish.location));
    let state=motion.get(fish.id);
    if(!state){state={dx:0,dz:0,until:0,lava:undefined};motion.set(fish.id,state);}
    if(state.lava!==inLava){fish.triggerEvent(inLava?'jagsby_nether:swimming':'jagsby_nether:land');state.lava=inLava;}
    if(inLava){
     if(tick>=state.until){const angle=rng()*Math.PI*2;state.dx=Math.sin(angle)*0.25;state.dz=Math.cos(angle)*0.25;state.until=tick+integer(rng,40,100);}
     const dx=fish.location.x-player.location.x,dz=fish.location.z-player.location.z,length=Math.hypot(dx,dz);
     if(length>0 && length<8){state.dx=dx/length*0.4;state.dz=dz/length*0.4;}
     const next={x:fish.location.x+state.dx,y:fish.location.y,z:fish.location.z+state.dz};
     if(isLava(read(dimension,next)) && isLava(read(dimension,{...next,y:next.y+0.3})))fish.teleport(next,{rotation:{x:0,y:-Math.atan2(state.dx,state.dz)*180/Math.PI}});
     else state.until=0;
    }else if(tick%20===0){
     const type=fish.typeId.split(':')[1],block=read(dimension,fish.location);
     if(block?.typeId.includes('water') || !amphibious.has(type))fish.applyDamage(1);
    }
   }catch{/* An entity may unload or die during this update. */}
  }
 }
 for(const id of motion.keys())if(!seen.has(id))motion.delete(id);
}

export function applyFishFood(player,type,now=Date.now()){
 if(!player || player.typeId!=='minecraft:player')return;
 switch(type){
  case 'jagsby_nether:obsidian_sword_fish':player.addEffect('fire_resistance',300);break;
  case 'jagsby_nether:flame_squat_lobster':player.addEffect('resistance',400);player.setOnFire(5,true);break;
  case 'jagsby_nether:agni_fish':player.setDynamicProperty('jagsby_nether:endless_flame_until',now+120000);break;
  case 'jagsby_nether:steam_flying_fish':player.setDynamicProperty('jagsby_nether:lava_walker_until',now+15000);break;
 }
}
export function updateFishEffects(players,tick,now=Date.now()){
 for(const player of players){
  if(player.getGameMode()==='Spectator')continue;
  const flame=player.getDynamicProperty('jagsby_nether:endless_flame_until');
  if(typeof flame==='number'){
   if(now>=flame)player.setDynamicProperty('jagsby_nether:endless_flame_until',undefined);
   else if(tick%20===0){player.setOnFire(1,true);player.applyDamage(2,{cause:'fireTick'});}
  }
  const walker=player.getDynamicProperty('jagsby_nether:lava_walker_until');
  if(typeof walker==='number'){
   if(now>=walker)player.setDynamicProperty('jagsby_nether:lava_walker_until',undefined);
   else if(!player.isSneaking){
    const p=player.location,feet=read(player.dimension,p),below=read(player.dimension,{...p,y:p.y-0.2});
    if(isLava(feet)){
     const above=read(player.dimension,{...p,y:Math.floor(p.y)+1});
     if(above?.isAir)player.teleport({...p,y:Math.floor(p.y)+1});
     else player.applyImpulse({x:0,y:0.1,z:0});
    }else if(isLava(below) && player.getVelocity().y<0)player.teleport({...p,y:Math.floor(p.y-0.2)+1});
   }
  }
 }
}
