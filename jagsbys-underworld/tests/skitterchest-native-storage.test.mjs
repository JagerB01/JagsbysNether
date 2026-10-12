import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,entities,flush,intervals} from './mock-server.mjs';
import {STORAGE,TITLE_MARKER,ensureStorage,moveInventory} from '../behavior_pack/scripts/skitterchest_native_storage.js';
let next=0;
function bag(){const slots=Array(27);return {size:27,clearAll(){slots.fill(undefined);},getItem:i=>slots[i],setItem(i,v){slots[i]=v;}};}
function fixture(){
 const sounds=[],drops=[],spawned=[];
 const dimension={id:'minecraft:nether',spawnItem(item){drops.push(item);},playSound(id){sounds.push(id);},spawnEntity(type,location){const e=entity(type,dimension);e.location={...location};spawned.push(e);return e;}};
 function entity(typeId,dim){
  const data=new Map(),container=bag(),events=[],damage=[];
  const e={id:`native-test-${next++}`,typeId,dimension:dim,location:{x:0,y:30,z:0},isValid:true,container,events,damage,
   getProperty(){return false;},hasComponent(){return true;},getDynamicProperty:k=>data.get(k),setDynamicProperty(k,v){if(v===undefined)data.delete(k);else data.set(k,v);},
   getComponent(){return {container};},triggerEvent(id){events.push(id);},addEffect(){},teleport(location){this.location={...location};},applyDamage(n,options){damage.push({n,options});},remove(){this.isValid=false;entities.delete(this.id);},
  };entities.set(e.id,e);return e;
 }
 const pet=entity('jagsby_nether:crimson_skitterchest',dimension);
 return {pet,spawned,sounds,drops};
}
test('migration preserves all stacks and item data, then uses one native container',()=>{
 const f=fixture();const item={typeId:'minecraft:diamond_sword',amount:1,nameTag:'Keepsake',lore:['original'],enchantments:['mending']};
 f.pet.container.setItem(3,item);const box=ensureStorage(f.pet);
 assert.equal(box.typeId,STORAGE);assert.deepEqual(box.container.getItem(3),item);assert.equal(f.pet.container.getItem(3),undefined);
 box.container.setItem(3,{typeId:'minecraft:apple',amount:4});assert.equal(ensureStorage(f.pet),box);
 assert.equal(box.container.getItem(3).amount,4);assert.equal(f.spawned.length,1);
});
test('failed migration preserves original items and retries without appending duplicates',()=>{
 const from=bag(),to=bag();from.setItem(0,{typeId:'minecraft:diamond',amount:3});
 const setter=to.setItem;to.setItem=(i,v)=>{if(i===5)throw Error('unavailable');setter(i,v);};
 assert.throws(()=>moveInventory(from,to));assert.equal(from.getItem(0).amount,3);
 to.setItem=setter;moveInventory(from,to);assert.equal(from.getItem(0),undefined);assert.equal(to.getItem(0).amount,3);
});
test('an unloaded linked container is never replaced with a duplicated container',()=>{
 const f=fixture();f.pet.setDynamicProperty('jagsby_nether:storage_entity','unloaded-container');
 assert.equal(ensureStorage(f.pet),undefined);system.currentTick+=100;
 assert.equal(ensureStorage(f.pet),undefined);assert.equal(f.spawned.length,0);
});
test('native open/close events pause the pet and play the selected clips',()=>{
 const f=fixture(),box=ensureStorage(f.pet);f.pet.events.length=0;
 world.afterEvents.entityContainerOpened.emit({entity:box});
 assert.deepEqual(f.pet.events,['jagsby_nether:pause_storage']);
 world.afterEvents.entityContainerClosed.emit({entity:box});
 assert.deepEqual(f.pet.events.slice(-2),['jagsby_nether:resume_storage','jagsby_nether:stand']);
 assert.deepEqual(f.sounds,['jagsby_nether.skitterchest.open','jagsby_nether.skitterchest.close']);
});
test('helper hits are cancelled and their calculated damage and attacker reach the actual mob',()=>{
 const f=fixture(),box=ensureStorage(f.pet),attacker={id:'player'};
 const event={hurtEntity:box,damage:6,damageSource:{cause:'entityAttack',damagingEntity:attacker},cancel:false};
 world.beforeEvents.entityHurt.emit(event);assert.equal(event.cancel,true);flush();
 assert.deepEqual(f.pet.damage,[{n:6,options:{cause:'entityAttack',damagingEntity:attacker}}]);
});
test('the native container follows the pet, and owner death drops its items exactly once',()=>{
 const f=fixture(),box=ensureStorage(f.pet);box.container.setItem(0,{typeId:'minecraft:diamond',amount:7});
 f.pet.location={x:4,y:30,z:8};for(const {callback} of intervals)callback();assert.deepEqual(box.location,f.pet.location);
 world.afterEvents.entityDie.emit({deadEntity:f.pet});assert.equal(box.isValid,false);assert.deepEqual(f.drops,[{typeId:'minecraft:diamond',amount:7}]);
 world.afterEvents.entityDie.emit({deadEntity:f.pet});assert.equal(f.drops.length,1);
});

test('a helper spawn callback before ownership is assigned cannot query an invalid entity ID',()=>{
 const f=fixture(),box=f.pet.dimension.spawnEntity(STORAGE,f.pet.location),get=world.getEntity;
 world.getEntity=id=>{assert.equal(typeof id,'string');return get(id);};
 try{
  assert.doesNotThrow(()=>world.afterEvents.entitySpawn.emit({entity:box}));
  assert.doesNotThrow(()=>world.afterEvents.entityContainerOpened.emit({entity:box}));
 }finally{world.getEntity=get;}
});

test('death before migration completes discards the partial copy instead of duplicating native death drops',()=>{
 const f=fixture();f.pet.container.setItem(0,{typeId:'minecraft:diamond',amount:3});
 const spawn=f.pet.dimension.spawnEntity;
 f.pet.dimension.spawnEntity=(type,pos)=>{
  const box=spawn(type,pos),set=box.container.setItem;
  box.container.setItem=(slot,value)=>{if(slot===5)throw Error('copy incomplete');set(slot,value);};
  return box;
 };
 assert.throws(()=>ensureStorage(f.pet));const box=f.spawned[0];
 world.afterEvents.entitySpawn.emit({entity:box});world.afterEvents.entityDie.emit({deadEntity:f.pet});
 assert.equal(box.isValid,false);assert.equal(f.drops.length,0);assert.equal(f.pet.container.getItem(0).amount,3);
});
test('a death while the linked container is unloaded is recorded and dropped once on load',()=>{
 const f=fixture();f.pet.setDynamicProperty('jagsby_nether:storage_entity','delayed-death-box');f.pet.setDynamicProperty('jagsby_nether:storage_migrated',true);
 ensureStorage(f.pet);world.afterEvents.entityDie.emit({deadEntity:f.pet});entities.delete(f.pet.id);
 const box=f.pet.dimension.spawnEntity(STORAGE,f.pet.location);entities.delete(box.id);box.id='delayed-death-box';entities.set(box.id,box);
 box.setDynamicProperty('jagsby_nether:storage_owner',f.pet.id);box.container.setItem(0,{typeId:'minecraft:diamond',amount:5});
 world.afterEvents.entityLoad.emit({entity:box});assert.equal(box.isValid,false);assert.deepEqual(f.drops,[{typeId:'minecraft:diamond',amount:5}]);
 assert.equal(world.getDynamicProperty('jagsby_nether:dead_storage:'+box.id),undefined);
});

// Exercise both existing saved helpers and freshly spawned ones. An empty name
// would restore the minecart fallback; formatting-only must remain nonempty.
test('fresh and existing native helpers use a blank title without naming the visible pet',()=>{
 const f=fixture(),box=ensureStorage(f.pet);
 assert.equal(box.nameTag,TITLE_MARKER);assert.ok(box.nameTag.length>0);
 assert.equal(box.nameTag.replace(/§[0-9a-fk-or]/gi,''),'');
 assert.equal(f.pet.nameTag,undefined);
 box.nameTag='Old container title';
 assert.equal(ensureStorage(f.pet),box);assert.equal(box.nameTag,TITLE_MARKER);
 assert.equal(f.spawned.length,1);
});
test('loading a saved native helper clears its old visible title while preserving its contents',()=>{
 const f=fixture(),box=ensureStorage(f.pet);box.nameTag='Old container title';
 box.container.setItem(4,{typeId:'minecraft:diamond',amount:12});
 world.afterEvents.entityLoad.emit({entity:box});
 assert.equal(box.nameTag,TITLE_MARKER);
 assert.equal(box.container.getItem(4).amount,12);
});
test('normal chest minecarts are not renamed by helper load handling',()=>{
 const f=fixture(),cart=f.pet.dimension.spawnEntity('minecraft:chest_minecart',f.pet.location);
 cart.nameTag='My cart';world.afterEvents.entityLoad.emit({entity:cart});
 assert.equal(cart.nameTag,'My cart');
});
