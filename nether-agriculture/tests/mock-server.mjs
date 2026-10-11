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
export const world = {
  getAllPlayers() { return []; },
  beforeEvents: {playerInteractWithBlock: signal()},
  afterEvents: {playerBreakBlock: signal(), entityDie: signal(), itemCompleteUse: signal()},
};
const pending = [];
export const system = {
  runInterval() { return 1; },
  beforeEvents: {startup: signal()},
  afterEvents: {scriptEventReceive: signal()},
  run(callback) { pending.push(callback); },
};
export function flush() { while (pending.length) pending.shift()(); }
export function startup() {
  system.beforeEvents.startup.emit({blockComponentRegistry: {
    registerCustomComponent(name, value) {
      if (components.has(name)) throw new Error(`Duplicate component: ${name}`);
      components.set(name, value);
    },
  }});
}
