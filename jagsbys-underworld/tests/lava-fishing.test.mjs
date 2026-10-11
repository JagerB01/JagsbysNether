import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAnglingController,catchFish,fishPool,FISH,ROD} from '../.build/behavior_pack/scripts/lava_fishing/angling.js';
import {applyFishFood,updateFishEffects,validFishSpawn,updateFish} from '../.build/behavior_pack/scripts/lava_fishing/fish.js';
const json=file=>JSON.parse(readFileSync(new URL(file,import.meta.url)));
function fixture({dimension='minecraft:nether',biome=1,mode='Survival',damage=0,maxDurability=256,chance=100,lure=0}={}){
 const properties=new Map(),rodProperties=new Map(),caught=[],sounds=[],particles=[],positions=[],effects=[],fires=[],experience=[],damageTaken=[];
 const rod={typeId:ROD,getDynamicProperty:k=>rodProperties.get(k),setDynamicProperty:(k,v)=>rodProperties.set(k,v),getComponent(type){if(type==='minecraft:durability')return durability;if(type==='minecraft:enchantable')return {getEnchantment:name=>({level:name==='lure'?lure:0})};}};
 const durability={damage,maxDurability,getDamageChance:()=>chance};
 const inventory=new Map([[0,rod]]);const container={getItem:slot=>inventory.get(slot),setItem:(slot,value)=>inventory.set(slot,value),addItem:item=>{caught.push(item);return undefined;}};
 const lava={typeId:'minecraft:lava',isAir:false,location:{x:0,y:31,z:8},permutation:{getState:()=>0}};
 const bobber={isValid:true,removed:0,events:[],teleport:p=>positions.push(p),triggerEvent(event){this.events.push(event);},getProperty:()=>biome,setProperty(){},remove(){this.removed++;this.isValid=false;}};
 const dim={id:dimension,entities:[],getBlock(p){return p.y<=31?lava:{typeId:'minecraft:air',isAir:true};},spawnEntity(type,p){this.entities.push({type,p});return bobber;},playSound:(id,p)=>sounds.push({id,p}),spawnParticle:(id,p)=>particles.push({id,p}),spawnItem(item){caught.push(item);},getEntities:()=>[]};
 const player={id:'angler',typeId:'minecraft:player',selectedSlotIndex:0,location:{x:0,y:32,z:0},dimension:dim,getGameMode:()=>mode,getComponent:()=>({container}),getBlockFromViewDirection:options=>{assert.equal(options.includeLiquidBlocks,true);return {block:lava,faceLocation:{x:0.5,z:0.5}};},getHeadLocation:()=>({x:0,y:33.6,z:0}),addExperience:n=>experience.push(n),onScreenDisplay:{setActionBar:()=>{}},addEffect:(...args)=>effects.push(args),setOnFire:(...args)=>fires.push(args),setDynamicProperty:(k,v)=>properties.set(k,v),getDynamicProperty:k=>properties.get(k),applyDamage:(...args)=>damageTaken.push(args),getVelocity:()=>({y:-0.2}),teleport:p=>positions.push(p),applyImpulse:p=>positions.push(p)};
 return {player,dim,bobber,lava,inventory,rod,durability,caught,experience,effects,fires,properties,positions,damageTaken};
}
function bite(controller,f,start=0){assert.equal(controller.use(f.player,start),true);for(const tick of [start+12,start+14,start+114,start+134])controller.update([f.player],tick);assert.equal(controller.sessions.get(f.player.id).state,'bite');}
test('uploaded Java loot tables and fishing-only scope determine the pools',()=>{
 const lava=json('../behavior_pack/docs/lava_fishing/source_data/lava_fish.json');
 assert.deepEqual(fishPool('minecraft:overworld',0),lava.pools[0].entries.map(e=>[e.name.split(':')[1],e.weight]));
 const nether=json('../behavior_pack/docs/lava_fishing/source_data/nether_fish.json');
 for(const biome of [1,2,3,4]){
  const expected=nether.pools[0].entries.filter(e=>!e.conditions || (biome===2&&e.name.endsWith('agni_fish')) || (biome===3&&e.name.endsWith('steam_flying_fish')) || (biome===4&&['scaly_foot_snail','yeti_crab'].some(f=>e.name.endsWith(f)))).map(e=>[e.type==='minecraft:loot_table'?'base':e.name.split(':')[1],e.weight]).sort();
  assert.deepEqual(fishPool('minecraft:nether',biome).sort(),expected);
 }
 assert.equal(FISH.length,9);
});
test('nested base table retains 34/33/33 weights and excludes Nether specialists outside Nether',()=>{
 for(const [value,name] of [[0,'flame_squat_lobster'],[0.34,'obsidian_sword_fish'],[0.67,'arowana_fish']])assert.equal(catchFish('minecraft:overworld',4,()=>value),name);
 let rolls=[0,0.8];assert.equal(catchFish('minecraft:nether',1,()=>rolls.shift()),'arowana_fish');
 for(const [biome,name] of [[2,'agni_fish'],[3,'steam_flying_fish'],[4,'yeti_crab']])assert.equal(catchFish('minecraft:nether',biome,()=>0.999),name);
});
test('cast, classify, approach, bite and reel give exactly one fish, XP and one durability',()=>{
 const f=fixture(),controller=createAnglingController({rng:()=>0});bite(controller,f);
 assert.equal(controller.use(f.player,135),true);assert.equal(f.caught.length,1);assert.equal(f.caught[0].typeId,'jagsby_nether:flame_squat_lobster');assert.equal(f.durability.damage,1);assert.deepEqual(f.experience,[1]);assert.equal(f.bobber.removed,1);assert.equal(controller.sessions.size,0);
 assert.equal(controller.use(f.player,135),false);assert.equal(f.dim.entities.length,1);
});
test('duplicate native use events neither reel early nor immediately recast',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});assert(c.use(f.player,0));assert.equal(c.use(f.player,0),false);assert.equal(c.sessions.size,1);assert(c.use(f.player,4));assert.equal(c.use(f.player,4),false);assert.equal(f.caught.length,0);assert.equal(f.durability.damage,0);
});
test('reeling before a bite gives no catch and no wear',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});c.use(f.player,0);c.update([f.player],12);c.use(f.player,14);assert.equal(f.caught.length,0);assert.equal(f.durability.damage,0);assert.equal(c.sessions.size,0);
});
test('missed bite resets waiting and cannot award stale loot',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});bite(c,f);c.update([f.player],154);assert.equal(c.sessions.get('angler').state,'waiting');c.use(f.player,155);assert.equal(f.caught.length,0);
});
for(const [name,mutate,players] of [
 ['switching slots',f=>{f.player.selectedSlotIndex=1;}],
 ['replacing the rod',f=>{f.inventory.set(0,{typeId:ROD,getDynamicProperty:()=>undefined});}],
 ['changing dimensions',f=>{f.dim.id='minecraft:overworld';}],
 ['moving out of range',f=>{f.player.location.x=50;}],
 ['removing lava',f=>{f.lava.typeId='minecraft:air';}],
 ['disconnecting',()=>{},[]],
 ['losing the bobber',f=>{f.bobber.isValid=false;}],
])test(`${name} cancels without loot`,()=>{const f=fixture(),c=createAnglingController();c.use(f.player,0);mutate(f);c.update(players??[f.player],5);assert.equal(c.sessions.size,0);assert.equal(f.caught.length,0);});
test('rod breaks at 256 damage and Creative/Unbreaking preserve durability',()=>{
 for(const settings of [{damage:255},{mode:'Creative'},{chance:0}]){const f=fixture(settings),c=createAnglingController({rng:()=>0});bite(c,f);c.use(f.player,135);assert.equal(f.caught.length,1);if(settings.damage===255)assert.equal(f.inventory.get(0),undefined);else assert.equal(f.durability.damage,0);}
});
test('water, blocked lava and spectators cannot cast',()=>{
 for(const which of ['water','blocked','spectator']){const f=fixture({mode:which==='spectator'?'Spectator':'Survival'}),c=createAnglingController();if(which==='water')f.lava.typeId='minecraft:water';if(which==='blocked')f.dim.getBlock=()=>({typeId:'minecraft:stone',isAir:false});assert.equal(c.use(f.player,0),false);assert.equal(f.dim.entities.length,0);}
});
test('undefined biome classification fails closed',()=>{
 const f=fixture(),c=createAnglingController();f.bobber.getProperty=()=>undefined;c.use(f.player,0);c.update([f.player],12);c.update([f.player],14);assert.equal(c.sessions.size,0);assert.equal(f.caught.length,0);
});
test('fish food preserves native durations and scoped custom effects expire',()=>{
 const f=fixture();applyFishFood(f.player,'jagsby_nether:obsidian_sword_fish',100);applyFishFood(f.player,'jagsby_nether:flame_squat_lobster',100);
 assert.deepEqual(f.effects,[['fire_resistance',300],['resistance',400]]);assert.deepEqual(f.fires,[[5,true]]);
 applyFishFood(f.player,'jagsby_nether:agni_fish',100);applyFishFood(f.player,'jagsby_nether:steam_flying_fish',100);
 assert.equal(f.properties.get('jagsby_nether:endless_flame_until'),120100);assert.equal(f.properties.get('jagsby_nether:lava_walker_until'),15100);
 updateFishEffects([f.player],20,120101);assert.equal(f.properties.get('jagsby_nether:endless_flame_until'),undefined);assert.equal(f.properties.get('jagsby_nether:lava_walker_until'),undefined);
});
test('fish spawning requires source lava and five safe neighbors below Y32',()=>{
 const f=fixture();assert(validFishSpawn(f.dim,{x:0,y:30,z:0}));assert.equal(validFishSpawn(f.dim,{x:0,y:32,z:0}),false);
 f.lava.permutation.getState=()=>1;assert.equal(validFishSpawn(f.dim,{x:0,y:30,z:0}),false);
});
test('natural spawning is bounded and inactive outside Nether',()=>{
 const f=fixture({dimension:'minecraft:overworld'});updateFish([f.player],100,()=>0);assert.equal(f.dim.entities.length,0);
 f.dim.id='minecraft:nether';f.dim.getEntities=()=>Array.from({length:12},(_,i)=>({id:String(i),location:{x:0,y:30,z:0},typeId:'jagsby_nether:quartz_fish',triggerEvent(){},teleport(){}}));updateFish([f.player],100,()=>0);assert.equal(f.dim.entities.length,0);
});
