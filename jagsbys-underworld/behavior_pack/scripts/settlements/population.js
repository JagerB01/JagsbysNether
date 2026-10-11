import {read,dimensions} from './terrain.js';
const SAFE_FLOORS=new Set(['minecraft:blackstone','minecraft:polished_blackstone','minecraft:polished_blackstone_bricks',
 'minecraft:chiseled_polished_blackstone','minecraft:cracked_polished_blackstone_bricks','minecraft:basalt','minecraft:smooth_basalt',
 'minecraft:netherrack','minecraft:crimson_nylium','minecraft:warped_nylium','minecraft:soul_sand','minecraft:soul_soil',
 'minecraft:crimson_planks','minecraft:warped_planks','minecraft:crimson_hyphae','minecraft:warped_hyphae',
 'minecraft:stripped_crimson_hyphae','minecraft:stripped_warped_hyphae','minecraft:nether_brick','minecraft:red_nether_brick']);
function clear(block) {
 return !!block && (block.isAir || ['minecraft:crimson_roots','minecraft:warped_roots','minecraft:nether_sprouts',
  'minecraft:crimson_fungus','minecraft:warped_fungus'].includes(block.typeId));
}
// Residential houses only: farms, stables and other amenities do not count.
export function populationKind(piece) {
 return piece.kind==='house' && piece.countsAsHouse!==false ? 'house' : undefined;
}
export function spawnSpot(dimension,item,used=new Set(),center=false) {
 const [sx,,sz]=dimensions(item.piece,item.rotation),columns=[];
 const margin=center?3:0;
 for(let x=-margin;x<sx+margin;x++)for(let z=-margin;z<sz+margin;z++) {
  const edge=x<0||x>=sx||z<0||z>=sz;
  columns.push({x:item.origin.x+x,z:item.origin.z+z,score:
    Math.abs(x-(sx-1)/2)+Math.abs(z-(sz-1)/2)+(center?(edge?0:100):0)});
 }
 columns.sort((a,b)=>a.score-b.score);
 for(const col of columns)for(let dy=1;dy<=4;dy++) {
  const y=item.baseY+dy,key=`${col.x},${y},${col.z}`;
  if(used.has(key))continue;
  const below=read(dimension,col.x,y-1,col.z);
  if(!below || !SAFE_FLOORS.has(below.typeId))continue;
  if(!clear(read(dimension,col.x,y,col.z)) || !clear(read(dimension,col.x,y+1,col.z)))continue;
  return {x:col.x+0.5,y,z:col.z+0.5,key};
 }
 return undefined;
}
export function* populate(dimension,items,notify) {
 const used=new Set();let villagers=0;
 for(const item of items.filter(item=>populationKind(item.piece))) {
  try {
   const spot=spawnSpot(dimension,item,used);
   if(!spot){console.warn(`[Nether Settlements] No safe villager spawn space at ${item.piece.id}.`);continue;}
   // Use the active vanilla entity definition and its default spawn event.
   // Conquest & Commerce overrides this same ID and selects biome variants natively.
   dimension.spawnEntity('minecraft:villager_v2',{x:spot.x,y:spot.y,z:spot.z});
   used.add(spot.key);villagers++;
  } catch(error) {console.warn(`[Nether Settlements] Villager spawn failed at ${item.piece.id}: ${error}`);}
  yield;
 }
 notify?.(`Residents placed: ${villagers} villagers.`);
 return {villagers};
}
