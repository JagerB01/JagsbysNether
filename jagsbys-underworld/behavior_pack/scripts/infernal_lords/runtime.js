/** Event-maintained roster. Original combat/effect intervals sleep when no relevant actors are loaded. */
import {world as nativeWorld, system as nativeSystem} from '@minecraft/server';
import {ENTITY_IDS} from './entity_ids.js';
import {BOSS_EVENT_ROUTES} from './boss_event_routes.js';
const roster=new Map(), jobs=new Map(),bossTrace=new Map();
let tracing=false;
const BOSSES=new Set(['dungeons:nameless_one','dungeons:wretched_wraith','dungeons:boss_wildfire']);
export function recordBossAction(entity,action,value=1){
 if(!tracing||!entity||!BOSSES.has(entity.typeId))return;
 if(!bossTrace.has(entity.id)){if(bossTrace.size>=64)bossTrace.delete(bossTrace.keys().next().value);bossTrace.set(entity.id,{counts:{},last:''});}
 const trace=bossTrace.get(entity.id);trace.counts[action]=(trace.counts[action]??0)+value;trace.last=action;
}
function bossSnapshot(entity){
 const trace=bossTrace.get(entity.id),phase=entity.typeId==='dungeons:wretched_wraith'?(entity.getProperty('dungeons:bullethell')?'special':'ranged'):entity.typeId==='dungeons:nameless_one'?(entity.getProperty('dungeons:casting')?'casting':'ranged'):'shield/slam';
 return {id:entity.id,type:entity.typeId,phase,last:trace?.last??'',events:trace?.counts??{}};
}
const minionTags=['dungeons:necromancer_minion','dungeons:hovering_inferno_minion','dungeons:summoned_from_aura'];
const variantIds=new Set([...ENTITY_IDS].filter(id=>id.includes(':enchanted_') && !['dungeons:enchanted_fire','dungeons:enchanted_arrow'].includes(id)));
let runner, nextJob=1, failures=0, lastError='';
let playerCacheTick=-1, playerCache=[];
function valid(entity){try{return !!entity && entity.isValid;}catch{return false;}}
function tagged(entity,tag){try{return entity.hasTag(tag);}catch{return false;}}
export function isImported(entity){try{return !!entity && (ENTITY_IDS.has(entity.typeId)||variantIds.has(entity.typeId)||minionTags.some(tag=>tagged(entity,tag)));}catch{return false;}}
function enchanted(entity){return valid(entity)&&variantIds.has(entity.typeId);}
function active(scope){
 for(const entity of roster.values()){
  if(!valid(entity))continue;
  if(scope==='enchanted'&&enchanted(entity))return true;
  if(scope==='necromancer'&&tagged(entity,minionTags[0]))return true;
  if(scope==='wildfire'&&tagged(entity,minionTags[1]))return true;
  if(scope==='aura'&&tagged(entity,minionTags[2]))return true;
  if(scope==='actors')return true;
 }
 return false;
}
function report(error){failures++;lastError=String(error?.stack||error);if(failures<=5)console.warn('[Underworld Infernal Lords] '+lastError);}
function safely(callback,event){try{return callback(event);}catch(error){report(error);}}
function stopIfIdle(){if(runner!==undefined&&![...jobs.values()].some(job=>active(job.scope))){nativeSystem.clearRun(runner);runner=undefined;}}
function tick(){
 for(const [id,entity] of roster)if(!valid(entity))roster.delete(id);
 for(const job of jobs.values())if(active(job.scope)&&nativeSystem.currentTick>=job.next){job.next=nativeSystem.currentTick+job.period;safely(job.callback);}
 stopIfIdle();
}
function wake(){if(runner===undefined&&[...jobs.values()].some(job=>active(job.scope)))runner=nativeSystem.runInterval(tick,1);}
export function remember(entity){if(valid(entity)&&isImported(entity)){roster.set(entity.id,entity);wake();}}
function forget(id){roster.delete(id);bossTrace.delete(id);stopIfIdle();}
export function loadedImportedActors(){return [...roster.values()].filter(valid);}
export function runtimeStatus(){return {tracing,loaded:roster.size,enchanted:[...roster.values()].filter(enchanted).length,ticking:runner!==undefined,failures,lastError,bosses:[...roster.values()].filter(e=>valid(e)&&BOSSES.has(e.typeId)).slice(0,6).map(bossSnapshot)};}
// Local combat queries stay native. Only unbounded roster queries use the maintained set.
function dimensionFacade(id){
 const dim=nativeWorld.getDimension(id);
 return new Proxy(dim,{get(target,key){
  if(key==='getEntities')return (query={})=>query.location?target.getEntities(query):[...roster.values()].filter(entity=>valid(entity)&&entity.dimension.id===target.id&&entity.matches(query));
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
}
function eventRelevant(event){return [event.entity,event.deadEntity,event.hurtEntity,event.damageSource?.damagingEntity,event.damageSource?.damagingProjectile,event.projectile,event.source].some(entity=>{
 if(isImported(entity))return true;
 try{return isImported(entity?.getComponent?.('projectile')?.owner);}catch{return false;}
});}
// One subscription per native signal; mutations to before-event objects pass through.
const subscriptions={before:new Map(),after:new Map()};
function signals(kind){return new Proxy({},{get(_,name){return {subscribe(callback){
 const list=subscriptions[kind];
 if(!list.has(name)){
  list.set(name,[]);
  const signal=nativeWorld[kind==='before'?'beforeEvents':'afterEvents'][name];
  if(!signal)throw new Error('Missing stable API signal: '+kind+'.'+String(name));
  signal.subscribe(event=>{
   if(name==='playerInteractWithBlock'){if(!active('actors'))return;}else if(name!=='worldLoad'&&!eventRelevant(event))return;
   if(name==='dataDrivenEntityTrigger'){
    // Empty/property-only combat events are not guaranteed native notifications.
    // Queued script events below are the single authoritative delivery route.
    if(BOSS_EVENT_ROUTES[event.entity?.typeId]?.includes(event.eventId))return;
    recordBossAction(event.entity,event.eventId);
   }
   for(const cb of list.get(name))safely(cb,event);
  });
 }
 list.get(name).push(callback);
 }};}});}
const beforeSignals=signals('before'),afterSignals=signals('after');
export const world=new Proxy(nativeWorld,{get(target,key){
 if(key==='getDimension')return dimensionFacade;
 if(key==='getPlayers')return query=>{
  if(query)return target.getPlayers(query);
  if(playerCacheTick!==nativeSystem.currentTick){playerCache=target.getPlayers();playerCacheTick=nativeSystem.currentTick;}
  return playerCache;
 };
 if(key==='beforeEvents')return beforeSignals;
 if(key==='afterEvents')return afterSignals;
 const value=target[key];return typeof value==='function'?value.bind(target):value;
}});
export function scopedSystem(scope){return new Proxy(nativeSystem,{get(target,key){
 if(key==='runInterval')return (callback,period=1)=>{const id=nextJob++;jobs.set(id,{callback,scope,period:Math.max(1,period),next:nativeSystem.currentTick+Math.max(1,period)});wake();return id;};
 if(key==='run')return callback=>target.run(()=>safely(callback));
 if(key==='runTimeout')return (callback,delay)=>target.runTimeout(()=>safely(callback),delay);
 const value=target[key];return typeof value==='function'?value.bind(target):value;
}});}
nativeWorld.afterEvents.entitySpawn.subscribe(({entity})=>{
 if(isImported(entity))remember(entity);
 // Source summons attach their tags/owners immediately after spawnEntity returns.
 if(isImported(entity)||active('actors'))nativeSystem.run(()=>remember(entity));
});
nativeWorld.afterEvents.entityLoad.subscribe(({entity})=>remember(entity));
nativeWorld.afterEvents.entityRemove.subscribe(({removedEntityId})=>forget(removedEntityId));
nativeWorld.afterEvents.entityDie.subscribe(({deadEntity})=>{if(!isImported(deadEntity))return;const id=deadEntity.id;nativeSystem.run(()=>forget(id));});
// One loaded-only discovery at world load; later chunks are handled by entityLoad.
nativeWorld.afterEvents.worldLoad.subscribe(()=>{
 for(const id of ['overworld','nether','the_end']){
  const dim=nativeWorld.getDimension(id);
  for(const type of ENTITY_IDS)for(const entity of dim.getEntities({type}))remember(entity);
  for(const tag of minionTags)for(const entity of dim.getEntities({tags:[tag]}))remember(entity);
 }
});
nativeSystem.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='jagsby_nether:boss_event')return;
 const entity=event.sourceEntity,eventId=event.message;
 if(!valid(entity)||!BOSS_EVENT_ROUTES[entity.typeId]?.includes(eventId))return;
 remember(entity);recordBossAction(entity,eventId);
 for(const callback of subscriptions.after.get('dataDrivenEntityTrigger')??[])safely(callback,{entity,eventId});
});
nativeSystem.afterEvents.scriptEventReceive.subscribe(event=>{
 if(!['jagsby_nether:lords_status','jagsby_nether:lords_trace'].includes(event.id))return;
 const reply=message=>event.sourceEntity?.typeId==='minecraft:player'?event.sourceEntity.sendMessage(message):nativeWorld.sendMessage(message);
 if(event.id==='jagsby_nether:lords_trace'){
  const mode=(event.message??'').trim().toLowerCase();
  if(mode==='on'||mode==='off')setBossTracing(mode==='on');
  else if(mode&&mode!=='status'){reply('Use /scriptevent jagsby_nether:lords_trace on | off | status');return;}
  reply(`[Underworld Infernal Lords] Combat tracing ${tracing?'on':'off'}. Counters collect only while enabled and reset when disabled or the world reloads.`);return;
 }
 reply('[Underworld Infernal Lords] '+JSON.stringify(runtimeStatus()));
});
// Health/scale/KB require a declared BP variant. Tags alone are not a conversion API.
export function registerEnchantedVariant(typeId){variantIds.add(typeId);}
export function spawnEnchanted(dimension,typeId,location){
 if(!variantIds.has(typeId))throw new Error('Register a declared enchanted BP variant first: '+typeId);
 const entity=dimension.spawnEntity(typeId,location);remember(entity);return entity;
}
scopedSystem('aura').runInterval(()=>{
 for(const entity of roster.values()){
  if(!valid(entity)||!tagged(entity,minionTags[2]))continue;
  if(!entity.dimension.getEntities({location:entity.location,maxDistance:32,tags:['dungeons:enchanted_mob_mob_summon_aura']}).length&&!entity.dimension.getPlayers({location:entity.location,maxDistance:24}).length)entity.remove();
 }
},20);

// Diagnostic-only listener: absent during ordinary play, never changes damage.
function traceProjectileDamage(event){
 try{
  const owner=event.damageSource.damagingEntity??event.damageSource.damagingProjectile?.getComponent('projectile')?.owner;
  if(event.damageSource.cause==='projectile'&&BOSSES.has(owner?.typeId))recordBossAction(owner,'projectile_damage',event.damage);
 }catch{} // A removed projectile may no longer expose its owner.
}
export function setBossTracing(enabled){
 enabled=!!enabled;if(enabled===tracing)return;
 tracing=enabled;
 if(enabled)nativeWorld.afterEvents.entityHurt.subscribe(traceProjectileDamage);
 else {nativeWorld.afterEvents.entityHurt.unsubscribe(traceProjectileDamage);bossTrace.clear();}
}
