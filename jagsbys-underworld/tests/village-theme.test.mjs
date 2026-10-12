import test from 'node:test';
import assert from 'node:assert/strict';
import {themeAt} from '../.build/behavior_pack/scripts/settlements/main.js';
for(const [biome,theme] of [['minecraft:hell','crimson'],['minecraft:nether_wastes','crimson'],['minecraft:crimson_forest','crimson'],['minecraft:warped_forest','warped'],['minecraft:soulsand_valley','warped']]){
 test(`${biome} selects ${theme} from the actual biome instead of decorative blocks`,()=>{
  const dimension={getBiome(){return {id:biome};},getBlock(){throw Error('Known biome should not sample blocks');}};
  assert.equal(themeAt(dimension,0,64,0),theme);
 });
}
