import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createAnglingController,clearLegacyRodProperties,rodTip,linePoints,catchFish,fishPool,FISH,ROD} from '../.build/behavior_pack/scripts/lava_fishing/angling.js';
import {applyFishFood,updateFishEffects} from '../.build/behavior_pack/scripts/lava_fishing/fish.js';
const json=file=>JSON.parse(readFileSync(new URL(file,import.meta.url)));
function fixture({dimension='minecraft:nether',biome=1,mode='Survival',damage=0,maxDurability=256,chance=100,lure=0,unbreaking=0}={}){
 const properties=new Map(),rodProperties=new Map(),caught=[],caughtDrops=[],xpOrbs=[],sounds=[],particles=[],positions=[],impulses=[],animations=[],cooldowns=[],messages=[],effects=[],fires=[],experience=[],damageTaken=[];
 const rod={typeId:ROD,getDynamicProperty:k=>rodProperties.get(k),setDynamicProperty:(k,v)=>v===undefined?rodProperties.delete(k):rodProperties.set(k,v),getComponent(type){if(type==='minecraft:cooldown')return {startCooldown:player=>cooldowns.push(player.id)};if(type==='minecraft:durability')return durability;if(type==='minecraft:enchantable')return {getEnchantment:name=>({level:name==='lure'?lure:name==='unbreaking'?unbreaking:0})};}};
 const durability={damage,maxDurability,getDamageChance:()=>chance};
 const inventory=new Map([[0,rod]]);const container={getItem:slot=>inventory.get(slot),setItem:(slot,value)=>inventory.set(slot,value),addItem:item=>{caught.push(item);return undefined;}};
 const lava={typeId:'minecraft:lava',isAir:false,location:{x:0,y:31,z:8},permutation:{getState:()=>0}};
 const bobber={location:{x:0,y:31.9,z:8},applyImpulse:v=>impulses.push(v),clearVelocity(){},isOnGround:false,isValid:true,removed:0,events:[],teleport(p){positions.push(p);this.location=p;},triggerEvent(event){this.events.push(event);},getProperty:()=>biome,setProperty(){},remove(){this.removed++;this.isValid=false;}};
 const dim={id:dimension,entities:[],getBlock(p){return p.y<=31?lava:{typeId:'minecraft:air',isAir:true};},spawnEntity(type,p){if(type==='minecraft:xp_orb'){xpOrbs.push({type,p});return {};}this.entities.push({type,p});bobber.isValid=true;return bobber;},playSound:(id,p,options)=>sounds.push({id,p,options}),spawnParticle:(id,p)=>particles.push({id,p}),spawnItem(item,p){caught.push(item);const drop={position:p,velocity:undefined,cleared:false,clearVelocity(){this.cleared=true;},applyImpulse(v){this.velocity=v;}};caughtDrops.push(drop);return drop;},getEntities:()=>[]};
 const player={id:'angler',typeId:'minecraft:player',selectedSlotIndex:0,location:{x:0,y:32,z:0},dimension:dim,getGameMode:()=>mode,getRotation:()=>({x:0,y:0}),playAnimation:(id,options)=>animations.push({id,options}),getComponent:()=>({container}),getBlockFromViewDirection:options=>{assert.equal(options.includeLiquidBlocks,true);return {block:lava,faceLocation:{x:0.5,z:0.5}};},getHeadLocation:()=>({x:0,y:33.6,z:0}),getViewDirection:()=>({x:0,y:-0.3,z:Math.sqrt(0.91)}),addExperience:n=>experience.push(n),onScreenDisplay:{setActionBar:m=>messages.push(m)},addEffect:(...args)=>effects.push(args),setOnFire:(...args)=>fires.push(args),setDynamicProperty:(k,v)=>properties.set(k,v),getDynamicProperty:k=>properties.get(k),applyDamage:(...args)=>damageTaken.push(args),getVelocity:()=>({y:-0.2}),teleport:p=>positions.push(p),applyImpulse:p=>positions.push(p)};
 return {player,dim,bobber,lava,inventory,rod,durability,caught,caughtDrops,xpOrbs,experience,effects,fires,properties,rodProperties,positions,impulses,animations,cooldowns,messages,sounds,particles,damageTaken};
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
 assert.equal(controller.use(f.player,135),true);assert.equal(f.caught.length,1);assert.equal(f.caught[0].typeId,'jagsby_nether:flame_squat_lobster');assert.equal(f.durability.damage,1);assert.equal(f.xpOrbs.length,1);assert.deepEqual(f.experience,[]);assert.equal(f.bobber.removed,1);assert.equal(controller.sessions.size,0);
 assert.equal(controller.use(f.player,135),false);assert.equal(f.dim.entities.length,1);
});
test('duplicate native use events neither reel early nor immediately recast',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});assert(c.use(f.player,0));assert.equal(c.use(f.player,0),false);assert.equal(c.sessions.size,1);assert(c.use(f.player,4));assert.equal(c.use(f.player,4),false);assert.equal(f.caught.length,0);assert.equal(f.durability.damage,0);
});
test('reeling before a bite gives no catch and no wear',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});c.use(f.player,0);c.update([f.player],12);c.use(f.player,14);assert.equal(f.caught.length,0);assert.equal(f.durability.damage,0);assert.equal(c.sessions.size,0);
});
test('missed bite requires an empty reel and a fresh cast before another bite',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});bite(c,f);c.update([f.player],154);
 assert.equal(c.sessions.get('angler').state,'missed');c.update([f.player],2000);
 assert.equal(c.sessions.get('angler').state,'missed');assert.equal(f.caught.length,0);
 c.use(f.player,2001);assert.equal(c.sessions.size,0);assert.equal(f.caught.length,0);
 c.use(f.player,2009);assert.equal(c.sessions.get('angler').state,'casting');
 for(const tick of [2021,2023,2123,2143])c.update([f.player],tick);
 assert.equal(c.sessions.get('angler').state,'bite');c.use(f.player,2144);assert.equal(f.caught.length,1);
});
for(const [name,mutate,players] of [
 ['switching slots',f=>{f.player.selectedSlotIndex=1;}],
 ['replacing the rod',f=>{f.inventory.set(0,{typeId:ROD,nameTag:'Replacement rod',getComponent:type=>f.rod.getComponent(type)});}],
 ['changing dimensions',f=>{f.dim.id='minecraft:overworld';}],
 ['moving out of range',f=>{f.player.location.x=50;}],
 ['removing lava',f=>{f.lava.typeId='minecraft:air';}],
 ['disconnecting',()=>{},[]],
 ['losing the bobber',f=>{f.bobber.isValid=false;}],
])test(`${name} cancels without loot`,()=>{const f=fixture(),c=createAnglingController();c.use(f.player,0);c.update([f.player],12);c.update([f.player],14);mutate(f);c.update(players??[f.player],15);assert.equal(c.sessions.size,0);assert.equal(f.caught.length,0);});
test('rod breaks at 256 damage and Creative/Unbreaking preserve durability',()=>{
 for(const settings of [{damage:255},{mode:'Creative'},{chance:0}]){const f=fixture(settings),c=createAnglingController({rng:()=>0});bite(c,f);c.use(f.player,135);assert.equal(f.caught.length,1);if(settings.damage===255)assert.equal(f.inventory.get(0),undefined);else assert.equal(f.durability.damage,0);}
});
test('casting into air or water is allowed, but cannot yield lava fish; Spectators cannot cast',()=>{
 for(const type of ['minecraft:water','minecraft:stone']){
  const f=fixture(),c=createAnglingController();f.lava.typeId=type;
  assert.equal(c.use(f.player,0),true);c.update([f.player],12);c.use(f.player,14);assert.equal(f.caught.length,0);
 }
 const f=fixture({mode:'Spectator'});assert.equal(createAnglingController().use(f.player,0),false);assert.equal(f.dim.entities.length,0);
});
test('delayed classification is retried, and missing biome data keeps common fish catchable',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});f.bobber.getProperty=()=>undefined;
 c.use(f.player,0);c.update([f.player],12);c.update([f.player],14);
 assert.equal(c.sessions.get(f.player.id).state,'classifying');
 c.update([f.player],52);assert.equal(c.sessions.get(f.player.id).state,'waiting');
 assert.equal(c.sessions.get(f.player.id).biome,1);
 c.update([f.player],152);c.update([f.player],172);c.use(f.player,173);
 assert.equal(f.caught.length,1);
});
test('late native biome properties select the correct pool without removing the bobber',()=>{
 const f=fixture(),c=createAnglingController();let biome=0;f.bobber.getProperty=()=>biome;
 c.use(f.player,0);c.update([f.player],12);c.update([f.player],14);biome=4;c.update([f.player],20);
 assert.equal(c.sessions.get(f.player.id).biome,4);assert.equal(f.bobber.removed,0);
});
test('failed line particles do not stop fishing or remove the bobber',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});f.dim.spawnParticle=()=>{throw Error('Visual particle unavailable');};
 bite(c,f);assert.equal(f.bobber.removed,0);c.use(f.player,135);assert.equal(f.caught.length,1);
});
test('normal fishing uses bobber dips and splash cues without action-bar prompts',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});bite(c,f);
 assert.equal(f.messages.length,0);assert(f.bobber.location.y<c.sessions.get(f.player.id).target.y-0.15);
 assert(f.sounds.some(s=>s.id==='random.splash'));c.use(f.player,135);assert.equal(f.messages.length,0);
});
test('fish food preserves native durations and scoped custom effects expire',()=>{
 const f=fixture();applyFishFood(f.player,'jagsby_nether:obsidian_sword_fish',100);applyFishFood(f.player,'jagsby_nether:flame_squat_lobster',100);
 assert.deepEqual(f.effects,[['fire_resistance',300],['resistance',400]]);assert.deepEqual(f.fires,[[5,true]]);
 applyFishFood(f.player,'jagsby_nether:agni_fish',100);applyFishFood(f.player,'jagsby_nether:steam_flying_fish',100);
 assert.equal(f.properties.get('jagsby_nether:endless_flame_until'),120100);assert.equal(f.properties.get('jagsby_nether:lava_walker_until'),15100);
 updateFishEffects([f.player],20,120101);assert.equal(f.properties.get('jagsby_nether:endless_flame_until'),undefined);assert.equal(f.properties.get('jagsby_nether:lava_walker_until'),undefined);
});
test('fishing adds only catch items and the required bobber, with no living fish definitions',()=>{
 const entities=readdirSync(new URL('../behavior_pack/entities/lava_fishing/',import.meta.url));
 assert.deepEqual(entities,['lava_bobber.json']);
 const clients=readdirSync(new URL('../resource_pack/entity/lava_fishing/',import.meta.url));
 assert.deepEqual(clients,['lava_bobber.entity.json']);
 const bobber=json('../behavior_pack/entities/lava_fishing/lava_bobber.json')['minecraft:entity'];
 assert.equal(bobber.description.is_spawnable,false);
 for(const name of FISH)assert.equal(json(`../behavior_pack/items/lava_fishing/${name}.json`)['minecraft:item'].description.identifier,`jagsby_nether:${name}`);
});

test('casting uses native entity impulse rather than a crosshair raycast or teleported arc',()=>{
 const f=fixture();f.player.getBlockFromViewDirection=()=>{throw Error('Raycasts must not drive fishing');};
 const c=createAnglingController();assert(c.use(f.player,0));assert.equal(f.impulses.length,1);
 assert.equal(f.positions.length,0);assert(f.impulses[0].z>1);
 assert.equal(f.dim.entities[0].type,'jagsby_nether:lava_bobber');
});
test('line connects the rod and bobber in world coordinates, sags, and is bounded',()=>{
 const a={x:2,y:4,z:6},b={x:-3,y:2,z:-8},points=linePoints(a,b);
 assert.deepEqual(points[0],a);assert(Math.hypot(points.at(-1).x-b.x,points.at(-1).y-b.y,points.at(-1).z-b.z)<1e-8);
 const mid=points[Math.floor(points.length/2)];assert(mid.y<(a.y+b.y)/2);assert(points.length<=221);
 for(const p of points)for(const n of Object.values(p))assert(Number.isFinite(n));
});
test('steep native casts detect the crossed lava surface instead of sinking to the sampled depth',()=>{
 const f=fixture(),c=createAnglingController();c.use(f.player,0);f.bobber.location={x:0,y:28,z:3};c.update([f.player],1);
 assert.equal(c.sessions.get(f.player.id).state,'classifying');assert.equal(c.sessions.get(f.player.id).block.y,31);
 assert(f.bobber.location.y>31.8);
});
test('bobber uses the vanilla fishhook atlas and the rod has no custom held model',()=>{
 const controllers=json('../resource_pack/render_controllers/lava_fishing.render_controllers.json').render_controllers;
 const client=json('../resource_pack/entity/lava_fishing/lava_bobber.entity.json')['minecraft:client_entity'].description;
 for(const name of client.render_controllers)assert(controllers[name]);
 assert.equal(client.textures.default,'textures/entity/fishhook');assert.equal(client.geometry.default,'geometry.fishing_hook');
 const bobber=json('../behavior_pack/entities/lava_fishing/lava_bobber.json')['minecraft:entity'];
 assert('minecraft:fire_immune' in bobber.components);assert.equal(bobber.components['minecraft:physics'].has_gravity,true);
 assert(!Object.keys(bobber.description.properties).some(k=>k.includes('line_')));
 const attachable=json('../resource_pack/attachables/obsidian_fishing_rod.json')['minecraft:attachable'].description;
 assert.equal(attachable.identifier,ROD);assert.equal(attachable.textures.default,'textures/items/lava_fishing/obsidian_fishing_rod');
 const rod=json('../behavior_pack/items/lava_fishing/obsidian_fishing_rod.json')['minecraft:item'].components;
 assert.equal(rod['minecraft:hand_equipped'],true);assert.equal(rod['minecraft:use_animation'],'bow');
 assert.equal(rod['minecraft:use_modifiers'].use_duration,0.05);
 assert(!('minecraft:tags' in rod));
 const particle=json('../resource_pack/particles/lava_fishing_line.particle.json').particle_effect;
 assert.equal(particle.description.identifier,'jagsby_nether:fishing_line');
});

test('Nether biome classification uses native tags rather than the limited is_biome presets',()=>{
 const entity=json('../behavior_pack/entities/lava_fishing/lava_bobber.json')['minecraft:entity'];
 const wastes=entity.events['jagsby_nether:classify'].sequence.find(e=>e.set_property['jagsby_nether:fishing_biome']===1);
 assert(wastes.filters.any_of.some(f=>f.test==='has_biome_tag'&&f.value==='nether_wastes'));
 for(const entry of entity.events['jagsby_nether:classify'].sequence)for(const filter of entry.filters.any_of)assert.equal(filter.test,'has_biome_tag');
 assert.equal(entity.components['minecraft:damage_sensor'].triggers[0].deals_damage,'no');
});

test('only casting plays the throwing sound, while bites use hook splash settings',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});bite(c,f);c.use(f.player,135);
 const throws=f.sounds.filter(s=>s.id==='random.bow');assert.equal(throws.length,1);
 for(const sound of throws){assert.equal(sound.options.volume,0.5);assert(sound.options.pitch>=0.33&&sound.options.pitch<=0.5);}
 for(const sound of f.sounds.filter(s=>s.id==='random.splash'))assert.equal(sound.options.volume,0.25);
});

test('lava pop and sizzle signal only successful catches',()=>{
 const success=fixture(),controller=createAnglingController({rng:()=>0});
 bite(controller,success);
 assert.equal(success.sounds.some(s=>['liquid.lavapop','random.fizz'].includes(s.id)),false);
 controller.use(success.player,135);
 for(const id of ['liquid.lavapop','random.fizz'])assert.equal(success.sounds.filter(s=>s.id===id).length,1);
 const empty=fixture(),early=createAnglingController({rng:()=>0});
 early.use(empty.player,0);early.update([empty.player],12);early.use(empty.player,14);
 assert.equal(empty.sounds.some(s=>['liquid.lavapop','random.fizz'].includes(s.id)),false);
});

test('cast releases above the rod-side shoulder when looking down, with one swing per use',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});
 f.player.getViewDirection=()=>({x:0,y:-0.98,z:0.2});
 assert(c.use(f.player,0));
 const start=f.dim.entities[0].p,head=f.player.getHeadLocation();
 assert.equal(start.y,head.y+0.35);assert.equal(start.x,head.x-0.35);
 assert.equal(f.animations.length,1);assert.equal(f.animations[0].id,'animation.jagsby_nether.fishing_use');
 assert.equal(c.use(f.player,0),false);assert.equal(f.animations.length,1);
 c.use(f.player,5);assert.equal(f.animations.length,2);
});
test('vertical casts use player yaw for the rod-side shoulder',()=>{
 const f=fixture(),c=createAnglingController();
 f.player.getViewDirection=()=>({x:0,y:-1,z:0});f.player.getRotation=()=>({x:90,y:90});
 assert(c.use(f.player,0));const p=f.dim.entities[0].p;
 assert(p.x<0 && p.z<0);assert(Number.isFinite(p.x));assert(p.y>f.player.getHeadLocation().y);
});

test('a catch is thrown from above the bobber toward the player rather than inserted into inventory',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});
 f.player.getComponent=()=>({container:{getItem:()=>f.rod,setItem(){},addItem(){throw Error('Must use world pickup');}}});
 bite(c,f);const target={...c.sessions.get(f.player.id).target};
 assert(c.use(f.player,135));assert.equal(f.caughtDrops.length,1);
 const drop=f.caughtDrops[0];assert.deepEqual(drop.position,{...target,y:target.y+0.35});
 assert(drop.cleared);assert(drop.velocity.y>0);
 const dx=f.player.location.x-drop.position.x,dz=f.player.location.z-drop.position.z;
 assert(drop.velocity.x*dx+drop.velocity.z*dz>0);
});

test('rod uses the native fishing enchantment slot',()=>{
 const item=json('../behavior_pack/items/lava_fishing/obsidian_fishing_rod.json')['minecraft:item'].components;
 assert.equal(item['minecraft:enchantable'].slot,'fishing_rod');assert.equal(item['minecraft:enchantable'].value,9);
});
for(const lure of [0,1,2,3])test(`Lure ${lure} reduces waiting by five seconds per level; a missed bite stays missed`,()=>{
 const f=fixture({lure}),c=createAnglingController({rng:()=>0.5});c.use(f.player,0);c.update([f.player],12);c.update([f.player],14);
 let s=c.sessions.get(f.player.id);assert.equal(s.deadline-14,350-lure*100);
 c.update([f.player],s.deadline);c.update([f.player],s.deadline);
 assert.equal(s.state,'bite');const missedAt=s.deadline;c.update([f.player],missedAt);
 assert.equal(s.state,'missed');c.update([f.player],missedAt+600);assert.equal(s.state,'missed');
});
for(const unbreaking of [1,2,3])test(`Unbreaking ${unbreaking} is passed to the native durability chance calculation`,()=>{
 const f=fixture({unbreaking}),c=createAnglingController({rng:()=>0});let called;
 f.durability.getDamageChance=level=>{called=level;return 0;};
 bite(c,f);c.use(f.player,135);assert.equal(called,unbreaking);assert.equal(f.durability.damage,0);
});
test('catch XP uses native orbs so pickup can mend eligible equipment; failed reels give no XP',()=>{
 const f=fixture(),c=createAnglingController({rng:()=>0});bite(c,f);c.use(f.player,135);
 assert.equal(f.xpOrbs.length,1);assert.equal(f.experience.length,0);
 const empty=fixture(),early=createAnglingController();early.use(empty.player,0);early.use(empty.player,5);
 assert.equal(empty.xpOrbs.length,0);
});

test('accepted rod uses start the client-visible cooldown once, while duplicate callbacks do not',()=>{
 const f=fixture(),c=createAnglingController();c.use(f.player,0);c.use(f.player,0);
 assert.deepEqual(f.cooldowns,[f.player.id]);c.use(f.player,8);assert.equal(f.cooldowns.length,2);
});
test('held sprite is bound at the handle and client swing controller uses the native cooldown',()=>{
 const bones=json('../resource_pack/models/entity/lava_fishing/obsidian_fishing_rod.geo.json')['minecraft:geometry'][0].bones;
 const bone={...bones[0],cubes:bones.find(b=>b.name==='rod_sprite').cubes};
 assert.equal(bone.binding,'query.item_slot_to_bone_name(context.item_slot)');assert.deepEqual(bone.pivot,[0,24,0]);
 assert.equal(bone.cubes[0].origin[0]+8/4,0);assert.equal(bone.cubes[0].origin[1]+(64-56)/4,24);
 const controller=json('../resource_pack/animation_controllers/lava_fishing.animation_controllers.json').animation_controllers['controller.animation.jagsby_nether.rod_use'];
 assert(controller.states.idle.transitions[0].casting.includes('context.is_first_person'));
 assert(controller.states.idle.transitions[0].casting.includes('query.cooldown_time_remaining'));
});

test('reeling early or after a bite never repeats the casting sound',()=>{
 for(const caught of [false,true]){
  const f=fixture(),c=createAnglingController({rng:()=>0});
  if(caught)bite(c,f);else c.use(f.player,0);
  const before=f.sounds.length;c.use(f.player,caught?135:5);
  assert(!f.sounds.slice(before).some(s=>s.id==='random.bow'));
 }
});
test('line origin follows model-tip yaw, crouch and vertical aim without a zero-length yaw vector',()=>{
 const f=fixture();f.player.getViewDirection=()=>({x:0,y:0,z:1});
 const front=rodTip(f.player);assert(front.x<f.player.location.x);assert(front.z>f.player.location.z);
 f.player.getRotation=()=>({x:0,y:90});const turned=rodTip(f.player);
 assert(Math.abs(Math.hypot(front.x,front.z)-Math.hypot(turned.x,turned.z))<1e-6);
 f.player.getHeadLocation=()=>({x:0,y:33.2,z:0});assert(rodTip(f.player).y<front.y);
 f.player.getViewDirection=()=>({x:0,y:-1,z:0});
 assert(Object.values(rodTip(f.player)).every(Number.isFinite));
});

test('casting does not write custom item properties, and legacy IDs are removed without altering other data',()=>{
 const f=fixture(),c=createAnglingController();
 f.rod.setDynamicProperty=()=>{throw Error('New rods must not write custom properties');};
 assert(c.use(f.player,0));
 const legacy=fixture();legacy.rodProperties.set('jagsby_nether:rod_id','old-id');legacy.rodProperties.set('other:addon','keep');
 legacy.durability.damage=20;clearLegacyRodProperties(legacy.player);
 assert(!legacy.rodProperties.has('jagsby_nether:rod_id'));assert.equal(legacy.rodProperties.get('other:addon'),'keep');
 assert.equal(legacy.durability.damage,20);assert.equal(legacy.inventory.get(0),legacy.rod);
});
