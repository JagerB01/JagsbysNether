import {world,loadedImportedActors} from './runtime.js';
function recover(entity){
 if(!entity?.isValid)return;
 if(entity.typeId==='dungeons:wretched_wraith'){
  if(!entity.getDynamicProperty('dungeons:home'))entity.setDynamicProperty('dungeons:home',entity.location);
  entity.triggerEvent('dungeons:bullethell_end');
  if((entity.getEffect('slowness')?.amplifier??0)>=99)entity.removeEffect('slowness');
 }else if(entity.typeId==='dungeons:nameless_one'){
  if(entity.getProperty('dungeons:casting')===true)entity.triggerEvent('dungeons:complete_casting');
 }else if(entity.typeId==='dungeons:boss_wildfire')entity.triggerEvent('jagsby_nether:resume_combat');
}
world.afterEvents.entityLoad.subscribe(({entity})=>recover(entity));
world.afterEvents.worldLoad.subscribe(()=>{for(const entity of loadedImportedActors())recover(entity);});
