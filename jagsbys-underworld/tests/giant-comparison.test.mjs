import test from 'node:test';
import assert from 'node:assert/strict';
import {compareGiantSites,FIT_ORDER} from '../behavior_pack/scripts/giant_fit.js';
import {sampleSiteQuality} from '../behavior_pack/scripts/site_quality.js';
function finish(job){let step;do{step=job.next();}while(!step.done);return step.value;}
function ready(c){return {outcome:'ready',fitting:FIT_ORDER,plans:Object.fromEntries(FIT_ORDER.map(id=>[id,{outcome:'ready',id,coverage:c.coverage,carveFraction:c.carve,supports:[],origin:{x:c.x,y:33,z:0}}]))};}
test('bounded comparison checks only three sites and chooses quality over first eligibility',()=>{
 const sites=[{x:0,coverage:.9,carve:.3},{x:1,coverage:1,carve:.05},{x:2,coverage:.95,carve:.1},{x:3,coverage:1,carve:0}],seen=[];
 function* assess(c){assert(c.compareQuality);seen.push(c.x);yield;return ready(c);}
 const result=finish(compareGiantSites(sites,{}, {assess}));assert.deepEqual(seen,[0,1,2]);assert.equal(result.candidate.x,1);assert.equal(result.candidate.selected,true);
});
test('failed and deferred sites cannot displace a confirmed fit or stall the comparison',()=>{
 const reports=[];function* assess(c){return c.x===0?{outcome:'deferred'}:c.x===1?{outcome:'unsuitable'}:ready(c);}
 const result=finish(compareGiantSites([{x:0},{x:1},{x:2,coverage:1,carve:0}],{}, {assess,onResult:(c,p)=>reports.push(p.outcome)}));
 assert.deepEqual(reports,['deferred','unsuitable','ready']);assert.equal(result.candidate.x,2);
 assert.equal(finish(compareGiantSites([{x:0},{x:1}],{},{assess})).outcome,'no_ready_site');
});
test('comparison does not reserve anything early and honors the latest one-shot giant choice',()=>{
 let forced='large_arena';function* assess(c){yield;return ready(c);}
 const job=compareGiantSites([{x:0,coverage:1,carve:0,selectionRoll:0}],{},{assess,forcedId:()=>forced});assert.equal(job.next().done,false);forced='mega_fortress';
 const result=finish(job);assert.equal(result.plan.id,'mega_fortress');assert.equal(result.candidate.id,'mega_fortress');
});
test('quality sampling performs 27 yielding reads per loaded section and distinguishes solid terrain',()=>{
 let reads=0;const stats={solid:0,total:0};const d={getBlock:p=>{reads++;return {typeId:p.x<5?'minecraft:netherrack':'minecraft:air'};}};
 finish(sampleSiteQuality(d,{x:0,y:33,z:0},[11,20,11],stats));assert.equal(reads,27);assert.equal(stats.total,27);assert.equal(stats.solid,9);
});
test('comparison stops at the next site boundary when no Nether players remain',()=>{
 let online=true;const seen=[];function* assess(c){seen.push(c.x);yield;return ready(c);}
 const job=compareGiantSites([{x:0},{x:1}],{},{assess,canContinue:()=>online});job.next();online=false;assert.equal(finish(job).outcome,'paused');assert.deepEqual(seen,[0]);
});
