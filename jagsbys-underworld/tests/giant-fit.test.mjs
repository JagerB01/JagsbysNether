import test from 'node:test';
import assert from 'node:assert/strict';
import {BlockVolume} from './mock-server.mjs';
import {assessGiantSite,chooseFittingGiant,footprintSurveyCache,FIT_ORDER,surveyGiant} from '../behavior_pack/scripts/giant_fit.js';
import {surveyLandmark} from '../behavior_pack/scripts/landmark_terrain.js';
function finish(job){for(let i=0;i<50000;i++){const s=job.next();if(s.done)return s.value;}assert.fail('Assessment did not finish');}
test('selection waits until all three size assessments finish',()=>{
 const calls=[];function* survey(c){calls.push(c.id);yield;return {outcome:'ready',origin:{x:0,y:33,z:0},supports:[],box:{x:0,z:0,sx:1,sz:1}};}
 const job=assessGiantSite({x:0,z:0,selectionRoll:.95},{},{survey});
 assert.equal(job.next().done,false);assert.deepEqual(calls,['dragon_arena']);
 assert.equal(job.next().done,false);assert.deepEqual(calls,['dragon_arena','large_arena']);
 assert.equal(job.next().done,false);assert.deepEqual(calls,FIT_ORDER);
 const result=job.next();assert.equal(result.done,true);assert.equal(result.value.id,'mega_fortress');
});
test('incomplete largest assessment defers selection even if smaller builds could fit',()=>{
 const calls=[];function* survey(c){calls.push(c.id);return c.id==='dragon_arena'?{outcome:'deferred',reason:'Unloaded'}:{outcome:'ready'};}
 const result=finish(assessGiantSite({x:0,z:0,selectionRoll:0},{},{survey}));assert.equal(result.outcome,'deferred');assert.equal(result.id,undefined);assert.deepEqual(calls,['dragon_arena']);
});
test('confirmed size failures prevent placement, and incomplete checks defer',()=>{
 const calls=[];function* survey(c){calls.push(c.id);return c.id==='mega_fortress'?{outcome:'unsuitable',reason:'Ocean too small'}:{outcome:'ready'};}
 const result=finish(assessGiantSite({x:0,z:0,selectionRoll:.8},{},{survey}));assert.deepEqual(calls,FIT_ORDER);assert.equal(result.id,undefined);assert.equal(result.outcome,'unsuitable');assert.match(result.reason,/all three giants/);
 function* incomplete(c){return c.id==='large_arena'?{outcome:'deferred',reason:'Loading timed out'}:{outcome:'ready'};}
 assert.equal(finish(assessGiantSite({x:0,z:0,selectionRoll:.99},{},{survey:incomplete})).outcome,'deferred');
});
test('all three qualifying starting footprints restore 60/25/15 selection',()=>{
 const all=['large_arena','dragon_arena','mega_fortress'];assert.equal(chooseFittingGiant(all,.599),'large_arena');assert.equal(chooseFittingGiant(all,.6),'dragon_arena');assert.equal(chooseFittingGiant(all,.85),'mega_fortress');
 assert.equal(chooseFittingGiant(['large_arena','dragon_arena'],.8),undefined);assert.equal(chooseFittingGiant(['large_arena'],.99),undefined);assert.equal(chooseFittingGiant([],0),undefined);
});
test('clear-volume proofs are reused for contained queries, with different filters and obstructions rechecked',()=>{
 let reads=0,queries=0;const d={getBlock:p=>{reads++;return {typeId:'minecraft:air'};},containsBlock(){queries++;return false;}};
 const cache=footprintSurveyCache(d),filter={excludeTypes:['minecraft:air']};cache.getBlock({x:1,y:32,z:1});cache.getBlock({x:1,y:32,z:1});assert.equal(reads,1);
 assert.equal(cache.containsBlock(new BlockVolume({x:0,y:32,z:0},{x:15,y:90,z:15}),filter,false),false);
 cache.containsBlock(new BlockVolume({x:1,y:40,z:1},{x:10,y:80,z:10}),filter,false);assert.equal(queries,1);
 cache.containsBlock(new BlockVolume({x:1,y:40,z:1},{x:10,y:80,z:10}),{excludeTypes:['minecraft:air','minecraft:lava']},false);assert.equal(queries,2);
});
test('shared size assessment preserves the selected plan while reducing native reads and volume queries',()=>{
 function fixture(){let reads=0,queries=0;return {get reads(){return reads;},get queries(){return queries;},d:{id:'minecraft:nether',runCommand(){},getBiome:()=>({id:'minecraft:hell'}),getBlock:({y})=>{reads++;return {typeId:y<=4?'minecraft:netherrack':y<=31?'minecraft:lava':'minecraft:air'};},containsBlock(){queries++;return false;}}};}
 const c={family:'giant',gx:0,gz:0,x:800,z:800,selectionRoll:.9},baseline=fixture(),cached=fixture();
 function* uncached(c,d,progress){return yield* surveyGiant(c,d,progress);}
 const a=finish(assessGiantSite(c,baseline.d,{survey:uncached})),b=finish(assessGiantSite(c,cached.d));assert.deepEqual(b,a);assert(cached.reads<baseline.reads);assert(cached.queries<baseline.queries);
});

test('a narrow lava opening surrounded by terrain is rejected rather than carved for a giant',()=>{
 const d={id:'minecraft:nether',runCommand(){},getBlock:({x,y})=>({typeId:y<=4?'minecraft:netherrack':Math.abs(x)<=16?(y<=31?'minecraft:lava':'minecraft:air'):(y<=90?'minecraft:netherrack':'minecraft:air')}),
 containsBlock:v=>v.from.y===31&&v.to.y===31&&(v.from.x<-16||v.to.x>16)};
 const result=finish(assessGiantSite({x:0,z:0,selectionRoll:0},d));assert.equal(result.outcome,'unsuitable');assert.match(result.reason,/footprint|lava/);
});
