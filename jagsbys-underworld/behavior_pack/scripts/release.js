// One-time release cleanup; preserves all structures and active build checkpoints.
import {world} from '@minecraft/server';
const RELEASE='1.0.0',KEY='jagsby_nether:release_initialized';
export function initializeRelease(storage=world){
 if(storage.getDynamicProperty(KEY)===RELEASE)return false;
 storage.setDynamicProperty('underworld_landmarks:next_giant',undefined);
 storage.setDynamicProperty(KEY,RELEASE);
 return true;
}
world.afterEvents.worldLoad.subscribe(()=>initializeRelease());
