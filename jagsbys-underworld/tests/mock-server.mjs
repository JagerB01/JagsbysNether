function signal() {
  const callbacks = [];
  return {subscribe(callback) { callbacks.push(callback); }, emit(event) {
    for (const callback of callbacks) callback(event);
  }};
}
export const GameMode = {Survival: 'Survival', Creative: 'Creative', Adventure: 'Adventure', Spectator: 'Spectator'};
export class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; }
  getComponent() { return undefined; }
}
export const components = new Map();
export const itemComponents = new Map();
const properties = new Map();
export const world = {
  getDimension() { return {getEntities() { return []; }}; },
  getPlayers() { return []; },
  getDynamicProperty(key) { return properties.get(key); },
  setDynamicProperty(key, value) { properties.set(key, value); },
  getDynamicPropertyIds() { return [...properties.keys()]; },
  getAllPlayers() { return []; },
  beforeEvents: {playerInteractWithEntity: signal(), playerInteractWithBlock: signal()},
  afterEvents: {entityContainerOpened: signal(), entityContainerClosed: signal(), entitySpawn: signal(), entityLoad: signal(), playerInteractWithEntity: signal(), itemUse: signal(), playerLeave: signal(), playerBreakBlock: signal(), entityDie: signal(), itemCompleteUse: signal()},
};
const pending = [];
export const intervals = [], jobs = [];
export const StructureRotation = {None: "None", Rotate90: "Rotate90", Rotate180: "Rotate180", Rotate270: "Rotate270"};
export const system = {
  currentTick: 0,
  runInterval(callback, ticks) { intervals.push({callback, ticks}); return intervals.length; },
  runJob(job) { jobs.push(job); return jobs.length; },
  beforeEvents: {startup: signal()},
  afterEvents: {scriptEventReceive: signal()},
  run(callback) { pending.push(callback); },
};
export function flush() { while (pending.length) pending.shift()(); }
export function startup() {
  system.beforeEvents.startup.emit({itemComponentRegistry: {registerCustomComponent(name,value){if(itemComponents.has(name))throw Error(`Duplicate item component: ${name}`);itemComponents.set(name,value);}}, blockComponentRegistry: {
    registerCustomComponent(name, value) {
      if (components.has(name)) throw new Error(`Duplicate component: ${name}`);
      components.set(name, value);
    },
  }});
}
