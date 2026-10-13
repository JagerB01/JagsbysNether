import {recordEncounterSite} from './trial_encounters.js';
import {runGenerationJob} from './generation_queue.js';
import {world,system} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
import {chunkLease} from './chunk_loading.js';
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
 const lease=chunkLease(dimension,'template');
 const clear=()=>lease.release();
 function* load(from,size){yield* lease.load(from,size);}
 try{
  const endX=origin.x+arena.size[0]-1,endZ=origin.z+arena.size[2]-1;
  const chunks=(Math.floor(endX/16)-Math.floor(origin.x/16)+1)*(Math.floor(endZ/16)-Math.floor(origin.z/16)+1);
  const perSection=chunks>100;
  // Large fortress footprints load one native section at a time, staying below
  // Bedrock's 100-chunk ticking-area limit without increasing persistent limits.
  if(!perSection)yield* load(origin,arena.size);
  notify(`Placing ${arena.display_name} (${arena.size.join(' × ')}) at ${origin.x}, ${origin.y}, ${origin.z}...`);
  for(const section of arena.sections){
   const [x,y,z]=section.offset,pos={x:origin.x+x,y:origin.y+y,z:origin.z+z};
   if(perSection)yield* load(pos,section.size);
   world.structureManager.place(section.id,dimension,pos,{includeEntities:false,includeBlocks:true});
   yield;
   if(perSection)clear();
  }
  recordEncounterSite(id,origin,dimension.id);
  notify(`${arena.display_name} placed. Manual template placement complete.`);
 }finally{
  try{clear();}catch(error){console.warn(`[Underworld templates] Temporary area cleanup failed: ${error}`);}
 }
}
// Manual testing remains separate from natural terrain surveys.
system.afterEvents.scriptEventReceive.subscribe(({id,message,sourceEntity:player})=>{
 if(!['jagsby_nether:arena','jagsby_nether:template'].includes(id)||player?.typeId!=='minecraft:player')return;
 const notify=message=>player.sendMessage(`[Underworld arenas] ${message}`);
 if(!message.trim()||message.trim()==='list'){notify(Object.entries(ARENAS).map(([id,a])=>`${id}: ${a.size.join(' × ')}`).join('; '));return;}
 if(busy){notify('An arena is already being placed.');return;}
 let request;try{request=arenaRequest(message,player);}catch(error){notify(String(error.message));return;}
 busy=true;
 runGenerationJob((function*(){try{yield* placeArena(request,notify);}catch(error){notify(`Placement stopped: ${error.message}`);console.warn(`[Underworld arenas] ${error}`);}finally{busy=false;}})());
});
