function signal(maxArgs=2) {
  const callbacks = [];
  return {get subscriberCount(){return callbacks.length;},unsubscribe(callback){const index=callbacks.indexOf(callback);if(index>=0)callbacks.splice(index,1);},subscribe(callback,...options) { if(options.length+1>maxArgs)throw new TypeError(`subscribe accepts ${maxArgs} argument(s)`);callbacks.push(callback); }, emit(event) {
    for (const callback of [...callbacks]) callback(event);
  }};
}
export const GameMode = {Survival: 'Survival', Creative: 'Creative', Adventure: 'Adventure', Spectator: 'Spectator'};
export class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; }
  clone(){return Object.assign(new ItemStack(this.typeId,this.amount),this);}
  getComponent() { return undefined; }
}
export const components = new Map();
export const itemComponents = new Map();
const properties = new Map();
export const entities = new Map();
export const world = {
  gameRules:{mobGriefing:true},
  getAbsoluteTime(){return system.currentTick;},
  getEntity(id){return entities.get(id);},
  getDimension() { return {getEntities() { return []; },spawnEntity(typeId,location){return {id:`spawned-${typeId}-${location.x}-${location.z}`,typeId,location,addTag(){}};}}; },
  getPlayers() { return []; },
  getDynamicProperty(key) { return properties.get(key); },
  setDynamicProperty(key, value) { properties.set(key, value); },
  getDynamicPropertyIds() { return [...properties.keys()]; },
  getAllPlayers() { return []; },
  beforeEvents: {playerBreakBlock: signal(), explosion: signal(), entityHurt: signal(), playerInteractWithEntity: signal(), playerInteractWithBlock: signal()},
  afterEvents: {worldLoad: signal(), playerSpawn: signal(), playerHotbarSelectedSlotChange: signal(), playerInventoryItemChange: signal(), entityContainerOpened: signal(), entityContainerClosed: signal(), entitySpawn: signal(1), entityLoad: signal(1), entityRemove: signal(), dataDrivenEntityTrigger: signal(), playerInteractWithEntity: signal(), itemUse: signal(), playerLeave: signal(), playerBreakBlock: signal(), entityDie: signal(), entityHurt: signal(), projectileHitBlock: signal(), projectileHitEntity: signal(), itemCompleteUse: signal()},
};
const pending = [];
export const intervals = [], jobs = [], timeouts = [];
export const StructureRotation = {None: "None", Rotate90: "Rotate90", Rotate180: "Rotate180", Rotate270: "Rotate270"};
export const system = {
  currentTick: 0,
  clearRun(id){if(intervals[id-1])intervals[id-1].cancelled=true;},
  runTimeout(callback,ticks=1){timeouts.push({callback,due:this.currentTick+ticks});return timeouts.length;},
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

export class BlockVolume {
 constructor(from,to){this.from={...from};this.to={...to};}
}

export const EntityDamageCause = Object.fromEntries(['override','selfDestruct','sonicBoom','fall','fireTick','suffocation','drowning','starve','flyIntoWall','magic','void','freezing','entityExplosion','entityAttack','projectile','lightning','fire'].map(key=>[key,key]));
export const DimensionTypes = {getAll(){return [{typeId:'minecraft:overworld'},{typeId:'minecraft:nether'},{typeId:'minecraft:the_end'}];}};
export class MolangVariableMap {
 constructor(){this.values=new Map();}
 setFloat(key,value){this.values.set(key,value);}
 setVector3(key,value){this.values.set(key,value);}
 setColorRGB(key,value){this.values.set(key,value);}
 setColorRGBA(key,value){this.values.set(key,value);}
}
