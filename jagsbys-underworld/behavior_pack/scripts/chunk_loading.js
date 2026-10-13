import {world,system} from '@minecraft/server';
const PREFIX='underworld_temp_';
const TRACKING='jagsby_nether:temporary_chunk_areas';
function commands(){try{return JSON.parse(world.getDynamicProperty(TRACKING)??'[]');}catch{return [];}}
function track(identifier,dimension,add){const list=commands().filter(a=>a.identifier!==identifier);if(add)list.push({identifier,dimension:dimension.id});world.setDynamicProperty(TRACKING,list.length?JSON.stringify(list):undefined);}
let serial=0;
export const CHUNK_LOAD_TIMEOUT=600;
function loaded(dimension,from,size){
 const end={x:from.x+size[0]-1,z:from.z+size[2]-1};
 for(let x=Math.floor(from.x/16)*16;x<=end.x;x+=16)for(let z=Math.floor(from.z/16)*16;z<=end.z;z+=16){
  const point={x:Math.max(x,from.x),y:from.y,z:Math.max(z,from.z)};
  try{
   if(dimension.isChunkLoaded && !dimension.isChunkLoaded(point))return false;
   if(!dimension.getBlock(point))return false;
  }catch{return false;}
 }
 return true;
}
// The caller owns this lease even if loading throws; release in its finally.
export function chunkLease(dimension,label='structure'){
 const identifier=`${PREFIX}${label}_${system.currentTick}_${serial++}`;
 const manager=world.tickingAreaManager;
 let active=false,closed=false,native=false;
 const release=()=>{
  closed=true;
  if(!active)return;
  if(native){if(manager.hasTickingArea(identifier))manager.removeTickingArea(identifier);}
  else {dimension.runCommand(`tickingarea remove ${identifier}`);track(identifier,dimension,false);}
  active=false;
 };
 function* load(from,size,timeout=CHUNK_LOAD_TIMEOUT){
  closed=false;
  const to={x:from.x+size[0]-1,y:from.y+size[1]-1,z:from.z+size[2]-1};
  const options={dimension,from,to};let ready=false,error;
  if(manager?.createTickingArea && manager.hasCapacity(options)){
   native=true;active=true;
   manager.createTickingArea(identifier,options).then(()=>{
    if(closed){if(manager.hasTickingArea(identifier))manager.removeTickingArea(identifier);return;}
    ready=true;
   },failure=>{error=failure;});
  }else{
   native=false;
   dimension.runCommand(`tickingarea add ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${identifier} true`);
   active=true;track(identifier,dimension,true);ready=true;
  }
  const deadline=system.currentTick+timeout;
  while(true){
   if(error)throw error;
   if(ready&&loaded(dimension,from,size))return;
   if(system.currentTick>=deadline)throw Error('Chunk loading timed out before placement. The temporary area will be removed.');
   yield {waitTicks:2};
  }
 }
 return {identifier,load,release};
}
// Remove only this pack's owned API areas left by a world closing mid-job.
system.run(()=>{
 for(const area of commands()){try{world.getDimension(area.dimension).runCommand(`tickingarea remove ${area.identifier}`);track(area.identifier,{id:area.dimension},false);}catch{}}
 const manager=world.tickingAreaManager;
 if(!manager?.getAllTickingAreas)return;
 for(const area of manager.getAllTickingAreas())if(area.identifier.startsWith(PREFIX))manager.removeTickingArea(area.identifier);
});
