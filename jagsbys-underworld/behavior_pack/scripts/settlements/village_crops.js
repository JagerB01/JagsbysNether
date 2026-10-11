import {system} from '@minecraft/server';
import {cropSites} from './crop_sites.js';
import {rotate} from './terrain.js';

// Stable server 2.0.0 has no biome query. Native entity filters read the actual
// biome, including biome boundaries, without guessing from blocks or pack style.
export function* villageCrop(dimension,location) {
 const probe=dimension.spawnEntity('jagsby_nether:crop_biome_probe',location);
 try {
  probe.triggerEvent('jagsby_nether:classify');
  // Entity property updates are committed on the next tick.
  let ready=false;
  system.run(()=>{ready=true;});
  while(!ready)yield;
  const crop=probe.getProperty('jagsby_nether:village_crop');
  if(![0,1,2].includes(crop))throw new Error('Village biome classification failed');
  return [undefined,'sorgum','polyps'][crop];
 } finally {probe.remove();}
}

export function* plantStructureCrops(dimension,piece,rotation,origin,baseY,inVillage) {
 if(!inVillage)return; // Standalone structures stay wart-free without planting.
 for(const [x,y,z] of cropSites[piece.id] ?? []) {
  const [rx,rz]=rotate(x,z,piece.size,rotation);
  const position={x:origin.x+rx,y:baseY+y,z:origin.z+rz};
  const crop=yield* villageCrop(dimension,position);
  if(!crop)continue; // No replacement specified for basalt deltas or other biomes.
  const type=crop==='sorgum' ? 'jagsby_nether:rye_crop' : 'jagsby_nether:polyps';
  const soil=dimension.getBlock({...position,y:position.y-1});
  const plant=dimension.getBlock(position);
  if(!soil || !plant)throw new Error(`Crop planting terrain unloaded: ${piece.id}`);
  soil.setType('jagsby_nether:soul_soil_farmland');
  plant.setType(type);
  yield;
 }
}
