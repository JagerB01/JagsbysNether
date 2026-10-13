import test from 'node:test';
import {system} from './mock-server.mjs';
import assert from 'node:assert/strict';
import {FORTRESS_MODULES} from '../behavior_pack/scripts/modular_fortress_catalog.js';
import {surveyModularFortress,modularSections} from '../behavior_pack/scripts/modular_fortress.js';
function finish(job){for(let i=0;i<200000;i++){const r=job.next();system.currentTick++;if(r.done)return r.value;}assert.fail('Modular survey stalled');}
function scene(obstruction){return {id:'minecraft:nether',runCommand(){},getBlock:({x,y,z})=>({typeId:y<=4?'minecraft:netherrack':x===0&&z===0&&y<=31?'minecraft:lava':y>31&&x===0&&z===0?'minecraft:air':'minecraft:netherrack'}),containsBlock:v=>!!obstruction&&v.from.x<=obstruction.x&&v.to.x>=obstruction.x&&v.from.y<=obstruction.y&&v.to.y>=obstruction.y&&v.from.z<=obstruction.z&&v.to.z>=obstruction.z};}
test('required fortress core includes centre and roof and optional modules remain connected',()=>{
 assert.deepEqual(FORTRESS_MODULES[0].size,[43,56,43]);assert.equal(FORTRESS_MODULES[0].source.length,2);
 for(const m of FORTRESS_MODULES.slice(1)){assert(m.parent<m.index);assert(m.sections.every(s=>s.size[0]<=16&&s.size[2]<=16));}
});
test('only the core needs to fit; blocked branches and their descendants are omitted',()=>{
 const p=finish(surveyModularFortress({x:0,z:0},scene({x:-30,y:60,z:0})));assert.equal(p.outcome,'ready');assert(p.modular);assert(p.modules.includes(0));assert(!p.modules.includes(1));assert(p.modules.length>1);assert(p.skippedModules.includes(1));
 for(const i of p.modules)if(i!==0)assert(p.modules.includes(FORTRESS_MODULES[i].parent));assert.equal(p.sections.length,modularSections(p.modules).length);
});
test('a protected block in the required core rejects the site',()=>{
 const p=finish(surveyModularFortress({x:0,z:0},scene({x:0,y:60,z:0})));assert.equal(p.outcome,'unsuitable');assert.match(p.reason,/core/);
});
test('incomplete modular surveys defer instead of recording a failed site',()=>{
 const d=scene();d.getBlock=()=>undefined;const p=finish(surveyModularFortress({x:0,z:0},d));assert.equal(p.outcome,'deferred');
});
