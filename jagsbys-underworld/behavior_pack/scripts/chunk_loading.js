import {world,system} from '@minecraft/server';
const PREFIX='underworld_temp_';
const TRACKING='jagsby_nether:temporary_chunk_areas';
function commands(){try{return JSON.parse(world.getDynamicProperty(TRACKING)??'[]');}catch{return [];}}
function track(identifier,dimension,add){const list=commands().filter(a=>a.identifier!==identifier);if(add)list.push({identifier,dimension:dimension.id});world.setDynamicProperty(TRACKING,list.length?JSON.stringify(list):undefined);}
let serial=0;
const loading=new Map();
export function chunkLoadingStatus(){
 const entries=[...loading.values()];
 return entries.map(s=>`Loading ${s.label} at ${s.from.x}, ${s.from.z}: ${s.backend}, ${Math.floor(Math.max((system.currentTick-s.started)*50,Date.now()-s.startedWall)/1000)}s elapsed${s.fallback?'; native loading stalled, using command preload':''}`).join('; ');
}
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
 const nativeIdentifier=`${identifier}_api`;
 let active=false,closed=false,native=false;
 const release=()=>{
  closed=true;loading.delete(identifier);
  if(!active)return;
  if(native){if(manager.hasTickingArea(nativeIdentifier))manager.removeTickingArea(nativeIdentifier);}
  else {dimension.runCommand(`tickingarea remove ${identifier}`);track(identifier,dimension,false);}
  active=false;
 };
 function* load(from,size,timeout=CHUNK_LOAD_TIMEOUT){
  closed=false;
  const to={x:from.x+size[0]-1,y:from.y+size[1]-1,z:from.z+size[2]-1};
  const options={dimension,from,to};let ready=false,error,nativePending=false;
  const started=system.currentTick,startedWall=Date.now();
  const state={label,from:{...from},started,startedWall,backend:'command preload',fallback:false};
  const commandLoad=()=>{
   native=false;
   const result=dimension.runCommand(`tickingarea add ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${identifier} true`);
   if(result?.successCount===0)throw Error(`Chunk preload rejected for ${label} at ${from.x}, ${from.z}; check available ticking-area capacity.`);
   active=true;track(identifier,dimension,true);ready=true;
  };
  loading.set(identifier,state);
  try{
   if(manager?.createTickingArea && manager.hasCapacity(options)){
    native=true;active=true;nativePending=true;state.backend='native ticking area';
    try{manager.createTickingArea(nativeIdentifier,options).then(()=>{
     if(closed||!nativePending){if(manager.hasTickingArea(nativeIdentifier))manager.removeTickingArea(nativeIdentifier);return;}
     ready=true;
    },failure=>{if(nativePending)error=failure;});}catch(failure){error=failure;}
   }else commandLoad();
   const deadline=system.currentTick+timeout;
   while(true){
    // The API promise guarantees that every requested chunk is loaded and ticking.
    // Do not reject that guarantee using a second, potentially inconsistent flag.
    if(native&&ready)return;
    if(!native&&loaded(dimension,from,size))return;
    if(native&&(error||Math.max((system.currentTick-started)*50,Date.now()-startedWall)>=Math.min(5000,timeout*25))){
     nativePending=false;
     if(manager.hasTickingArea(nativeIdentifier))manager.removeTickingArea(nativeIdentifier);
     active=false;state.backend='command preload';state.fallback=true;
     commandLoad();
    }
    if(system.currentTick>=deadline||Date.now()-startedWall>=timeout*50)throw Error(`Chunk loading timed out before placement: ${label} at ${from.x}, ${from.z}, ${size[0]}x${size[2]} blocks (${state.backend}${state.fallback?' after native fallback':''}).`);
    yield {waitTicks:2};
   }
  }finally{loading.delete(identifier);}

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
