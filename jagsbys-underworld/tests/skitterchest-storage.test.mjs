import test from 'node:test';
import assert from 'node:assert/strict';
import {moveStack,stackSnapshot} from '../behavior_pack/scripts/skitterchest_storage.js';
function item(amount){return {typeId:'minecraft:diamond',amount,nameTag:'Keepsake',getComponent(){}};}
for(const capacity of [0,2,8])test(`storage transfer respects destination capacity ${capacity}`,()=>{
 let source=item(5);let moved;
 const from={getItem(){return source;},setItem(slot,value){source=value;}};
 const to={addItem(stack){moved=Math.min(stack.amount,capacity);return moved<stack.amount?{...stack,amount:stack.amount-moved}:undefined;}};
 assert(moveStack(from,0,to,stackSnapshot(source)));
 assert.equal((source?.amount??0)+moved,5);
 if(source)assert.equal(source.nameTag,'Keepsake');
});
test('a stale storage form cannot transfer a changed stack',()=>{
 const old=item(5),replacement=item(4);
 assert.equal(moveStack({getItem(){return replacement;}},0,{addItem(){assert.fail('stale transfer');}},stackSnapshot(old)),false);
});
