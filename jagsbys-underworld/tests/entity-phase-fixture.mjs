// Executes actual BP events, component-group changes and native timer definitions.
// It models those contracts, not Bedrock pathfinding, rendering or AI goal execution.
import {readFileSync} from 'node:fs';
import {world,system,timeouts,flush} from './mock-server.mjs';
const paths={nameless_one:'nameless_one/nameless_one',wretched_wraith:'wretched_wraith/wretched_wraith',boss_wildfire:'wildfire/wildfire'};
let serial=0;
export function bossFixture(name){
 const definition=JSON.parse(readFileSync(new URL(`../behavior_pack/entities/new/boss/${paths[name]}.json`,import.meta.url)))['minecraft:entity'];
 const groups=new Set(),props=new Map(Object.entries(definition.description.properties??{}).map(([k,v])=>[k,v.default])),dynamic=new Map(),tags=new Set(),events=[],moves=[],spawned=[],shots=[];
 let timer,left=0,definitionChanges=0;const health={currentValue:definition.components['minecraft:health'].max,defaultValue:definition.components['minecraft:health'].max};
 const player={id:'player',typeId:'minecraft:player',isValid:true,location:{x:3,y:64,z:3},hits:[],matches:q=>q.families?.every(f=>f==='player')??false,getEffect:id=>id==='fire_resistance'?{amplifier:0}:undefined,getGameMode:()=> 'Survival',getComponent:id=>id.includes('health')?{currentValue:20,defaultValue:20}:id.includes('equippable')?{getEquipment(){}}:undefined,applyDamage(amount,{cause}={}){if(cause==='fire'||cause==='fireTick')return false;this.hits.push({amount,cause});return true;},applyKnockback(){},addEffect(){},runCommand(){},setOnFire(){}};
 const dimension={id:'minecraft:nether',isChunkLoaded:()=>true,getBlock:({x,y,z})=>({typeId:y<64?'minecraft:purple_stained_glass':'minecraft:air',isSolid:y<64,isAir:y>=64,isLiquid:false,location:{x,y,z}}),getPlayers:()=>[player],getEntities:q=>q?.excludeFamilies||q?.families?.includes('player')?[player]:[],spawnParticle(){},playSound(){},spawnEntity(typeId,location){
  const own=new Map(),ptags=new Set();const comp={owner:undefined,shoot(v){shots.push({entity:p,vector:v});}};
  const p={id:`effect-${serial++}`,typeId,location:{...location},dimension,isValid:true,getComponent:id=>id.includes('projectile')?comp:undefined,getDynamicProperty:k=>own.get(k),setDynamicProperty:(k,v)=>own.set(k,v),hasTag:t=>ptags.has(t),matches:q=>(!q.type||q.type===typeId)&&!q.families?.length&&(!q.tags||q.tags.every(t=>ptags.has(t))),addTag:t=>ptags.add(t),addEffect(){},remove(){p.isValid=false;},triggerEvent(){},applyImpulse(){}};
  spawned.push(p);world.afterEvents.entitySpawn.emit({entity:p,cause:this.spawnCause??'Spawned'});return p;
 }};
 function components(){return Object.assign({},definition.components,...[...groups].map(g=>definition.component_groups[g]??{}));}
 function updateTimer(){const value=components()['minecraft:timer'];if(value!==timer){timer=value;left=value?Math.ceil((Array.isArray(value.time)?value.time[0]:value.time)*20):0;}}
 function filter(f){if(!f)return true;if(f.all_of)return f.all_of.every(filter);if(f.any_of)return f.any_of.some(filter);if(f.test==='bool_property')return props.get(f.domain)===f.value;if(f.test==='is_family')return (f.subject==='other'?['player']:components()['minecraft:type_family'].family).includes(f.value);if(f.test==='int_property'){const n=props.get(f.domain);return f.operator==='>='?n>=f.value:f.operator==='>'?n>f.value:f.operator==='<='?n<=f.value:n===f.value;}if(f.test==='has_component')return (f.operator==='not')!==!!components()[f.value];return true;}
 function response(node){
  if(!filter(node.filters))return;
  if(node.sequence)for(const n of node.sequence)response(n);
  if(node.randomize)response(node.randomize[0]);
  for(const g of node.remove?.component_groups??[])if(groups.delete(g))definitionChanges++;
  for(const g of node.add?.component_groups??[])if(!groups.has(g)){groups.add(g);definitionChanges++;}
  for(let [k,v] of Object.entries(node.set_property??{})){
   if(typeof v==='string'){
    const m=v.match(/^query\.property\('([^']+)'\) ([+-]) (\d+)$/);v=m?props.get(m[1])+(m[2]==='+'?1:-1)*Number(m[3]):Number(v);
   }
   const range=definition.description.properties?.[k]?.range;if(range)v=Math.max(range[0],Math.min(range[1],v));props.set(k,v);
  }
  updateTimer();if(node.trigger)entity.triggerEvent(node.trigger);
  const commands=node.queue_command?.command??[];
  for(const command of typeof commands==='string'?[commands]:commands){
   const prefix='scriptevent jagsby_nether:boss_event ';
   if(command.startsWith(prefix))system.run(()=>system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:boss_event',sourceEntity:entity,message:command.slice(prefix.length)}));
  }
 }
 const entity={id:`native-boss-${serial++}`,typeId:`dungeons:${name}`,isValid:true,location:{x:0,y:64,z:0},dimension,
  getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),getDynamicProperty:k=>dynamic.get(k),setDynamicProperty:(k,v)=>dynamic.set(k,v),hasTag:t=>tags.has(t),addTag:t=>tags.add(t),getTags:()=>[...tags],
  getEffect(){},removeEffect(){},addEffect(){},playAnimation(){},getComponent:id=>id.includes('health')?health:undefined,
  matches:q=>(!q.type||q.type===entity.typeId)&&(!q.families||q.families.every(f=>components()['minecraft:type_family'].family.includes(f)))&&(!q.excludeFamilies||!q.excludeFamilies.some(f=>components()['minecraft:type_family'].family.includes(f)))&&(!q.tags||q.tags.every(t=>tags.has(t)))&&(!q.excludeTags||!q.excludeTags.some(t=>tags.has(t))),
  triggerEvent(id){if(!entity.isValid)return;events.push(id);const node=definition.events[id],before=definitionChanges;if(node)response(node);if(definitionChanges!==before)world.afterEvents.dataDrivenEntityTrigger.emit({entity,eventId:id});},
  tryTeleport(p){moves.push({...p});entity.location={...p};return true;},getHeadLocation:()=>({...entity.location,y:entity.location.y+1.62}),getViewDirection:()=>({x:0,y:0,z:1}),lookAt(){},remove(){entity.isValid=false;},runCommand(){}};
 let processed=timeouts.length;
 function advance(ticks){for(let n=0;n<ticks;n++){
  system.currentTick++;if(timer&&--left<=0){const done=timer;timer=undefined;left=0;if(done.looping){timer=done;left=Math.ceil(done.time*20);}entity.triggerEvent(done.time_down_event.event);}
  let progress=true;while(progress){progress=false;for(let i=processed;i<timeouts.length;i++)if(timeouts[i]&&timeouts[i].due<=system.currentTick){const t=timeouts[i];timeouts[i]=undefined;t.callback();progress=true;}while(processed<timeouts.length&&!timeouts[processed])processed++;}
  flush();
 }}
 function nativeHit(projectile,base){const hit={hurtEntity:player,damage:base,damageSource:{cause:'projectile',damagingEntity:entity,damagingProjectile:projectile}};world.beforeEvents.entityHurt.emit(hit);if(!hit.cancel)player.applyDamage(hit.damage,{cause:'projectile'});return hit;}
 function receiveHit(amount,cause='entity_attack'){
  const matches=(components()['minecraft:damage_sensor']?.triggers??[]).filter(t=>(!t.cause||t.cause==='all'||t.cause===cause)&&filter(t.on_damage?.filters));
  const blocked=matches.some(t=>t.deals_damage===false||t.deals_damage==='no');
  for(const trigger of matches)if(trigger.on_damage?.event)entity.triggerEvent(trigger.on_damage.event);
  if(!blocked)health.currentValue-=amount;
  if(name==='boss_wildfire')for(const t of components()['minecraft:environment_sensor']?.triggers??[])if(filter(t.filters))entity.triggerEvent(t.event);
 }
 return {entity,definition,groups,props,events,moves,spawned,shots,health,player,dimension,components,advance,nativeHit,receiveHit};
}
