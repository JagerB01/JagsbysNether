// Small, bounded sample taken only while a surveyed section is already loaded.
export function* sampleSiteQuality(d,from,size,stats){
 for(const fx of [.2,.5,.8])for(const fz of [.2,.5,.8])for(const fy of [.15,.4,.7]){
  const p={x:from.x+Math.floor((size[0]-1)*fx),y:from.y+Math.floor((size[1]-1)*fy),z:from.z+Math.floor((size[2]-1)*fz)};
  const block=d.getBlock(p);if(!block)throw Error('Quality sample unloaded');
  stats.total++;if(!['minecraft:air','minecraft:cave_air','minecraft:lava','minecraft:flowing_lava'].includes(block.typeId))stats.solid++;
  yield;
 }
}
