import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {world,system,flush,intervals} from './mock-server.mjs';
import {FOOD_BUFFS,FOOD_BUFF_DURATION_MS,FOOD_BUFF_TAG,activateFoodBuff,readFoodBuff} from '../behavior_pack/scripts/food_buffs/state.js';
import '../behavior_pack/scripts/food_buffs/main.js';
const pack=new URL('../../downloads/MineScape_v1.5.18_Underworld_Food_Buffs.mcpack',import.meta.url);
let code=execFileSync('python3',['-c','import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read("scripts/perks.js").decode())',pack.pathname],{encoding:'utf8'});
const skills=[...new Set(Object.values(FOOD_BUFFS).flatMap(f=>f.skills)), 'constitution'].map(s=>[s,s]);
code=code.replace('import { SKILLS } from "./config.js";',`const SKILLS=${JSON.stringify(skills)};`).replace('import { skillSnapshot } from "./xp.js";','const skillSnapshot=(p,s)=>({level:p.levels[s]??1});').replace('import { notifyPassiveProcIcon } from "./proc_icons.js";','const notifyPassiveProcIcon=()=>{};').replace('"./underworld_food_buffs.js"',JSON.stringify(pathToFileURL(new URL('../compatibility/minescape/underworld_food_buffs.js',import.meta.url).pathname).href));
const perks=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
let clock=1000000;const realNow=Date.now;Date.now=()=>clock;test.after(()=>{Date.now=realNow;});
let serial=0;
function player(){const tags=new Set();return {id:`food_test_${serial++}`,typeId:'minecraft:player',levels:Object.fromEntries(skills.map(([s])=>[s,68])),messages:[],getTags(){return [...tags];},addTag:t=>{tags.add(t);return true;},removeTag:t=>tags.delete(t),sendMessage(message){this.messages.push(message);}};}
function eat(p,kind){world.afterEvents.itemCompleteUse.emit({source:p,itemStack:{typeId:`jagsby_nether:${kind}`}});flush();}
test('all five foods double exactly the requested skills using the real patched MineScape perk functions',()=>{
 for(const [kind,definition] of Object.entries(FOOD_BUFFS)){
  const p=player();eat(p,kind);
  for(const [skill] of skills){const expected=definition.skills.includes(skill)?6:3;assert.equal(perks.skillPerkPercent(p,skill),expected,`${kind}/${skill}`);assert.equal(perks.skillPerkChance(p,skill),expected/100);assert.equal(perks.skillPerkTier(p,skill),3);}
 }
});
test('a new food replaces the old buff without stacking shared skill bonuses',()=>{
 const p=player();eat(p,'wickspit');eat(p,'gloamquill');assert.equal(p.getTags().filter(t=>t.startsWith(FOOD_BUFF_TAG)).length,1);assert.equal(perks.skillPerkPercent(p,'martial'),3);assert.equal(perks.skillPerkPercent(p,'ranged'),6);assert.equal(perks.skillPerkPercent(p,'agility'),6);assert.equal(perks.skillPerkPercent(p,'slayer'),6);
});
test('buff lasts exactly 20 minutes, refreshes on consumption, and automatically reverts the perk chance',()=>{
 const p=player();eat(p,'cragbake');const first=readFoodBuff(p).expires;assert.equal(first-clock,FOOD_BUFF_DURATION_MS);clock+=1000;eat(p,'cragbake');const end=readFoodBuff(p).expires;assert.equal(end,first+1000);clock=end-1;assert.equal(perks.skillPerkPercent(p,'mining'),6);clock=end;assert.equal(perks.skillPerkPercent(p,'mining'),3);assert.equal(readFoodBuff(p),undefined);
});
test('earned bonuses track level changes during a buff and do not grant perks below unlock level',()=>{
 const p=player();eat(p,'scarbisque');p.levels.enchanting=99;assert.equal(perks.skillPerkPercent(p,'enchanting'),14);p.levels.alchemy=28;assert.equal(perks.skillPerkChance(p,'alchemy'),0);assert.equal(perks.skillPerkSnapshot(p,'enchanting').percent,14);assert.equal(perks.skillPerkSnapshot(p,'enchanting').tier,7);
});
test('saved player tags restore the remaining buff across login and expired tags are cleaned on spawn',()=>{
 const p=player();activateFoodBuff(p,'murkbrew');world.afterEvents.playerSpawn.emit({player:p});flush();assert.equal(perks.skillPerkPercent(p,'fishing'),6);world.afterEvents.playerLeave.emit({playerId:p.id});clock+=1000;world.afterEvents.playerSpawn.emit({player:p});flush();assert.equal(perks.skillPerkPercent(p,'fishing'),6);clock+=FOOD_BUFF_DURATION_MS;world.afterEvents.playerSpawn.emit({player:p});flush();assert.equal(perks.skillPerkPercent(p,'fishing'),3);assert.deepEqual(p.getTags(),[]);
});
test('buff compatibility does not register a timer or repeatedly scan player tags on perk queries',()=>{
 const p=player();let reads=0;const get=p.getTags;p.getTags=()=>{reads++;return get();};eat(p,'wickspit');reads=0;for(let i=0;i<100;i++)perks.skillPerkPercent(p,'agility');assert.equal(reads,0);assert.equal(intervals.length,0);
});
test('food definitions retain stack size 16 and support native consumption at full hunger',()=>{
 for(const kind of Object.keys(FOOD_BUFFS)){const d=JSON.parse(fs.readFileSync(new URL(`../behavior_pack/items/food_buffs/${kind}.json`,import.meta.url)));const c=d['minecraft:item'].components;assert.equal(c['minecraft:max_stack_size'],16);assert.equal(c['minecraft:food'].can_always_eat,true);assert.equal(c['minecraft:use_animation'],'eat');assert.equal(c['minecraft:use_modifiers'].use_duration,1.6);}
});
