// SPDX-License-Identifier: AGPL-3.0-only
import {system,world,ItemStack} from '@minecraft/server';
import {createAnglingController,clearLegacyRodProperties,ROD,FISH} from './angling.js';
const controller=createAnglingController();
const castingPlayers=new Map();
function initializePlayer(player){
 clearLegacyRodProperties(player);
 // Retire persistent timers from versions with custom fish effects.
 for(const key of ['jagsby_nether:endless_flame_until','jagsby_nether:lava_walker_until']){
  if(player.getDynamicProperty(key)!==undefined)player.setDynamicProperty(key,undefined);
 }
}
const use=({source})=>{try{controller.use(source,system.currentTick);if(controller.sessions.has(source?.id))castingPlayers.set(source.id,source);}catch(error){controller.cancel(source?.id);console.warn(`[Underworld lava fishing] Cast/reel failed: ${error}`);}};
// AdvancedFishing uses the global item-use event for its instant-use rod.
// Keep that path too; the controller deduplicates it against component callbacks.
world.afterEvents.itemUse.subscribe(event=>{if(event.itemStack?.typeId===ROD)use(event);});
system.beforeEvents.startup.subscribe(({itemComponentRegistry})=>{
 itemComponentRegistry.registerCustomComponent('jagsby_nether:lava_fishing_rod',{onUse:use,onUseOn:use});
});
// Resolve already-online players once; subsequent work is driven by native events.
system.run(()=>{for(const player of world.getAllPlayers())initializePlayer(player);});
world.afterEvents.playerSpawn.subscribe(({player})=>initializePlayer(player));
world.afterEvents.playerInventoryItemChange.subscribe(({player,itemStack})=>{
 if(itemStack?.typeId===ROD)clearLegacyRodProperties(player);
});
system.runInterval(()=>{
 if(!castingPlayers.size)return;
 controller.update([...castingPlayers.values()],system.currentTick);
 for(const id of castingPlayers.keys())if(!controller.sessions.has(id))castingPlayers.delete(id);
},1);
world.afterEvents.entityDie.subscribe(({deadEntity})=>{
 if(deadEntity?.typeId==='minecraft:player'){controller.cancel(deadEntity.id);castingPlayers.delete(deadEntity.id);}
});
world.afterEvents.playerLeave.subscribe(({playerId})=>{controller.cancel(playerId);castingPlayers.delete(playerId);});
system.afterEvents.scriptEventReceive.subscribe(({id,sourceEntity:player})=>{
 if(id!=='jagsby_nether:fishing_kit' || player?.typeId!=='minecraft:player')return;
 const container=player.getComponent('minecraft:inventory')?.container;
 if(!container)return;
 for(const id of [ROD,...FISH.map(f=>`jagsby_nether:${f}`)]){
  const remainder=container.addItem(new ItemStack(id,1));
  if(remainder)player.dimension.spawnItem(remainder,player.location);
 }
 player.sendMessage('Obsidian rod and seven fish supplied. Use to cast toward lava, then use again when the bobber dips.');
});
