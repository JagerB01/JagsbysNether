import {world} from '@minecraft/server';
export function protectedTrialSpawner(block){
 return block?.typeId==='minecraft:trial_spawner'&&block.dimension?.id==='minecraft:nether';
}
world.beforeEvents.playerBreakBlock.subscribe(event=>{
 if(protectedTrialSpawner(event.block))event.cancel=true;
});
world.beforeEvents.explosion.subscribe(event=>{
 if(event.dimension.id!=='minecraft:nether')return;
 const blocks=event.getImpactedBlocks(),remaining=blocks.filter(block=>!protectedTrialSpawner(block));
 if(remaining.length!==blocks.length)event.setImpactedBlocks(remaining);
});
