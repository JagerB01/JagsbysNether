import test from 'node:test';
import assert from 'node:assert/strict';
import {entities} from './mock-server.mjs';
import {tickHongo} from '../behavior_pack/scripts/hongos.js';
let serial=0;
function fixture(variant='crimson'){
 const chests=[];
 const dimension={getEntities({type}){return chests.filter(c=>c.typeId===type);},spawnEntity(){throw Error('Should use existing native storage');}};
 const entity=(typeId,location={x:0,y:30,z:0})=>{
  const data=new Map();return {id:`hongo-test-${serial++}`,typeId,location,dimension,isValid:true,tamed:true,owner:'A',
   getProperty(key){return key==='jagsby_nether:sitting'?this.sitting===true:this.tamed;},hasComponent(){return this.tamed;},getDynamicProperty:k=>data.get(k),setDynamicProperty(k,v){data.set(k,v);}};
 };
 const hongo=entity(`jagsby_nether:${variant}_hongo`);
 function chest(kind=variant,pos={x:2,y:30,z:0},full=false){
  const c=entity(`jagsby_nether:${kind}_skitterchest`,pos),deposits=[];
  c.sitting=true;
  const box=entity('jagsby_nether:skitterchest_storage');
  box.getComponent=()=>({container:{addItem(item){if(full)return item;deposits.push(item);return undefined;}}});
  c.setDynamicProperty('jagsby_nether:storage_entity',box.id);c.setDynamicProperty('jagsby_nether:storage_migrated',true);
  c.legacyInventoryUntouched=true;c.getComponent=()=>{c.legacyInventoryUntouched=false;throw Error('Must not deposit in legacy inventory');};
  entities.set(box.id,box);chests.push(c);return {c,deposits,box};
 }
 const due=()=>hongo.setDynamicProperty('jagsby_nether:nugget_due',0);
 return {hongo,chest,due};
}
for(const [variant,item] of [['crimson','minecraft:iron_nugget'],['warped','minecraft:gold_nugget']]){
 test(`${variant} deposits the correct nugget into matching native storage regardless of owner`,()=>{
  const f=fixture(variant),c=f.chest();c.c.owner='B';f.due();
  assert.equal(tickHongo(f.hongo,100,()=>0),true);
  assert.deepEqual(c.deposits.map(i=>[i.typeId,i.amount]),[[item,1]]);assert.equal(c.c.legacyInventoryUntouched,true);
  assert.equal(tickHongo(f.hongo,101,()=>0),false);assert.equal(c.deposits.length,1);
 });
}
test('wild mushrooms and untamed chests do not produce nuggets',()=>{
 const f=fixture(),c=f.chest();f.due();f.hongo.tamed=false;
 assert.equal(tickHongo(f.hongo,100,()=>0),false);f.hongo.tamed=true;c.c.tamed=false;
 assert.equal(tickHongo(f.hongo,100,()=>0),false);assert.equal(c.deposits.length,0);
});
test('wrong variants and out-of-range chests cannot receive nuggets',()=>{
 const f=fixture(),wrong=f.chest('warped'),far=f.chest('crimson',{x:8.01,y:30,z:0});f.due();
 assert.equal(tickHongo(f.hongo,100,()=>0),false);assert.equal(wrong.deposits.length,0);assert.equal(far.deposits.length,0);
});
test('a full nearest chest is skipped in favor of matching storage with room',()=>{
 const f=fixture(),full=f.chest('crimson',{x:1,y:30,z:0},true),available=f.chest();f.due();
 assert.equal(tickHongo(f.hongo,100,()=>0),true);assert.equal(full.deposits.length,0);assert.equal(available.deposits.length,1);
});
test('full storage schedules a retry and never materializes a dropped nugget',()=>{
 const f=fixture(),c=f.chest('crimson',undefined,true);f.due();
 assert.equal(tickHongo(f.hongo,100,()=>0),false);assert.equal(f.hongo.getDynamicProperty('jagsby_nether:nugget_due'),140);
 assert.equal(c.deposits.length,0);
});
test('initial cooldown lasts 5–10 seconds and unloaded time does not accumulate production',()=>{
 const f=fixture(),c=f.chest();assert.equal(tickHongo(f.hongo,0,()=>0),false);
 assert.equal(f.hongo.getDynamicProperty('jagsby_nether:nugget_due'),100);
 assert.equal(tickHongo(f.hongo,99,()=>0),false);
 assert.equal(tickHongo(f.hongo,200000,()=>0.999),true);assert.equal(c.deposits.length,1);
 assert.equal(f.hongo.getDynamicProperty('jagsby_nether:nugget_due'),200200);
 assert.equal(tickHongo(f.hongo,200001,()=>0),false);
});

test('standing Skitterchests reject nuggets; sitting enables deposits after the short retry',()=>{
 const f=fixture(),c=f.chest();c.c.sitting=false;f.due();
 assert.equal(tickHongo(f.hongo,100,()=>0),false);assert.equal(c.deposits.length,0);
 c.c.sitting=true;assert.equal(tickHongo(f.hongo,139,()=>0),false);
 assert.equal(tickHongo(f.hongo,140,()=>0),true);assert.equal(c.deposits.length,1);
});
test('saved production cooldowns are shortened when upgrading to the test build',()=>{
 const f=fixture(),c=f.chest();f.hongo.setDynamicProperty('jagsby_nether:nugget_due',6000);
 assert.equal(tickHongo(f.hongo,100,()=>0),false);
 assert.equal(f.hongo.getDynamicProperty('jagsby_nether:nugget_due'),200);
 assert.equal(tickHongo(f.hongo,200,()=>0),true);assert.equal(c.deposits.length,1);
});
