// SPDX-License-Identifier: AGPL-3.0-only
import {system,world,ItemStack} from '@minecraft/server';
import {createAnglingController,clearLegacyRodProperties,ROD,FISH} from './angling.js';
import {applyFishFood,updateFishEffects} from './fish.js';
const controller=createAnglingController();
const use=({source})=>{try{controller.use(source,system.currentTick);}catch(error){controller.cancel(source?.id);console.warn(`[Underworld lava fishing] Cast/reel failed: ${error}`);}};
// AdvancedFishing uses the global item-use event for its instant-use rod.
// Keep that path too; the controller deduplicates it against component callbacks.
world.afterEvents.itemUse.subscribe(event=>{if(event.itemStack?.typeId===ROD)use(event);});
system.beforeEvents.startup.subscribe(({itemComponentRegistry})=>{
 itemComponentRegistry.registerCustomComponent('jagsby_nether:lava_fishing_rod',{onUse:use,onUseOn:use});
});
system.runInterval(()=>{
 const players=world.getAllPlayers();
 if(system.currentTick%20===0)for(const player of players)clearLegacyRodProperties(player);
 controller.update(players,system.currentTick);
 if(system.currentTick%10===0){updateFishEffects(players,system.currentTick);}
},1);
world.afterEvents.itemCompleteUse.subscribe(({source,itemStack})=>applyFishFood(source,itemStack?.typeId));
world.afterEvents.entityDie.subscribe(({deadEntity})=>{if(deadEntity?.typeId==='minecraft:player')controller.cancel(deadEntity.id);});
world.afterEvents.playerLeave.subscribe(({playerId})=>controller.cancel(playerId));
system.afterEvents.scriptEventReceive.subscribe(({id,sourceEntity:player})=>{
 if(id!=='jagsby_nether:fishing_kit' || player?.typeId!=='minecraft:player')return;
 const container=player.getComponent('minecraft:inventory')?.container;
 if(!container)return;
 for(const id of [ROD,...FISH.map(f=>`jagsby_nether:${f}`)]){
  const remainder=container.addItem(new ItemStack(id,1));
  if(remainder)player.dimension.spawnItem(remainder,player.location);
 }
 player.sendMessage('Obsidian rod and nine fish supplied. Use to cast toward lava, then use again when the bobber dips.');
});
