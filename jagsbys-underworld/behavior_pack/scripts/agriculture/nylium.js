// Bounded, use-triggered terrain growth; never surveys or loads chunks.
function read(dimension, location) { try { return dimension.getBlock(location); } catch { return undefined; } }
function nyliumAt(dimension, location) {
  try {
    const biome = dimension.getBiome(location)?.id;
    if (biome === 'minecraft:crimson_forest') return 'minecraft:crimson_nylium';
    if (biome === 'minecraft:warped_forest') return 'minecraft:warped_nylium';
  } catch {}
}
export function spreadNylium(block, random = Math.random) {
  const dimension = block.dimension;
  if (dimension.id !== 'minecraft:nether' || block.typeId !== 'minecraft:netherrack') return 0;
  const center = block.location;
  if (!nyliumAt(dimension, center) || !read(dimension, {...center, y: center.y + 1})?.isAir) return 0;
  let changed = 0;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    const distance = dx * dx + dz * dz;
    if (distance > 10 || (distance && random() > 1 - distance / 14)) continue;
    // Follow the surface one block up or down without converting buried rock.
    for (const dy of [1, 0, -1]) {
      const location = {x: center.x + dx, y: center.y + dy, z: center.z + dz};
      const target = read(dimension, location);
      if (target?.typeId !== 'minecraft:netherrack' || !read(dimension, {...location, y: location.y + 1})?.isAir) continue;
      const type = nyliumAt(dimension, location);
      if (type) { target.setType(type); changed++; }
      break;
    }
  }
  return changed;
}
