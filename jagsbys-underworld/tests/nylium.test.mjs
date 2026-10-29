import test from 'node:test';
import assert from 'node:assert/strict';
import {spreadNylium} from '../behavior_pack/scripts/agriculture/nylium.js';
import {worldFixture} from './fixtures.mjs';
test('bone meal grows a surface patch, respecting biome boundaries and covered blocks', () => {
 const w=worldFixture();
 w.dimension.getBiome=({x})=>({id:x<0?'minecraft:crimson_forest':'minecraft:warped_forest'});
 for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)w.put('minecraft:netherrack',{x,y:64,z});
 w.put('minecraft:blackstone',{x:1,y:65,z:0});
 assert.ok(spreadNylium(w.dimension.getBlock({x:0,y:64,z:0}),()=>0)>10);
 assert.equal(w.dimension.getBlock({x:-1,y:64,z:0}).typeId,'minecraft:crimson_nylium');
 assert.equal(w.dimension.getBlock({x:1,y:64,z:1}).typeId,'minecraft:warped_nylium');
 assert.equal(w.dimension.getBlock({x:1,y:64,z:0}).typeId,'minecraft:netherrack');
});
test('unknown biomes, other dimensions and unavailable chunks do not change terrain', () => {
 for(const dim of ['minecraft:nether','minecraft:overworld']){
  const w=worldFixture(dim);const b=w.put('minecraft:netherrack');
  w.dimension.getBiome=()=>({id:'minecraft:nether_wastes'});
  assert.equal(spreadNylium(b),0);assert.equal(b.writes,0);
 }
});
