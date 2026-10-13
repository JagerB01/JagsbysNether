import {world,system} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
let busy=false;
export function arenaRequest(message,player){
 const [id,...coordinates]=message.trim().split(/\s+/);
 if(!ARENAS[id])throw Error(`Choose ${Object.keys(ARENAS).join(', ')}.`);
 if(coordinates.length!==0&&coordinates.length!==3)throw Error('Use an arena name, optionally followed by absolute X Y Z.');
 const origin=coordinates.length?coordinates.map(Number):[Math.floor(player.location.x)+8,Math.floor(player.location.y)-1,Math.floor(player.location.z)+8];
 if(!origin.every(Number.isSafeInteger))throw Error('Coordinates must be whole numbers.');
 const arena=ARENAS[id],dimension=player.dimension;
 const height=dimension.heightRange;
 if(height&&(origin[1]<height.min||origin[1]+arena.size[1]>height.max))throw Error(`Arena height must fit between Y ${height.min} and ${height.max-1}. Choose a lower Y.`);
 return {id,arena,dimension,origin:{x:origin[0],y:origin[1],z:origin[2]}};
}
export function* placeArena({id,arena,dimension,origin},notify=()=>{}){
 const area=`underworld_arena_${system.currentTick}`;let forced=false;
 try{
  const end={x:origin.x+arena.size[0]-1,y:origin.y+arena.size[1]-1,z:origin.z+arena.size[2]-1};
  // Temporarily load the whole footprint, including the Dragon Arena's far end.
  // The largest template occupies fewer than the 100-chunk area limit.
  dimension.runCommand(`tickingarea add ${origin.x} ${origin.y} ${origin.z} ${end.x} ${end.y} ${end.z} ${area}`);
  forced=true;
  const ready=system.currentTick+2;while(system.currentTick<ready)yield;
  for(let x=Math.floor(origin.x/16)*16;x<=end.x;x+=16)for(let z=Math.floor(origin.z/16)*16;z<=end.z;z+=16){
   if(!dimension.getBlock({x,y:origin.y,z}))throw Error('Some arena chunks are still unloaded. Retry after they load.');
  }
  notify(`Placing ${arena.display_name} (${arena.size.join(' × ')}) at ${origin.x}, ${origin.y}, ${origin.z}...`);
  for(const section of arena.sections){
   const [x,y,z]=section.offset;
   world.structureManager.place(section.id,dimension,{x:origin.x+x,y:origin.y+y,z:origin.z+z},{includeEntities:false,includeBlocks:true});
   yield;
  }
  notify(`${arena.display_name} placed. Natural spawning is disabled.`);
 }finally{
  if(forced)try{dimension.runCommand(`tickingarea remove ${area}`);}catch(error){console.warn(`[Underworld arenas] Temporary area cleanup failed: ${error}`);}
 }
}
// The only entry point is an explicit test command below.
system.afterEvents.scriptEventReceive.subscribe(({id,message,sourceEntity:player})=>{
 if(id!=='jagsby_nether:arena'||player?.typeId!=='minecraft:player')return;
 const notify=message=>player.sendMessage(`[Underworld arenas] ${message}`);
 if(!message.trim()||message.trim()==='list'){notify(Object.entries(ARENAS).map(([id,a])=>`${id}: ${a.size.join(' × ')}`).join('; '));return;}
 if(busy){notify('An arena is already being placed.');return;}
 let request;try{request=arenaRequest(message,player);}catch(error){notify(String(error.message));return;}
 busy=true;
 system.runJob((function*(){try{yield* placeArena(request,notify);}catch(error){notify(`Placement stopped: ${error.message}`);console.warn(`[Underworld arenas] ${error}`);}finally{busy=false;}})());
});
