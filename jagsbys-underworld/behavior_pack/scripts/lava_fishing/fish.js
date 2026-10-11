// SPDX-License-Identifier: AGPL-3.0-only
import {isLava,read} from './angling.js';

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
