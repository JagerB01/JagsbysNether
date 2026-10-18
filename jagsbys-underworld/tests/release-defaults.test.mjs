import test from 'node:test';
import assert from 'node:assert/strict';
import {world,system,intervals} from './mock-server.mjs';
import {remember,recordBossAction,runtimeStatus} from '../behavior_pack/scripts/infernal_lords/runtime.js';
import '../behavior_pack/scripts/infernal_lords/boss_damage_watch.js';
import {initializeRelease} from '../behavior_pack/scripts/release.js';
import {nextGiantCommand,nextGiant} from '../behavior_pack/scripts/next_giant.js';
const command=(id,message,player)=>system.afterEvents.scriptEventReceive.emit({id:'jagsby_nether:'+id,message,sourceEntity:player});
test('release combat tracing is off by default and subscribes only for an explicit tracing session',()=>{
 assert.equal(runtimeStatus().tracing,false);const subscriptions=world.afterEvents.entityHurt.subscriberCount,runs=intervals.length;
 const boss={id:'release-boss',typeId:'dungeons:nameless_one',isValid:true,getProperty:()=>false,hasTag:()=>false};remember(boss);
 recordBossAction(boss,'teleport_success');assert.deepEqual(runtimeStatus().bosses[0].events,{});
 const player={typeId:'minecraft:player',sendMessage(){}};
 command('lords_status','',player);command('lords_trace','status',player);assert.equal(world.afterEvents.entityHurt.subscriberCount,subscriptions);
 command('lords_trace','on',player);command('lords_trace','on',player);assert.equal(world.afterEvents.entityHurt.subscriberCount,subscriptions+1);
 recordBossAction(boss,'teleport_success');world.afterEvents.entityHurt.emit({damage:8,damageSource:{cause:'projectile',damagingEntity:boss}});
 assert.deepEqual(runtimeStatus().bosses[0].events,{teleport_success:1,projectile_damage:8});
 command('lords_trace','off',player);assert.equal(world.afterEvents.entityHurt.subscriberCount,subscriptions);
 recordBossAction(boss,'teleport_success');assert.deepEqual(runtimeStatus().bosses[0].events,{});assert.equal(intervals.length,runs);
 boss.isValid=false;world.afterEvents.entityRemove.emit({removedEntityId:boss.id});
});
test('damage watch status is passive; listeners are removed after the last watcher stops or leaves',()=>{
 world.getDifficulty=()=> 'Hard';const before=world.beforeEvents.entityHurt.subscriberCount,after=world.afterEvents.entityHurt.subscriberCount,runs=intervals.length;
 const player=id=>({id,typeId:'minecraft:player',sendMessage(){}}),a=player('a'),b=player('b');
 command('boss_damage_watch','',a);command('boss_damage_watch','status',a);command('boss_damage_watch','unknown',a);
 assert.equal(world.beforeEvents.entityHurt.subscriberCount,before);assert.equal(world.afterEvents.entityHurt.subscriberCount,after);
 command('boss_damage_watch','on',a);command('boss_damage_watch','on',a);command('boss_damage_watch','on',b);
 assert.equal(world.beforeEvents.entityHurt.subscriberCount,before+1);assert.equal(world.afterEvents.entityHurt.subscriberCount,after+1);
 command('boss_damage_watch','off',a);assert.equal(world.afterEvents.entityHurt.subscriberCount,after+1);
 world.afterEvents.playerLeave.emit({playerId:b.id});assert.equal(world.beforeEvents.entityHurt.subscriberCount,before);assert.equal(world.afterEvents.entityHurt.subscriberCount,after);
 command('boss_damage_watch','on',a);command('boss_damage_watch','off',a);assert.equal(world.afterEvents.entityHurt.subscriberCount,after);assert.equal(intervals.length,runs);
});
test('first 1.0 load clears a stale forced giant once, preserving construction and later explicit admin overrides',()=>{
 const values=new Map([['underworld_landmarks:giant_0_0',JSON.stringify({state:'placing',next:7})]]);let writes=0;
 const storage={getDynamicProperty:k=>values.get(k),setDynamicProperty(k,v){writes++;if(v===undefined)values.delete(k);else values.set(k,v);}};
 nextGiantCommand('mega_fortress',storage);assert(nextGiant(storage));
 assert.equal(initializeRelease(storage),true);assert.equal(nextGiant(storage),undefined);assert.deepEqual(JSON.parse(values.get('underworld_landmarks:giant_0_0')),{state:'placing',next:7});
 nextGiantCommand('dragon_arena',storage);const before=writes;assert.equal(initializeRelease(storage),false);assert.equal(writes,before);assert.equal(nextGiant(storage).id,'dragon_arena');
});
