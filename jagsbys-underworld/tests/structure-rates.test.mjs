import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=path=>JSON.parse(readFileSync(new URL('../.build/behavior_pack/'+path,import.meta.url)));
// Verify the product of a chunk roll and the weighted choice. Checking either
// value alone misses a change to tent frequency when interesting weights rise.
for(const name of ['basalt','crimson_camp','warped_camp','soul','nether_brick','outpost']){
 test(`${name}: every tent keeps its original attempt rate and interesting variants gain 50%`,()=>{
  const rule=load(`feature_rules/${name}.json`)['minecraft:feature_rules'];
  const match=rule.distribution.iterations.match(/<\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/);
  assert(match);const chance=Number(match[1])/Number(match[2]);
  const entries=load(`features/${name}_weighted.json`)['minecraft:weighted_random_feature'].features;
  const total=entries.reduce((n,[,weight])=>n+weight,0);let tents=0,interesting=0;
  for(const [id,weight] of entries){
   const structure=load(`features/${id.split(':')[1]}.json`)['minecraft:structure_template_feature'].structure_name;
   const tent=structure.includes('/tent');
   if(tent)tents++;else {assert(structure.includes('/campground/')||structure.includes('/tower'));interesting++;}
   const oldChance=name==='outpost'?1/384:(tent?1/576:1/288);
   const expected=oldChance*(tent?1:1.5);
   assert(Math.abs(chance*weight/total-expected)<1e-12,structure);
  }
  assert.equal(tents,name==='outpost'?2:10);assert.equal(interesting,name==='outpost'?2:4);
 });
}
