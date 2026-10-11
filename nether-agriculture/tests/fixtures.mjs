import {AGE, ATTACHED, FACING, HEATED} from '../behavior_pack/scripts/crops.js';
export class Permutation {
  constructor(id, states = {}) { this.type = {id}; this.states = {...states}; }
  getState(name) { return this.states[name]; }
  withState(name, value) { return new Permutation(this.type.id, {...this.states, [name]: value}); }
}
export function worldFixture(dimensionId = 'minecraft:nether') {
  const blocks = new Map(), drops = [], sounds = [], particles = [];
  const key = ({x, y, z}) => `${x},${y},${z}`;
  const dimension = {id: dimensionId, drops, sounds, particles,
    playSound(name, location) { sounds.push({name, location}); },
    spawnParticle(name, location) { particles.push({name, location}); },
    getBlock(location) {
      if (dimension.unloaded?.has(key(location))) throw new Error('Unloaded chunk');
      if (!blocks.has(key(location))) put('minecraft:air', location);
      return blocks.get(key(location));
    },
    spawnItem(stack, location) { drops.push({stack, location}); },
  };
  function put(id, location = {x: 0, y: 64, z: 0}, states = {}) {
    const block = {dimension, location: {...location}, permutation: new Permutation(id, states), writes: 0,
      get typeId() { return this.permutation.type.id; },
      get isAir() { return this.typeId === 'minecraft:air'; },
      setPermutation(value) { this.permutation = value; this.writes++; },
      setType(value) { this.permutation = new Permutation(value, {
        [AGE]: 0, [ATTACHED]: false, [FACING]: 0, [HEATED]: false}); },
    };
    blocks.set(key(location), block);
    return block;
  }
  return {dimension, put, blocks};
}
export function rng(...values) { let index = 0; return () => values[Math.min(index++, values.length - 1)]; }
export function playerFixture(dimension, {mode = 'Survival', held} = {}) {
  const slots = new Map(held ? [[0, held]] : []), gifts = [], effects = new Map(), messages = [], animations = [];
  const container = {getItem(slot) { return slots.get(slot); }, setItem(slot, item) {
    if (item) slots.set(slot, item); else slots.delete(slot);
  }, addItem(item) { gifts.push(item); }};
  const player = {typeId: 'minecraft:player', dimension, location: {x: 0, y: 65, z: 0},
    selectedSlotIndex: 0, isSneaking: false, mode, getGameMode() { return this.mode; },
    getComponent(name) { if (name === 'minecraft:inventory') return {container}; },
    sendMessage(message) { messages.push(message); },
    playAnimation(name, options) { animations.push({name, options}); },
    addEffect(name, ticks) { effects.set(name, ticks); }, removeEffect(name) { effects.delete(name); },
  };
  return {player, slots, gifts, effects, messages, animations};
}
