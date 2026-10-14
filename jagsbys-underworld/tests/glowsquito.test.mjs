import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createColonyController,helpCrop,MOB,HIVE,WAX,LEVEL,HOME,POLLEN,INSIDE,PREFIX,campfireCalms} from '../.build/behavior_pack/scripts/glowsquito/colony.js';
const json=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
function fixture({baby=false,litCampfire=false,full=false}={}){
 const storage=new Map(),entities=new Map(),blocks=new Map(),timers=[],drops=[],rewards=[],commands=[];
 const dim={id:'minecraft:nether',getBlock(p){return blocks.get(`${p.x},${p.y},${p.z}`)??{typeId:'minecraft:air',isAir:true,isSolid:false,location:p,dimension:dim};},spawnItem:(item,p)=>drops.push({item,p}),playSound(){}};
 const world={getDimension:()=>dim,getEntity:id=>entities.get(id),getDynamicProperty:k=>storage.get(k),setDynamicProperty:(k,v)=>v===undefined?storage.delete(k):storage.set(k,v)};
 const system={runTimeout:(callback,ticks)=>timers.push({callback,ticks})};
 function hive(x=0){let level=0;const b={typeId:HIVE,location:{x,y:32,z:0},dimension:dim,get permutation(){return {getState:n=>n===LEVEL?level:undefined,withState:(n,v)=>({level:v})};},setPermutation:p=>{level=p.level;}};blocks.set(`${x},32,0`,b);return b;}
 function bee(id='a',isBaby=baby){
  const props=new Map(),events=[];
  const b={id,typeId:MOB,isValid:true,dimension:dim,location:{x:1,y:33,z:0},hasComponent:id=>id==='minecraft:is_baby'&&isBaby,getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>v===undefined?props.delete(k):props.set(k,v),triggerEvent:e=>events.push(e),clearVelocity(){},teleport:p=>{b.location={...p};},events};entities.set(id,b);return b;
 }
 const tool={typeId:'minecraft:shears',getComponent:t=>t==='minecraft:durability'?durability:undefined},durability={damage:0,maxDurability:238};
 const inventory={getItem:()=>tool,setItem(){},addItem:item=>{if(full)return item;rewards.push(item);}};
 const player={id:'player',typeId:'minecraft:player',selectedSlotIndex:0,getGameMode:()=> 'Survival',getComponent:()=>({container:inventory}),runCommand:c=>commands.push(c)};
 const block=hive(),b=bee();
 if(litCampfire)blocks.set('0,30,0',{typeId:'minecraft:soul_campfire',isSolid:true,permutation:{getState:()=>false}});
 const colony=createColonyController({world,system,rng:()=>.5,crop:()=>false});
 return {world,system,storage,entities,blocks,timers,drops,rewards,commands,dim,block,bee,b,player,durability,colony,hive};
}
function deposit(f,bee=f.b,block=f.block){f.colony.pollinated(bee);assert(f.colony.reach(block,bee));}
test('only the supplied Glowsquito design is imported, with animated original model parts',()=>{
 const meta=json('behavior_pack/docs/glowsquito/SOURCE_METADATA.json');assert.equal(Object.keys(meta.assets).length,2);
 assert(Object.keys(meta.assets).every(p=>p.includes('/textures/entity/glowsquitoid')));
 for(const asset of Object.values(meta.assets))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+asset.target,import.meta.url))).digest('hex'),asset.sha256);
 const g=json('resource_pack/models/entity/glowsquito.geo.json')['minecraft:geometry'][0];
 assert.equal(g.description.texture_width,64);assert.equal(g.bones.length,12);
 assert(g.bones.some(b=>b.name==='stinger'));assert(g.bones.some(b=>b.name==='left_wing'));
 assert(json('resource_pack/animations/glowsquito.animation.json').animations['animation.jagsby_nether.glowsquito.flight'].loop);
});
test('native flight, retaliation, fungus pollination, breeding and baby restrictions are defined',()=>{
 const e=json('behavior_pack/entities/glowsquito.json')['minecraft:entity'],g=e.component_groups;
 assert.equal(e.components['minecraft:health'].value,10);assert.equal(e.components['minecraft:attack'].damage,1);
 assert(e.components['minecraft:navigation.hover']);assert(e.components['minecraft:can_fly']);
 assert(g.outdoors['minecraft:behavior.hurt_by_target']);assert(g.outdoors['minecraft:behavior.random_hover']);
 assert.deepEqual(g.outdoors['minecraft:behavior.tempt'].items,['minecraft:glowstone_dust']);
 assert.deepEqual(g.forage['minecraft:behavior.move_to_block'].target_blocks,['minecraft:crimson_fungus','minecraft:warped_fungus']);
 assert.equal(g.adult['minecraft:breedable'].breed_cooldown,300);assert.equal(g.baby['minecraft:ageable'].duration,1200);
 assert(!JSON.stringify(e).includes('poison'));assert(!JSON.stringify(e).includes('perish'));
 assert(!e.events['jagsby_nether:enter'].remove.component_groups.includes('adult'),'Hive entry must preserve native breeding cooldown');
 assert(g.assigned['minecraft:persistent']);assert(g.bred['minecraft:persistent']);assert(!e.events['minecraft:entity_born'].add.component_groups.includes('wild'));assert(e.events['minecraft:entity_born'].remove.component_groups.includes('forage'));
});
test('wild spawn rules use only forest biomes, relative weights 3:1, and bounded density',()=>{
 const s=json('behavior_pack/spawn_rules/glowsquito.json')['minecraft:spawn_rules'];
 assert.deepEqual(s.conditions.map(c=>[c['minecraft:biome_filter'].value,c['minecraft:weight'].default,c['minecraft:herd'].max_size]),[['warped_forest',3,2],['crimson_forest',1,1]]);
 assert(s.conditions.every(c=>c['minecraft:density_limit'].underground===4));
 assert(!readdirSync(new URL('../behavior_pack/spawn_rules',import.meta.url)).some(n=>n.includes('glowhusk')));
});
test('all 64 mixed Nether-plank combinations craft one hive; wax and redstone craft two gunpowder',()=>{
 const files=readdirSync(new URL('../behavior_pack/recipes/glowhusk',import.meta.url));assert.equal(files.length,64);
 const patterns=new Set();
 for(const filename of files){const r=json(`behavior_pack/recipes/glowhusk/${filename}`)['minecraft:recipe_shaped'];patterns.add(r.pattern[0]+r.pattern[2]);assert.deepEqual(r.result,{item:HIVE,count:1});assert.equal(r.pattern[1],'DSD');assert(Object.values(r.key).every(k=>['minecraft:crimson_planks','minecraft:warped_planks','minecraft:glowstone_dust','minecraft:shroomlight'].includes(k.item)));}
 assert.equal(patterns.size,64);
 const r=json('behavior_pack/recipes/glow_wax_gunpowder.json')['minecraft:recipe_shapeless'];assert.deepEqual(r.ingredients,[{item:WAX},{item:'minecraft:redstone'}]);assert.deepEqual(r.result,{item:'minecraft:gunpowder',count:2});
});
test('claim capacity is three unique Glowsquitos, and babies neither claim nor deposit',()=>{
 const f=fixture();for(const b of [f.b,f.bee('b'),f.bee('c')])assert(f.colony.reach(f.block,b));
 assert.equal(f.colony.reach(f.block,f.bee('d')),false);assert.equal(f.colony.reach(f.block,f.bee('baby',true)),false);
 assert.equal(f.colony.ensureHive(f.block).occupants.length,3);
 f.colony.reach(f.block,f.b);assert.equal(f.colony.ensureHive(f.block).occupants.length,3);
 const g=fixture({baby:true});g.colony.pollinated(g.b);assert(!g.b.getDynamicProperty(POLLEN));assert(!g.colony.enter(g.block,g.b));
});
test('five distinct pollen cycles fill one hive; duplicate entry cannot deposit twice and full level caps at five',()=>{
 const f=fixture();assert(f.colony.reach(f.block,f.b));
 for(let n=1;n<=6;n++){deposit(f);assert.equal(f.block.permutation.getState(LEVEL),Math.min(n,5));assert.equal(f.colony.enter(f.block,f.b),false);assert(f.colony.wake(f.b));}
 assert.equal(f.colony.ensureHive(f.block).occupants.length,1);assert.equal(f.entities.size,1,'Entry/exit never spawns or destroys an entity');
});
test('successful shearing delivers one wax, resets, wears shears, angers colony, and emits optional XP once',()=>{
 const f=fixture();for(let n=0;n<5;n++){deposit(f);f.colony.wake(f.b);}
 assert(f.colony.harvest(f.block,f.player));assert.equal(f.block.permutation.getState(LEVEL),0);assert.equal(f.rewards.length,1);assert.equal(f.rewards[0].typeId,WAX);assert.equal(f.rewards[0].amount,1);assert.equal(f.durability.damage,1);
 assert(f.b.events.includes('jagsby_nether:defend'));assert.equal(f.commands.length,1);assert(f.commands[0].startsWith('scriptevent minescape:apiary_harvest '));
 assert(!f.colony.harvest(f.block,f.player));assert.equal(f.rewards.length,1);assert.equal(f.commands.length,1);
});
test('both lit campfire types calm the hive within five blocks, with solid smoke obstructions respected',()=>{
 for(const type of ['minecraft:campfire','minecraft:soul_campfire']){
  const f=fixture({litCampfire:true});f.blocks.get('0,30,0').typeId=type;assert(campfireCalms(f.block));
  for(let n=0;n<5;n++){deposit(f);f.colony.wake(f.b);}f.colony.harvest(f.block,f.player);assert(!f.b.events.includes('jagsby_nether:defend'));
  f.blocks.set('0,31,0',{typeId:'minecraft:stone',isSolid:true});assert(!campfireCalms(f.block));
 }
 const f=fixture({litCampfire:true});f.blocks.get('0,30,0').permutation.getState=()=>true;assert(!campfireCalms(f.block));
});
test('full inventory drops one wax without collection XP; failed delivery retains its unharvested cycle',()=>{
 const f=fixture({full:true});for(let n=0;n<5;n++){deposit(f);f.colony.wake(f.b);}f.colony.harvest(f.block,f.player);assert.equal(f.drops.length,1);assert.equal(f.commands.length,0);assert.equal(f.block.permutation.getState(LEVEL),0);
 const g=fixture({full:true});for(let n=0;n<5;n++){deposit(g);g.colony.wake(g.b);}g.dim.spawnItem=()=>{throw Error('failed delivery');};assert.throws(()=>g.colony.harvest(g.block,g.player));assert.equal(g.block.permutation.getState(LEVEL),5);assert.equal(g.commands.length,0);
});
test('controller/world reload retains identity, occupancy, sleeping phase and production without respawning',()=>{
 const f=fixture();for(let n=0;n<3;n++){deposit(f);if(n<2)f.colony.wake(f.b);}
 const before=f.b.id;f.colony=createColonyController({world:f.world,system:f.system,rng:()=>.5});f.colony.load(f.b);
 assert.equal(f.colony.ensureHive(f.block).occupants.length,1);assert.equal(f.block.permutation.getState(LEVEL),3);assert(f.b.getDynamicProperty(INSIDE));assert(f.colony.wake(f.b));assert.equal(f.b.id,before);assert.equal(f.entities.size,1);assert.equal(f.colony.enter(f.block,f.b),true);assert.equal(f.block.permutation.getState(LEVEL),3,'No new pollen after restart');
});
test('unloaded hive/occupants do not free reservations or create replacements; blocked exits retry safely',()=>{
 const f=fixture();deposit(f);f.colony.remove(f.b.id);f.entities.delete(f.b.id);
 assert.equal(f.colony.ensureHive(f.block).occupants.length,1);
 f.entities.set(f.b.id,f.b);const original=f.dim.getBlock;f.dim.getBlock=()=>undefined;assert(!f.colony.wake(f.b));assert(f.b.getDynamicProperty(INSIDE));
 f.dim.getBlock=p=>p.x===0&&p.y===32&&p.z===0?original(p):Math.abs(p.x)+Math.abs(p.z)+Math.abs(p.y-32)<=1?{typeId:'minecraft:stone',isAir:false,location:p,dimension:f.dim}:original(p);
 assert(!f.colony.wake(f.b));assert(f.b.getDynamicProperty(INSIDE));f.dim.getBlock=original;assert(f.colony.wake(f.b));assert.equal(f.entities.size,1);
});
test('destroyed/replaced hive releases living occupants; stale home tokens never attach to a new colony',()=>{
 const f=fixture();deposit(f);const old=f.b.getDynamicProperty(HOME);f.blocks.delete('0,32,0');f.block.typeId='minecraft:air';f.colony.destroy(f.block);assert(!f.b.getDynamicProperty(HOME));assert(!f.b.getDynamicProperty(INSIDE));assert(f.b.events.includes('jagsby_nether:homeless'));
 f.b.setDynamicProperty(HOME,old);f.b.setDynamicProperty(INSIDE,true);const replacement=f.hive();f.colony.ensureHive(replacement);f.colony.load(f.b);assert(!f.b.getDynamicProperty(HOME));assert.equal(f.colony.ensureHive(replacement).occupants.length,0);assert.equal(f.entities.size,1);
});
test('confirmed death frees its capacity; reaching another hive still returns to the assigned home',()=>{
 const f=fixture(),other=f.hive(5);f.colony.reach(f.block,f.b);f.colony.pollinated(f.b);assert(f.colony.reach(other,f.b));assert.equal(f.block.permutation.getState(LEVEL),1);assert.equal(other.permutation.getState(LEVEL),0);assert.equal(f.colony.ensureHive(other).occupants.length,0);
 f.colony.wake(f.b);f.colony.pollinated(f.b);const previous=f.block.permutation.getState(LEVEL);
 const savedDimension=f.b.dimension;f.b.dimension={id:'minecraft:overworld'};assert(!f.colony.enter(f.block,f.b));assert.equal(f.block.permutation.getState(LEVEL),previous);f.b.dimension=savedDimension;
 f.colony.died(f.b);assert.equal(f.colony.ensureHive(f.block).occupants.length,0);
});
test('no idle polling or entity scans; active work is bounded to four and assigned wanderers stay near home',()=>{
 const f=fixture();assert.equal(f.timers.length,0);f.colony.load(f.b);assert.equal(f.timers.length,0);
 f.colony.reach(f.block,f.b);assert.equal(f.timers.length,1);assert.equal(f.timers[0].ticks,40);f.b.location={x:100,y:33,z:0};f.timers.shift().callback();assert(Math.hypot(f.b.location.x-.5,f.b.location.y-32.5,f.b.location.z-.5)<16);
 f.colony.remove(f.b.id);f.timers.shift().callback();assert.equal(f.timers.length,0);
 const g=fixture();let crops=0;g.world.gameRules={mobGriefing:false};
 g.colony=createColonyController({world:g.world,system:g.system,crop:()=>crops++});g.colony.pollinated(g.b);
 g.timers.shift().callback();assert.equal(crops,0);g.world.gameRules.mobGriefing=true;g.timers.shift().callback();assert.equal(crops,1);
});
test('pollen crop assistance advances one valid stage only, excluding mature/attached crops and other dimensions',()=>{
 function crop(age=3,attached=false){let value=age;return {typeId:'jagsby_nether:rye_crop',dimension:dim,location:{x:0,y:31,z:0},get permutation(){return {getState:k=>k===AGE?value:k===ATTACHED?attached:undefined,withState:(k,v)=>({value:v})};},setPermutation:p=>value=p.value,get age(){return value;}};}
 const AGE='jagsby_nether:age',ATTACHED='jagsby_nether:attached';let block;
 const soil={typeId:'jagsby_nether:soul_soil_farmland',permutation:{getState:()=>true}};
 const dim={id:'minecraft:nether',getBlock:p=>p.x===0&&p.z===0?(p.y===31?block:p.y===30?soil:undefined):undefined};
 const bee={dimension:dim,location:{x:.5,y:32,z:.5}};block=crop();assert(helpCrop(bee,()=>0));assert.equal(block.age,4);
 block=crop(7);assert(!helpCrop(bee,()=>0));block=crop(3,true);assert(!helpCrop(bee,()=>0));block=crop();dim.id='minecraft:overworld';assert(!helpCrop(bee,()=>0));assert.equal(block.age,3);
});

test('fresh placement invalidates stale occupants even if an operator replaced a block without destroy mode',()=>{
 const f=fixture();deposit(f);const first=f.colony.ensureHive(f.block).token;
 const replacement=f.hive();const after=f.colony.placed(replacement);
 assert.notEqual(after.token,first);assert.equal(after.occupants.length,0);
 assert(!f.b.getDynamicProperty(HOME));assert(!f.b.getDynamicProperty(INSIDE));assert.equal(f.entities.size,1);
 assert.equal(json('behavior_pack/blocks/glowhusk.json')['minecraft:block'].components['minecraft:movable'].movement_type,'immovable');
});
