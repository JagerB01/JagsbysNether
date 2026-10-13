import {world,system} from '@minecraft/server';
import {FOOD_BUFFS,activateFoodBuff,readFoodBuff,clearExpiredFoodBuffs} from './state.js';
world.afterEvents.itemCompleteUse.subscribe(({source,itemStack})=>{
 if(source?.typeId!=='minecraft:player')return;
 const kind=itemStack?.typeId?.replace('jagsby_nether:','');if(!FOOD_BUFFS[kind])return;
 try{
  activateFoodBuff(source,kind);
  source.sendMessage(`§6${FOOD_BUFFS[kind].name}§r: 2× ${FOOD_BUFFS[kind].skills.join(', ')} passive bonuses for 20 minutes.`);
 }catch(error){console.warn(`[Underworld food buffs] ${error.message}`);}
});
world.afterEvents.playerSpawn.subscribe(({player})=>system.run(()=>{
 try{clearExpiredFoodBuffs(player);}catch{}
}));
system.afterEvents.scriptEventReceive.subscribe(({id,sourceEntity:player})=>{
 if(id!=='jagsby_nether:food_buff_status'||player?.typeId!=='minecraft:player')return;
 const buff=readFoodBuff(player);
 player.sendMessage(buff?`${FOOD_BUFFS[buff.kind].name}: ${Math.ceil((buff.expires-Date.now())/60000)} minutes remaining; 2× ${FOOD_BUFFS[buff.kind].skills.join(', ')}.`:'No active food buff.');
});
