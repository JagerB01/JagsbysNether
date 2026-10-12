import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));

for (const variant of ['crimson', 'warped', 'blackstone']) {
  test(`${variant} storage survives its spawn, anger, calm and retention events`, () => {
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
    for (const name of ['minecraft:entity_spawned', 'minecraft:become_angry', 'minecraft:on_calm', 'jagsby_nether:retain_storage']) {
      event(name);
      assert.equal(components()['minecraft:inventory'].inventory_size, 27);
    }
    assert.deepEqual(components()['minecraft:persistent'], {});
    if (variant !== 'blackstone') {
      assert.equal(components()['minecraft:tameable'].tame_items, 'netherite_scrap');
      event('minecraft:on_tame');
      assert.deepEqual(components()['minecraft:is_tamed'], {});
      assert.equal(components()['minecraft:inventory'].inventory_size, 27);
    }
    for (const cs of [entity.components, ...Object.values(entity.component_groups)]) {
      for (const banned of ['minecraft:rideable', 'minecraft:behavior.mount_pathing', 'minecraft:breedable', 'minecraft:behavior.breed']) assert.equal(cs[banned], undefined);
      if (variant === 'blackstone') assert.equal(cs['minecraft:tameable'], undefined);
    }
    const client = load(`resource_pack/entity/skitterchests/${variant}.json`)['minecraft:client_entity'].description;
    assert.equal(client.identifier, entity.description.identifier);
    assert.equal(entity.description.is_spawnable, true);
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
