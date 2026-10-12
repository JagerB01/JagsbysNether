import test from 'node:test';
import assert from 'node:assert/strict';
import {components, itemComponents, startup, world, system, intervals, jobs, flush} from './mock-server.mjs';
import {worldFixture, playerFixture} from './fixtures.mjs';
import {RECORD_PREFIX} from '../.build/behavior_pack/scripts/settlements/navigation.js';
import '../.build/behavior_pack/scripts/main.js';
startup();

test('one combined entry registers crop components and all subsystem schedules exactly once', () => {
  assert.deepEqual([...components.keys()].sort(), ['jagsby_nether:crop', 'jagsby_nether:farmland', 'jagsby_nether:tillable_soil']);
  assert.deepEqual(intervals.map(i => i.ticks).sort((a,b) => a-b), [1,1,100]);
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
  const count = jobs.length;
  system.afterEvents.scriptEventReceive.emit({id:'nether_settlements:test', message:'crimson', sourceEntity:player});
  assert.equal(jobs.length, count+1); assert.equal(gifts.length, 0);
  assert.equal(typeof jobs.at(-1).next, 'function');
});
test('village lookup and crop kit coexist on the same player', () => {
  const {dimension} = worldFixture(); const {player, gifts, messages} = playerFixture(dimension);
  world.setDynamicProperty(`${RECORD_PREFIX}test`, JSON.stringify({x:10,y:65,z:20,theme:'warped',houses:5,roads:4}));
  system.afterEvents.scriptEventReceive.emit({id:'nether_settlements:find', message:'village', sourceEntity:player});
  assert(messages.some(m => m.includes('Nearest recorded warped village')));
  system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:kit', message:'', sourceEntity:player});
  assert.equal(gifts.length, 10);
});

test('fishing kit gives exactly one rod and nine fish without a crop kit or generation job',()=>{
 const {dimension}=worldFixture();const {player,gifts}=playerFixture(dimension);const before=jobs.length;
 system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:fishing_kit',sourceEntity:player});
 assert.equal(gifts.length,10);assert.equal(gifts[0].typeId,'jagsby_nether:obsidian_fishing_rod');
 assert.equal(new Set(gifts.map(item=>item.typeId)).size,10);assert.equal(jobs.length,before);
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
        triggerEvent(event) { retained.push(event); },
      }});
    }
  }
  world.afterEvents.playerInteractWithEntity.emit({target: {
    typeId: 'minecraft:cow', triggerEvent() { assert.fail('unrelated mob changed'); },
  }});
  assert.deepEqual(retained, Array(2).fill('jagsby_nether:retain_storage'));
});

test('standing use toggles tamed pets without opening storage; crouching keeps native access', () => {
  for (const sitting of [false, true]) {
    const calls = [];
    const target = {
      typeId: 'jagsby_nether:crimson_skitterchest',
      getProperty(name) { return name.endsWith(':tamed') || sitting; },
      hasComponent() { return true; },
      triggerEvent(name) { calls.push(name); },
    };
    const standing = {target, player: {isSneaking: false}, cancel: false};
    world.beforeEvents.playerInteractWithEntity.emit(standing);
    assert.equal(standing.cancel, true);
    assert.deepEqual(calls, []); // Before-events are read-only: mutations defer.
    flush();
    assert.deepEqual(calls, ['jagsby_nether:retain_storage', `jagsby_nether:${sitting ? 'stand' : 'sit'}`]);
    calls.length = 0;
    const crouching = {target, player: {isSneaking: true}, cancel: false};
    world.beforeEvents.playerInteractWithEntity.emit(crouching);
    flush();
    assert.equal(crouching.cancel, false);
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


test('Skitterchest names give native storage a title without renaming other mobs or player-named pets',()=>{
 for(const signal of [world.afterEvents.entitySpawn,world.afterEvents.entityLoad]){
  for(const variant of ['crimson','warped']){
   const entity={typeId:`jagsby_nether:${variant}_skitterchest`,nameTag:''};
   signal.emit({entity});assert.equal(entity.nameTag,'Skitterchest');
   entity.nameTag='My pet';signal.emit({entity});assert.equal(entity.nameTag,'My pet');
  }
  const minecart={typeId:'minecraft:chest_minecart',nameTag:''};
  signal.emit({entity:minecart});assert.equal(minecart.nameTag,'');
 }
});

test('real inventory open/close events play the selected clips only for tamed storage pets',()=>{
  const sounds=[];
  function entity(typeId,tamed=true){return {
    typeId,location:{x:10,y:30,z:20},getProperty(){return tamed;},hasComponent(){return tamed;},
    dimension:{playSound(sound,position){sounds.push({sound,position});}},
  };}
  for(const variant of ['crimson','warped']){
    const pet=entity(`jagsby_nether:${variant}_skitterchest`);
    world.afterEvents.entityContainerOpened.emit({entity:pet});
    world.afterEvents.entityContainerClosed.emit({entity:pet});
  }
  for(const ignored of [entity('jagsby_nether:crimson_skitterchest',false),entity('jagsby_nether:blackstone_skitterchest'),entity('minecraft:chest_minecart')]){
    world.afterEvents.entityContainerOpened.emit({entity:ignored});
    world.afterEvents.entityContainerClosed.emit({entity:ignored});
  }
  assert.deepEqual(sounds.map(e=>e.sound),['jagsby_nether.skitterchest.open','jagsby_nether.skitterchest.close','jagsby_nether.skitterchest.open','jagsby_nether.skitterchest.close']);
  assert(sounds.every(e=>e.position.x===10 && e.position.y===30 && e.position.z===20));
});
