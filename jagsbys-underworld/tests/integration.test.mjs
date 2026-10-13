import test from 'node:test';
import assert from 'node:assert/strict';
import {components, itemComponents, startup, world, system, intervals, jobs, timeouts, flush, entities} from './mock-server.mjs';
import {worldFixture, playerFixture} from './fixtures.mjs';
import {RECORD_PREFIX} from '../.build/behavior_pack/scripts/settlements/navigation.js';
import '../.build/behavior_pack/scripts/main.js';
import {FISH,ROD} from '../.build/behavior_pack/scripts/lava_fishing/angling.js';
startup();

test('one combined entry registers crop components and all subsystem schedules exactly once', () => {
  assert.deepEqual([...components.keys()].sort(), ['jagsby_nether:crop', 'jagsby_nether:farmland', 'jagsby_nether:tillable_soil']);
  assert.deepEqual(intervals.map(i => i.ticks).sort((a,b) => a-b), [1,1,1,10,20,20,100,100]);
  assert.deepEqual([...itemComponents.keys()], ['jagsby_nether:lava_fishing_rod']);
  for (const {callback} of intervals) assert.doesNotThrow(callback);
});
test('agriculture starter command is handled once without scheduling a village', () => {
  const {dimension} = worldFixture(); const {player, gifts} = playerFixture(dimension);
  const count = jobs.length;
  system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:kit', message:'', sourceEntity:player});
  assert.equal(gifts.length, 10); assert.equal(jobs.length, count);
});
test('village command reaches settlement generator without giving a crop kit', () => {
  const {dimension} = worldFixture(); const {player, gifts} = playerFixture(dimension);
  const count = timeouts.length;
  system.afterEvents.scriptEventReceive.emit({id:'nether_settlements:test', message:'crimson', sourceEntity:player});
  assert.equal(timeouts.length, count+1); assert.equal(gifts.length, 0);
  assert.equal(typeof timeouts.at(-1).callback, 'function');
});
test('village lookup and crop kit coexist on the same player', () => {
  const {dimension} = worldFixture(); const {player, gifts, messages} = playerFixture(dimension);
  world.setDynamicProperty(`${RECORD_PREFIX}test`, JSON.stringify({x:10,y:65,z:20,theme:'warped',houses:5,roads:4}));
  system.afterEvents.scriptEventReceive.emit({id:'nether_settlements:find', message:'village', sourceEntity:player});
  assert(messages.some(m => m.includes('Nearest recorded warped village')));
  system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:kit', message:'', sourceEntity:player});
  assert.equal(gifts.length, 10);
});

test('fishing kit gives exactly one rod and seven fish without a crop kit or generation job',()=>{
 const {dimension}=worldFixture();const {player,gifts}=playerFixture(dimension);const before=jobs.length;
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:fishing_kit',sourceEntity:player});
 assert.equal(gifts.length,8);assert.equal(gifts[0].typeId,'jagsby_nether:obsidian_fishing_rod');
 assert.deepEqual(gifts.map(item=>item.typeId),[ROD,...FISH.map(f=>`jagsby_nether:${f}`)]);
 assert.equal(new Set(gifts.map(item=>item.typeId)).size,8);assert.equal(jobs.length,before);
});

test('instant rod global and component use events launch once and ignore other items',()=>{
 const props=new Map(),rod={typeId:'jagsby_nether:obsidian_fishing_rod',getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),getComponent:()=>undefined};
 let launches=0,impulses=0,removed=0;
 const bobber={applyImpulse(){impulses++;},remove(){removed++;}};
 const dimension={id:'minecraft:nether',spawnEntity(type){assert.equal(type,'jagsby_nether:lava_bobber');launches++;return bobber;},playSound(){}};
 const player={id:'instant-fishing-test',typeId:'minecraft:player',selectedSlotIndex:0,location:{x:0,y:32,z:0},dimension,getGameMode:()=> 'Survival',getRotation:()=>({x:0,y:0}),playAnimation(){},startItemCooldown(){},getComponent:()=>({container:{getItem:()=>rod,setItem(){}}}),getHeadLocation:()=>({x:0,y:33.6,z:0}),getViewDirection:()=>({x:0,y:0,z:1})};
 world.afterEvents.itemUse.emit({source:player,itemStack:rod});
 itemComponents.get('jagsby_nether:lava_fishing_rod').onUse({source:player});
 itemComponents.get('jagsby_nether:lava_fishing_rod').onUseOn({source:player});
 assert.equal(launches,1);assert.equal(impulses,1);assert.equal(removed,0);
 world.afterEvents.itemUse.emit({source:player,itemStack:{typeId:'minecraft:stick'}});assert.equal(removed,0);
 world.afterEvents.playerLeave.emit({playerId:player.id});assert.equal(removed,1);
});

test('only tamed Crimson and Warped interactions retain storage', () => {
  const retained = [];
  for (const variant of ['crimson', 'warped', 'blackstone']) {
    for (const tamed of [false, true]) {
      world.afterEvents.playerInteractWithEntity.emit({target: {
        typeId: `jagsby_nether:${variant}_skitterchest`,
        getProperty() { return tamed; }, hasComponent() { return tamed; },
        getDynamicProperty(key) {return key.endsWith(':storage_entity') ? 'pending-helper' : undefined;},
        triggerEvent(event) { retained.push(event); },
      }});
    }
  }
  world.afterEvents.playerInteractWithEntity.emit({target: {
    typeId: 'minecraft:cow', triggerEvent() { assert.fail('unrelated mob changed'); },
  }});
  assert.deepEqual(retained, Array(2).fill('jagsby_nether:retain_storage'));
});

test('crouching toggles tamed pets; standing storage never toggles sitting', () => {
  for (const sitting of [false, true]) {
    const calls = [];
    const target = {
      typeId: 'jagsby_nether:crimson_skitterchest',
      getProperty(name) { return name.endsWith(':tamed') || sitting; },
      hasComponent() { return true; },
      getDynamicProperty(key) {return key.endsWith(':storage_entity') ? 'pending-helper' : undefined;},
      triggerEvent(name) { calls.push(name); },
      dimension:{id:'minecraft:nether'},location:{x:0,y:0,z:0},getComponent(){},
    };
    const standing = {target, player: {isSneaking: true}, cancel: false};
    world.beforeEvents.playerInteractWithEntity.emit(standing);
    assert.equal(standing.cancel, true);
    assert.deepEqual(calls, []); // Before-events are read-only: mutations defer.
    flush();
    assert.deepEqual(calls, ['jagsby_nether:retain_storage', `jagsby_nether:${sitting ? 'stand' : 'sit'}`]);
    calls.length = 0;
    const crouching = {target, player: {id:'menu-test',isSneaking: false,dimension:{id:'minecraft:nether'},location:{x:0,y:0,z:0}}, cancel: false};
    world.beforeEvents.playerInteractWithEntity.emit(crouching);
    flush();
    assert.equal(crouching.cancel, true);
    assert.deepEqual(calls, []);
  }
});

test('Scrap taming stays available while Blackstone and other mobs cannot enter pet controls', () => {
  function target(typeId) {
    return {typeId, getProperty() {return false;}, hasComponent() {return false;},
      triggerEvent() {assert.fail('wild mob received sit/stand');}};
  }
  for (const variant of ['crimson', 'warped', 'blackstone']) {
    const use = {target: target(`jagsby_nether:${variant}_skitterchest`),
      player: {isSneaking: false}, itemStack: {typeId: 'minecraft:netherite_scrap'}, cancel: false};
    world.beforeEvents.playerInteractWithEntity.emit(use);
    assert.equal(use.cancel, variant === 'blackstone');
    const crouching = {...use, player: {isSneaking: true}, cancel: false};
    world.beforeEvents.playerInteractWithEntity.emit(crouching);
    assert.equal(crouching.cancel, true);
  }
  const cow = {target: target('minecraft:cow'), player: {isSneaking: false}, cancel: false};
  world.beforeEvents.playerInteractWithEntity.emit(cow);
  assert.equal(cow.cancel, false);
  flush();
});


test('Skitterchest overhead labels are cleared without renaming unrelated mobs',()=>{
 for(const signal of [world.afterEvents.entitySpawn,world.afterEvents.entityLoad]){
  for(const variant of ['crimson','warped']){
   const entity={typeId:`jagsby_nether:${variant}_skitterchest`,nameTag:'',location:{x:0,y:64,z:0},
    dimension:{heightRange:{min:0,max:256},getBlocks(){return {getBlockLocationIterator(){return [];}};}},
    getProperty(){return false;},hasComponent(){return false;},getComponent(){return undefined;}};
   entity.nameTag='Skitterchest';signal.emit({entity});assert.equal(entity.nameTag,'');
   entity.nameTag='My pet';signal.emit({entity});assert.equal(entity.nameTag,'');
  }
  const minecart={typeId:'minecraft:chest_minecart',nameTag:'',hasComponent(){return false;},getProperty(){return undefined;},getComponent(){return undefined;}};
  signal.emit({entity:minecart});assert.equal(minecart.nameTag,'');
 }
});


test('standing use of the hidden native container passes through; crouching routes to the actual pet',()=>{
 const calls=[];
 const pet={id:'native-routing-pet',typeId:'jagsby_nether:crimson_skitterchest',
   getProperty(name){return name.endsWith(':tamed');},hasComponent(){return true;},
   getDynamicProperty(key){return key.endsWith(':storage_entity')?'native-routing-box':key.endsWith(':storage_migrated')?true:undefined;},
   triggerEvent(name){calls.push(name);},
 };
 const box={id:'native-routing-box',typeId:'jagsby_nether:skitterchest_storage',getDynamicProperty(){return pet.id;}};
 entities.set(pet.id,pet);entities.set(box.id,box);
 const standing={target:box,player:{isSneaking:false},cancel:false};
 world.beforeEvents.playerInteractWithEntity.emit(standing);flush();
 assert.equal(standing.cancel,false);assert.deepEqual(calls,[]);
 const crouching={target:box,player:{isSneaking:true},cancel:false};
 world.beforeEvents.playerInteractWithEntity.emit(crouching);flush();
 assert.equal(crouching.cancel,true);assert(calls.includes('jagsby_nether:sit'));
});
