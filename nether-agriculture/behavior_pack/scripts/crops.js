// Agriculture Progression's Nether farming rules, adapted to Bedrock blocks.
export const NS = 'jagsby_nether';
export const AGE = `${NS}:age`;
export const HEATED = `${NS}:heated`;
export const HEAT_LEVEL = `${NS}:heat_level`;
export const ATTACHED = `${NS}:attached`;
export const FACING = `${NS}:facing`;
export const FARMLAND = `${NS}:soul_soil_farmland`;
export const CROPS = {
  [`${NS}:rye_crop`]: {max: 7, chance: 6},
  [`${NS}:polyps`]: {max: 7, chance: 6},
  [`${NS}:scarberry_bush`]: {max: 3, chance: 8},
  [`${NS}:murky_gourd_stem`]: {max: 7, chance: 8},
};
export const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const GOURD_GROUND = new Set([FARMLAND, 'minecraft:soul_soil', 'minecraft:soul_sand',
  'minecraft:netherrack', 'minecraft:crimson_nylium', 'minecraft:warped_nylium']);

export function read(dimension, location) {
  try { return dimension.getBlock(location); } catch { return undefined; }
}
export function offset(block, x, y, z) {
  return read(block.dimension, {x: block.location.x + x, y: block.location.y + y, z: block.location.z + z});
}
export function setState(block, state, value) {
  // Rewriting the same permutation remeshes blocks without changing gameplay.
  if (block.permutation.getState(state) === value) return;
  block.setPermutation(block.permutation.withState(state, value));
}
export function isNether(block) { return block.dimension.id === 'minecraft:nether'; }

// Java checks a 9x2x9 volume at soil height and one block above it.
export function hasHeat(block) {
  if (!isNether(block)) return false;
  for (let y = 0; y <= 1; y++) for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    const id = offset(block, x, y, z)?.typeId;
    if (id === 'minecraft:lava' || id === 'minecraft:flowing_lava') return true;
  }
  return false;
}
export function updateFarmland(block, nearbyHeat = hasHeat(block)) {
  let level = block.permutation.getState(HEAT_LEVEL) ?? 0;
  // Previously heated farmland restores its full heat when upgrading old worlds.
  if (level === 0 && block.permutation.getState(HEATED)) level = 7;
  if (nearbyHeat) level = Math.min(7, level + 1);
  else if (level > 0) level--;
  else { block.setType('minecraft:soul_soil'); return; }
  const heated = level === 7;
  if (level === block.permutation.getState(HEAT_LEVEL) && heated === block.permutation.getState(HEATED)) return;
  block.setPermutation(block.permutation.withState(HEAT_LEVEL, level).withState(HEATED, heated));
}
export function canGrow(block) {
  if (!isNether(block)) return false;
  if (block.typeId === `${NS}:scarberry_bush`) return true;
  const soil = offset(block, 0, -1, 0);
  return soil?.typeId === FARMLAND && soil.permutation.getState(HEATED) === true;
}
export function growGourd(block, rng = Math.random) {
  if (block.permutation.getState(ATTACHED)) {
    const direction = DIRECTIONS[block.permutation.getState(FACING)];
    if (offset(block, direction[0], 0, direction[1])?.typeId !== `${NS}:murky_gourd`) {
      setState(block, ATTACHED, false);
    }
    return;
  }
  const facing = Math.floor(rng() * DIRECTIONS.length);
  const [x, z] = DIRECTIONS[facing];
  const fruit = offset(block, x, 0, z), ground = offset(block, x, -1, z);
  // Unknown/unloaded columns are never treated as empty space.
  if (!fruit?.isAir || !GOURD_GROUND.has(ground?.typeId)) return;
  fruit.setType(`${NS}:murky_gourd`);
  block.setPermutation(block.permutation.withState(FACING, facing).withState(ATTACHED, true));
}
export function randomTick(block, rng = Math.random) {
  const crop = CROPS[block.typeId];
  if (!crop || !canGrow(block)) return;
  const age = block.permutation.getState(AGE);
  if (block.typeId === `${NS}:murky_gourd_stem` && block.permutation.getState(ATTACHED)) {
    growGourd(block, rng);
    return;
  }
  if (block.typeId === `${NS}:rye_crop` && age === 6 && Math.floor(rng() * 475) === 0) {
    block.setType(`${NS}:blistered_rye_crop`);
    return;
  }
  if (age < crop.max) {
    if (Math.floor(rng() * crop.chance) === 0) setState(block, AGE, age + 1);
  } else if (block.typeId === `${NS}:murky_gourd_stem` && Math.floor(rng() * 8) === 0) {
    growGourd(block, rng);
  }
}
export function fertilize(block, rng = Math.random) {
  const crop = CROPS[block.typeId];
  if (!crop || !isNether(block)) return false;
  if (block.typeId !== `${NS}:scarberry_bush`) {
    const soil = offset(block, 0, -1, 0);
    // Fertilizer must not bypass the farmland's warming period.
    if (soil?.typeId !== FARMLAND || soil.permutation.getState(HEATED) !== true || !hasHeat(soil)) return false;
  }
  const age = block.permutation.getState(AGE);
  if (age >= crop.max) return false;
  const growth = crop.max === 3 ? 1 : 2 + Math.floor(rng() * 4);
  setState(block, AGE, Math.min(crop.max, age + growth));
  if (block.typeId === `${NS}:murky_gourd_stem` && block.permutation.getState(AGE) === 7) {
    growGourd(block, rng);
  }
  return true;
}
export function pickBerries(block, rng = Math.random) {
  const age = block.permutation.getState(AGE);
  if (block.typeId !== `${NS}:scarberry_bush` || age < 2) return 0;
  const count = 1 + Math.floor(rng() * 2) + (age === 3 ? 1 : 0);
  setState(block, AGE, 1);
  return count;
}
