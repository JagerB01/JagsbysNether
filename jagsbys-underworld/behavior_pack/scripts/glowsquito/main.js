import {world,system} from '@minecraft/server';
import {createColonyController,MOB,HIVE} from './colony.js';
const colony=createColonyController({world,system});
function guard(action){try{return action();}catch(error){console.warn(`[Underworld Glowsquito] ${error}`);}}
system.beforeEvents.startup.subscribe(({blockComponentRegistry})=>{
 blockComponentRegistry.registerCustomComponent('jagsby_nether:glowhusk',{
  onPlace:({block})=>guard(()=>colony.placed(block)),
  onEntity:({block,entitySource,name})=>guard(()=>{
   if(['jagsby_nether:claim','jagsby_nether:return'].includes(name))colony.reach(block,entitySource);
  }),
  onPlayerInteract:({block,player})=>guard(()=>colony.harvest(block,player)),
  onBreak:({block})=>guard(()=>colony.destroy(block)),
 });
});
world.afterEvents.entitySpawn.subscribe(({entity})=>guard(()=>colony.load(entity)),{entityTypes:[MOB]});
world.afterEvents.entityLoad.subscribe(({entity})=>guard(()=>colony.load(entity)),{entityTypes:[MOB]});
world.afterEvents.entityRemove.subscribe(({removedEntityId})=>colony.remove(removedEntityId),{entityTypes:[MOB]});
world.afterEvents.entityDie.subscribe(({deadEntity})=>guard(()=>colony.died(deadEntity)),{entityTypes:[MOB]});
world.afterEvents.dataDrivenEntityTrigger.subscribe(({entity,eventId})=>guard(()=>{
 if(eventId==='jagsby_nether:pollinated')colony.pollinated(entity);
 else if(eventId==='jagsby_nether:wake')colony.wake(entity);
 else if(['jagsby_nether:forage','jagsby_nether:exit'].includes(eventId))colony.clearedPollen(entity);
}),{entityTypes:[MOB],eventTypes:['jagsby_nether:pollinated','jagsby_nether:wake','jagsby_nether:forage','jagsby_nether:exit']});
// Optional diagnostics perform a single nearby-hive lookup only on request.
system.afterEvents.scriptEventReceive.subscribe(({id,sourceEntity:player})=>{
 if(id!=='jagsby_nether:glowhusk_status'||player?.typeId!=='minecraft:player')return;
 guard(()=>{
  const hit=player.getBlockFromViewDirection({maxDistance:8})?.block;
  if(hit?.typeId!==HIVE){player.sendMessage('[Underworld] Look at a Glowhusk within 8 blocks.');return;}
  const record=colony.ensureHive(hit);
  player.sendMessage(`[Underworld] Glowhusk: ${hit.permutation.getState('jagsby_nether:wax_level')}/5 wax, ${record.occupants.length}/3 assigned Glowsquitos.`);
 });
});
