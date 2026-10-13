import {world,system} from '@minecraft/server';
import {FOOD_BUFFS,readFoodBuff,foodBuffMultiplier} from './underworld_food_buff_state.js';
const cache=new Map();
export function refreshUnderworldFoodBuff(player){cache.set(player.id,readFoodBuff(player));}
export function underworldFoodBuffMultiplier(player,skill){
 if(!cache.has(player.id))refreshUnderworldFoodBuff(player);
 return foodBuffMultiplier(cache.get(player.id),skill);
}
world.afterEvents.itemCompleteUse.subscribe(({source,itemStack})=>{
 if(source?.typeId!=='minecraft:player'||!itemStack?.typeId.startsWith('jagsby_nether:'))return;
 if(FOOD_BUFFS[itemStack.typeId.slice('jagsby_nether:'.length)])system.run(()=>{
  try{refreshUnderworldFoodBuff(source);}catch{}
 });
});
world.afterEvents.playerSpawn.subscribe(({player})=>system.run(()=>{
 try{refreshUnderworldFoodBuff(player);}catch{}
}));
world.afterEvents.playerLeave.subscribe(({playerId})=>cache.delete(playerId));
