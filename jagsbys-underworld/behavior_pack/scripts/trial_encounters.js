import {world,system} from '@minecraft/server';
import {TRIAL_ENCOUNTERS} from './trial_encounter_catalog.js';
import {chunkLease} from './chunk_loading.js';
import {runGenerationJob} from './generation_queue.js';
import {LANDMARK_PREFIX} from './landmark_sites.js';
const PREFIX='underworld_encounters:site_',VERSION='underworld_encounters:revision';
let busy=false,status='No encounter migration running.';
function siteKey(key){return PREFIX+key;}
function read(key){try{return JSON.parse(world.getDynamicProperty(key)??'null');}catch{return undefined;}}
export function encounterSite(id,origin,dimension='minecraft:nether',key,modular=false){
 const slots=TRIAL_ENCOUNTERS.sites[modular?'mega_modular':id];
 if(!slots||!origin||![origin.x,origin.y,origin.z].every(Number.isFinite))return undefined;
 return {layout:modular?'mega_modular':id,key:key??`manual_${dimension}_${id}_${origin.x}_${origin.y}_${origin.z}`,id,dimension,
  origin:{...origin},slots:slots.map(s=>({position:{x:origin.x+s.offset[0],y:origin.y+s.offset[1],z:origin.z+s.offset[2]},profile:s.profile}))};
}
export function chooseEncounterProfile(group,roll=Math.random()){
 const choices=TRIAL_ENCOUNTERS.choices[group];if(!choices?.length)throw Error(`Unknown encounter group ${group}`);
 const total=choices.reduce((n,c)=>n+c.weight,0);let remaining=Math.min(1-Number.EPSILON,Math.max(0,roll))*total;
 for(const choice of choices){remaining-=choice.weight;if(remaining<0)return choice.profile;}
 return choices.at(-1).profile;
}
// One bounded configuration pass at structure completion; no periodic checks.
export function recordEncounterSite(id,origin,dimension,key,modular=false){
 const site=encounterSite(id,origin,dimension,key,modular);if(!site)return;
 site.layoutRevision=TRIAL_ENCOUNTERS.revision;
 world.setDynamicProperty(siteKey(site.key),JSON.stringify(site));
 // A crash before this queued pass finishes must retry on the next world load.
 world.setDynamicProperty(VERSION,undefined);
 runGenerationJob((function*(){
  try{yield* migrateEncounterSite(site);}catch(error){status=`Fresh encounter configuration deferred: ${error.message}`;console.warn('[Underworld encounters] '+status);}
 })());
}
export function refreshedEncounterSite(site,layout=site.layout){
 if(!layout){
  layout=site.id==='mega_fortress'&&site.slots.every(s=>Math.abs(s.position.x-site.origin.x)<=21&&Math.abs(s.position.z-site.origin.z)<=21)?'mega_modular':site.id;
 }
 const roles=new Map((TRIAL_ENCOUNTERS.sites[layout]??[]).map(s=>[s.offset.join(','),s.profile]));
 const slots=site.slots.map(s=>({...s,profile:roles.get([s.position.x-site.origin.x,s.position.y-site.origin.y,s.position.z-site.origin.z].join(','))??s.profile}));
 // Newly included lower-chamber slots join the finite revision migration.
 // Existing slots retain their exact saved positions; air/player blocks are
 // still preserved by migrateEncounterSite rather than recreating spawners.
 const positions=new Set(slots.map(s=>[s.position.x,s.position.y,s.position.z].join(',')));
 const candidates=[...(TRIAL_ENCOUNTERS.sites[layout]??[]),...(site.revision!==TRIAL_ENCOUNTERS.revision&&site.layoutRevision!==TRIAL_ENCOUNTERS.revision?(TRIAL_ENCOUNTERS.legacySites?.[layout]??[]):[])];
 for(const s of candidates){
  const position={x:site.origin.x+s.offset[0],y:site.origin.y+s.offset[1],z:site.origin.z+s.offset[2]};
  if(!positions.has([position.x,position.y,position.z].join(',')))slots.push({position,profile:s.profile});
 }
 return {...site,layout,slots};
}
export function recordedEncounterSites(){
 const stored=new Map(),natural=[];
 for(const key of world.getDynamicPropertyIds()){
  if(key.startsWith(PREFIX)){const r=read(key);if(r?.key&&Array.isArray(r.slots))stored.set(r.key,r);}
  else if(key.startsWith(LANDMARK_PREFIX)){
   const r=read(key);if(!r||!['built','placing'].includes(r.state))continue;
   const site=encounterSite(r.id,r.origin,'minecraft:nether',key,r.modular);if(site)natural.push(site);
  }
 }
 for(const site of natural){
  const existing=stored.get(site.key);stored.set(site.key,existing?refreshedEncounterSite(existing,site.layout):site);
 }
 return [...stored.values()].map(site=>refreshedEncounterSite(site));
}
export function* migrateEncounterSite(site){
 if(site.revision===TRIAL_ENCOUNTERS.revision||read(siteKey(site.key))?.revision===TRIAL_ENCOUNTERS.revision)return {updated:0};
 site=refreshedEncounterSite(site);
 const dimension=world.getDimension(site.dimension),chunks=new Map();let updated=0,lease;
 // Save stable positions before the first update so later template edits do
 // not move already spawned spawners or turn module spawners into trial ones.
 world.setDynamicProperty(siteKey(site.key),JSON.stringify(site));
 for(const slot of site.slots){
  if(!TRIAL_ENCOUNTERS.presets[slot.profile])throw Error(`Unknown encounter profile ${slot.profile}`);
  if(slot.selectionRevision!==TRIAL_ENCOUNTERS.revision||!TRIAL_ENCOUNTERS.presets[slot.selectedProfile]){
   slot.selectedProfile=chooseEncounterProfile(slot.profile.split('/')[0]);slot.selectionRevision=TRIAL_ENCOUNTERS.revision;
  }
  const key=`${Math.floor(slot.position.x/16)},${Math.floor(slot.position.z/16)}`;
  if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(slot);
 }
 // Persist weighted choices before writing, so retries cannot reroll repaired slots.
 world.setDynamicProperty(siteKey(site.key),JSON.stringify(site));
 try{
  for(const [key,slots] of chunks){
   const [x,z]=key.split(',').map(Number);lease=chunkLease(dimension,'encounter_update');
   yield* lease.load({x:x*16,y:0,z:z*16},[16,128,16]);
   for(const slot of slots){
    const block=dimension.getBlock(slot.position);if(!block)throw Error('Encounter block is unloaded');
    // Preserve mined spawners and any player construction in their old place.
    if(['minecraft:mob_spawner','minecraft:trial_spawner'].includes(block.typeId)){
     world.structureManager.place(TRIAL_ENCOUNTERS.presets[slot.selectedProfile],dimension,slot.position,{includeEntities:false,includeBlocks:true});updated++;
    }
    yield;
   }
   lease.release();lease=undefined;
  }
  world.setDynamicProperty(siteKey(site.key),JSON.stringify({...site,revision:TRIAL_ENCOUNTERS.revision}));
  return {updated};
 }finally{lease?.release();}
}
export function* migrateRecordedEncounters(){
 let failures=0,updated=0;
 try{
  const sites=recordedEncounterSites();
  for(const site of sites){
   if(site.revision===TRIAL_ENCOUNTERS.revision)continue;
   status=`Updating ${site.id} encounters at ${site.origin.x}, ${site.origin.z}.`;
   try{const result=yield* migrateEncounterSite(site);updated+=result.updated;}
   catch(error){failures++;console.warn(`[Underworld encounters] ${site.id}: ${error.message}`);}
  }
  if(!failures)world.setDynamicProperty(VERSION,TRIAL_ENCOUNTERS.revision);
  status=failures?`Encounter update deferred for ${failures} structures. Retry on next world load or with encounters_update.`:`Encounter update complete: ${updated} spawners updated.`;
  return {updated,failures};
 }finally{busy=false;}
}
export function scheduleEncounterUpdate(force=false){
 // One comparison on world load; unchanged encounter data does no further work.
 if(busy||(!force&&world.getDynamicProperty(VERSION)===TRIAL_ENCOUNTERS.revision))return false;
 busy=true;runGenerationJob(migrateRecordedEncounters());return true;
}
world.afterEvents.worldLoad.subscribe(()=>scheduleEncounterUpdate());
system.afterEvents.scriptEventReceive.subscribe(({id,message,sourceEntity:player})=>{
 if(player?.typeId!=='minecraft:player')return;
 if(id==='jagsby_nether:encounters_update'){scheduleEncounterUpdate(true);player.sendMessage(`[Underworld encounters] ${status}`);}
 if(id==='jagsby_nether:encounters_status')player.sendMessage(`[Underworld encounters] ${status}`);
 // Old manual placements were not recorded by earlier addon versions. An
 // explicit origin registers those without scanning the surrounding world.
 if(id==='jagsby_nether:encounters_register'){
  const [name,...values]=message.trim().split(/\s+/),coords=values.map(Number);
  if(coords.length!==3||!coords.every(Number.isSafeInteger)||!TRIAL_ENCOUNTERS.sites[name]){player.sendMessage('Use encounters_register <arena> <origin X> <origin Y> <origin Z>.');return;}
  const site=encounterSite(name,{x:coords[0],y:coords[1],z:coords[2]},player.dimension.id);
  world.setDynamicProperty(siteKey(site.key),JSON.stringify(site));scheduleEncounterUpdate(true);
 }
});
