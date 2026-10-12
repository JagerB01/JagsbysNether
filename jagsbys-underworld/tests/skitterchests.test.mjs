import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));

for (const variant of ['crimson', 'warped', 'blackstone']) {
  test(`${variant} storage remains inaccessible until taming and persists after retention`, () => {
    const entity = load(`behavior_pack/entities/skitterchests/${variant}.json`)['minecraft:entity'];
    const active = new Set();
    function event(name) {
      const action = entity.events[name];
      for (const group of action.remove?.component_groups ?? []) active.delete(group);
      for (const group of action.add?.component_groups ?? []) {
        assert(entity.component_groups[group], `missing component group ${group}`);
        active.add(group);
      }
    }
    const components = () => Object.assign({}, entity.components, ...[...active].map(g => entity.component_groups[g]));
    for (const name of ['minecraft:entity_spawned']) {
      event(name);
      assert.equal(components()['minecraft:inventory'], undefined);
    }
    if (variant !== 'blackstone') {
      assert.equal(components()['minecraft:tameable'].tame_items, 'netherite_scrap');
      event('minecraft:on_tame');
      event('jagsby_nether:retain_storage');
      assert.deepEqual(components()['minecraft:persistent'], {});
      assert.deepEqual(components()['minecraft:is_tamed'], {});
      assert.equal(components()['minecraft:inventory'].inventory_size, 27);
      assert.equal(entity.description.runtime_identifier, undefined);
    } else {
      assert.equal(entity.description.runtime_identifier, undefined);
      assert.equal(entity.events['jagsby_nether:retain_storage'], undefined);
    }
    for (const cs of [entity.components, ...Object.values(entity.component_groups)]) {
      for (const banned of ['minecraft:rideable', 'minecraft:behavior.mount_pathing', 'minecraft:breedable', 'minecraft:behavior.breed']) assert.equal(cs[banned], undefined);
      if (variant === 'blackstone') {
        assert.equal(cs['minecraft:tameable'], undefined);
        assert.equal(cs['minecraft:inventory'], undefined);
      }
    }
    const client = load(`resource_pack/entity/skitterchests/${variant}.json`)['minecraft:client_entity'].description;
    assert.equal(client.identifier, entity.description.identifier);
    assert.equal(entity.description.is_spawnable, false);
    const egg = load(`behavior_pack/items/skitterchests/${variant}_spawn_egg.json`)['minecraft:item'];
    assert.equal(egg.components['minecraft:entity_placer'].entity, entity.description.identifier);
    assert.deepEqual(egg.components['minecraft:entity_placer'].use_on, []);
    const model = load(`resource_pack/models/entity/skitterchests/${variant}.geo.json`)['minecraft:geometry'][0];
    assert.equal(model.description.identifier, client.geometry.default);
    const animations = load(`resource_pack/animations/skitterchests/${variant}.json`).animations;
    const bones = new Set(model.bones.map(b => b.name));
    for (const [name, animation] of Object.entries(animations)) {
      assert(Object.values(client.animations).includes(name));
      for (const bone of Object.keys(animation.bones ?? {})) assert(bones.has(bone), `unknown bone ${bone}`);
    }
    const atlas = load('resource_pack/textures/item_texture.json').texture_data;
    assert(atlas[client.spawn_egg.texture]);
    assert.equal(load(`behavior_pack/spawn_rules/skitterchests/${variant}.json`)['minecraft:spawn_rules'].description.identifier, client.identifier);
  });
}

test('selected full-length Ogg clips stay registered without ineffective native chest sound maps', () => {
  const definitions = load('resource_pack/sounds/sound_definitions.json').sound_definitions;
  for (const event of ['open', 'close']) {
    for (const path of definitions[`jagsby_nether.skitterchest.${event}`].sounds) {
      const data = readFileSync(new URL(`../resource_pack/${path}.ogg`, import.meta.url));
      assert.equal(data.subarray(0, 4).toString(), 'OggS');
    }
  }
  for (const entity of Object.values(load('resource_pack/sounds.json').entity_sounds.entities)) {
    assert.equal(entity.events['chest.open'], undefined);
    assert.equal(entity.events['chest.closed'], undefined);
  }
});

for(const variant of ['crimson','warped'])test(`${variant} repeated sit/stand restores movement after destructive group removal`,()=>{
 const e=load(`behavior_pack/entities/skitterchests/${variant}.json`)['minecraft:entity'];
 const components={...e.components};
 function apply(name){
  for(const step of e.events[name].sequence??[e.events[name]]){
   for(const group of step.remove?.component_groups??[]){
    for(const component of Object.keys(e.component_groups[group]))delete components[component];
   }
   for(const group of step.add?.component_groups??[])Object.assign(components,e.component_groups[group]);
  }
 }
 apply('minecraft:entity_spawned');apply('minecraft:on_tame');
 for(let cycle=0;cycle<10;cycle++){
  apply('jagsby_nether:sit');assert.equal(components['minecraft:movement'].value,0);
  apply('jagsby_nether:stand');assert.equal(components['minecraft:movement'].value,0.3);
  assert.equal(components['minecraft:lava_movement'].value,0.3);
  assert.deepEqual(components['minecraft:jump.static'],{jump_power:0.42});
  assert(components['minecraft:behavior.follow_owner']);
 }
});
