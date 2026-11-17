import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(read(path));
test('Glowhusk preserves both supplied textures and model dimensions/UVs', () => {
  const geometries = json('resource_pack/models/blocks/glowhusk.geo.json')['minecraft:geometry'];
  for (const state of ['empty', 'full']) {
    const source = json(`assets/glowhusk/Glowhusk_${state[0].toUpperCase()+state.slice(1)}.bbmodel`);
    const geometry = geometries.find(g => g.description.identifier === source.model_identifier);
    assert(geometry);
    assert.equal(geometry.description.texture_width, source.resolution.width);
    assert.equal(geometry.description.texture_height, source.resolution.height);
    assert.deepEqual(read(`resource_pack/textures/blocks/glowhusk_${state}.png`), Buffer.from(source.textures[0].source.split(',')[1], 'base64'));
    const cube = geometry.bones[0].cubes[0];
    assert.deepEqual(cube.origin, [-8, 0, -8]);
    assert.deepEqual(cube.size, [16, 16, 16]);
    for (const [face, data] of Object.entries(source.elements[0].faces)) {
      assert.deepEqual(cube.uv[face].uv, data.uv.slice(0, 2));
      assert.deepEqual(cube.uv[face].uv_size, [data.uv[2]-data.uv[0], data.uv[3]-data.uv[1]]);
    }
  }
});
test('harvest-ready wax level selects full artwork, all earlier levels use empty', () => {
  const hive = json('behavior_pack/blocks/glowhusk.json')['minecraft:block'];
  assert.deepEqual(hive.description.states['jagsby_nether:wax_level'], [0,1,2,3,4,5]);
  assert.equal(hive.components['minecraft:geometry'], 'geometry.glowhusk_empty');
  assert.equal(hive.components['minecraft:material_instances']['*'].texture, 'jagsby_glowhusk_empty');
  assert.equal(hive.permutations.length, 1);
  assert.equal(hive.permutations[0].condition, "query.block_state('jagsby_nether:wax_level') == 5");
  assert.equal(hive.permutations[0].components['minecraft:geometry'], 'geometry.glowhusk_full');
  assert.equal(hive.permutations[0].components['minecraft:material_instances']['*'].texture, 'jagsby_glowhusk_full');
});
test('PBR texture sets ship compatible layers with matching dimensions', () => {
  assert(json('resource_pack/manifest.json').capabilities.includes('pbr'));
  const paths = readdirSync(new URL('resource_pack/textures', root), {recursive:true});
  for (const path of paths.filter(p => p.endsWith('.texture_set.json'))) {
    const set = json(`resource_pack/textures/${path}`)['minecraft:texture_set'];
    assert(set.color);
    assert(!(set.normal && set.heightmap));
    assert(!(set.metalness_emissive_roughness && set.metalness_emissive_roughness_subsurface));
    const folder = path.slice(0, path.lastIndexOf('/')+1);
    let size;
    for (const [layer, value] of Object.entries(set)) {
      if (typeof value !== 'string' || value.startsWith('#')) continue;
      const png = read(`.build/resource_pack/textures/${folder}${value}.png`);
      assert.equal(png.subarray(1,4).toString(), 'PNG');
      const dimensions = [png.readUInt32BE(16), png.readUInt32BE(20)];
      size ??= dimensions;
      assert.deepEqual(dimensions, size, `${path}: ${layer}`);
      if (layer === 'metalness_emissive_roughness') assert([2,6].includes(png[25]), `${path} requires RGB/RGBA MER`);
    }
  }
});
