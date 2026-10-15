import test from 'node:test';
import assert from 'node:assert/strict';
import {nextGiant,nextGiantCommand,consumeNextGiant} from '../behavior_pack/scripts/next_giant.js';
import {assessGiantSite,FIT_ORDER} from '../behavior_pack/scripts/giant_fit.js';
function storage(){const values=new Map();return {getDynamicProperty:k=>values.get(k),setDynamicProperty:(k,v)=>values.set(k,v)};}
function result(job){let step;do{step=job.next();}while(!step.done);return step.value;}
test('one-shot command persists a valid choice, rejects invalid input and clears explicitly',()=>{
 const s=storage();nextGiantCommand('dragon_arena',s);const choice=nextGiant(s);
 assert.equal(choice.id,'dragon_arena');assert.match(nextGiantCommand('status',s),/dragon_arena/);
 assert.match(nextGiantCommand('small_arena',s),/Use/);assert.deepEqual(nextGiant(s),choice);
 nextGiantCommand('clear',s);assert.equal(nextGiant(s),undefined);
});
test('replacement choice cannot be consumed by an older in-flight survey',()=>{
 const s=storage();nextGiantCommand('mega_fortress',s);const first=nextGiant(s);
 nextGiantCommand('mega_fortress',s);assert.equal(consumeNextGiant(first,s),false);
 assert.equal(consumeNextGiant(nextGiant(s),s),true);assert.equal(consumeNextGiant(first,s),false);
});
test('forced selection keeps all-three fit safeguards and remains pending after failed or deferred surveys',()=>{
 const s=storage();nextGiantCommand('large_arena',s);const selection=nextGiant(s);
 for(const outcome of ['deferred','unsuitable']){
  function* survey(c){return {outcome:c.id==='mega_fortress'?outcome:'ready',reason:'test'};}
  assert.equal(result(assessGiantSite({selectionRoll:.99},{},{survey,forcedId:selection.id})).outcome,outcome);
  assert.deepEqual(nextGiant(s),selection);
 }
 const calls=[];function* survey(c){calls.push(c.id);yield;return {outcome:'ready'};}
 assert.equal(result(assessGiantSite({selectionRoll:.99},{},{survey,forcedId:selection.id})).id,'large_arena');
 assert.deepEqual(calls,FIT_ORDER);assert.deepEqual(nextGiant(s),selection);
 const pending=assessGiantSite({selectionRoll:.99},{},{survey,forcedId:()=>nextGiant(s)?.id});pending.next();
 nextGiantCommand('dragon_arena',s);assert.equal(result(pending).id,'dragon_arena');
});
