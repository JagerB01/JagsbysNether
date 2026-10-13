import {BlockVolume} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
import {FOUNDATIONS} from './landmark_foundations.js';
import {GIANTS} from './landmark_sites.js';
import {chunkLease} from './chunk_loading.js';
const AIR=['minecraft:air','minecraft:crimson_roots','minecraft:warped_roots','minecraft:nether_sprouts'];
const FLUID=['minecraft:lava','minecraft:flowing_lava'];
const GROUND=['minecraft:netherrack','minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone','minecraft:soul_soil','minecraft:soul_sand','minecraft:gravel','minecraft:magma','minecraft:bedrock'];
function block(d,p){const b=d.getBlock(p);if(!b)throw Error('Terrain is unloaded');return b;}
export function biomeName(id){return ({'minecraft:hell':'nether_wastes','minecraft:nether_wastes':'nether_wastes','minecraft:crimson_forest':'crimson_forest','minecraft:warped_forest':'warped_forest','minecraft:soulsand_valley':'soulsand_valley','minecraft:soul_sand_valley':'soulsand_valley','minecraft:basalt_deltas':'basalt_deltas'})[id];}
export function biomeAllows(c,biome){
 if(GIANTS.includes(c.id))return !!biome;
 if(c.id==='small_arena')return biome===c.biome;
 if(c.id==='grave_yard')return biome==='soulsand_valley';
 return biome==='basalt_deltas'||biome==='nether_wastes';
}
export function* surfaceAt(d,x,z,ocean){
 for(let y=ocean?64:115;y>=24;y--){
  const type=block(d,{x,y,z}).typeId;
  if((ocean?FLUID:GROUND).includes(type)&&AIR.includes(block(d,{x,y:y+1,z}).typeId))return y;
  if(y%8===0)yield;
 }
 return undefined;
}
// Native volume filtering avoids millions of JS getBlock calls. Each query is
// limited to a 16x16 column, and unloaded chunks are never silently ignored.
export function* clearVolume(d,from,size,surface,ocean,extra=[]){
 if(typeof d.containsBlock!=='function')throw Error('Native block-volume query unavailable');
 for(let x=0;x<size[0];x+=16)for(let z=0;z<size[2];z+=16){
  const start={x:from.x+x,y:Math.max(from.y,surface+1),z:from.z+z};
  const end={x:from.x+Math.min(x+15,size[0]-1),y:from.y+size[1]-1,z:from.z+Math.min(z+15,size[2]-1)};
  if(start.y<=end.y&&d.containsBlock(new BlockVolume(start,end),{excludeTypes:[...AIR,...extra]},false))return false;
  if(ocean&&from.y<=surface){
   if(d.containsBlock(new BlockVolume({...start,y:from.y},{...end,y:surface}),{excludeTypes:[...AIR,...FLUID,...extra]},false))return false;
  }
  yield;
 }
 return true;
}
export function* supportFor(d,origin,anchor){
 const p={x:origin.x+anchor[0],y:origin.y+anchor[1]-1,z:origin.z+anchor[2]},top=p.y;
 for(let depth=0;depth<=64&&p.y>=1;depth++,p.y--){
  const type=block(d,p).typeId;
  if(GROUND.includes(type))return p.y===top?undefined:{x:p.x,z:p.z,bottom:p.y+1,top};
  if(![...AIR,...FLUID].includes(type))return false;
  if(depth%8===0)yield;
 }
 return false;
}
export function* surveyLandmark(candidate,dimension){
 const arena=ARENAS[candidate.id],ocean=GIANTS.includes(candidate.id);
 let lease=chunkLease(dimension,'survey');
 try{
  yield* lease.load({x:candidate.x-8,y:0,z:candidate.z-8},[17,128,17]);
  const surface=yield* surfaceAt(dimension,candidate.x,candidate.z,ocean);
  if(surface===undefined)return {outcome:'unsuitable',reason:ocean?'No open lava surface':'No exposed natural ground'};
  const biome=biomeName(dimension.getBiome({x:candidate.x,y:surface+1,z:candidate.z})?.id);
  if(!biome)return {outcome:'deferred',reason:'Biome unavailable'};
  if(!biomeAllows(candidate,biome))return {outcome:'unsuitable',reason:'Biome does not match'};
  const floor=candidate.id==='grave_yard'||ocean?0:1;
  const origin={x:candidate.x-Math.floor(arena.size[0]/2),y:ocean?(candidate.id==='mega_fortress'?surface-1:surface+2):surface+1-floor,z:candidate.z-Math.floor(arena.size[2]/2)};
  if(origin.y+arena.size[1]+2>128)return {outcome:'unsuitable',reason:'Insufficient height below Nether ceiling'};
  const supports=[];
  lease.release();
  for(let index=0;index<arena.sections.length;index++){
   const section=arena.sections[index],[ox,oy,oz]=section.offset;
   const from={x:origin.x+ox,y:origin.y+oy,z:origin.z+oz};
   lease=chunkLease(dimension,'survey');
   yield* lease.load({...from,y:0},[section.size[0],128,section.size[2]]);
   // All sampled ground must be nearby in height; oceans must cover every sample.
   for(let x=0;x<section.size[0];x+=8)for(let z=0;z<section.size[2];z+=8){
    if(ocean){if(!FLUID.includes(block(dimension,{x:from.x+x,y:surface,z:from.z+z}).typeId))return {outcome:'unsuitable',reason:'Lava ocean is too small'};}
    else{
     let found;
     for(let y=surface;y>=surface-3;y--)if(GROUND.includes(block(dimension,{x:from.x+x,y,z:from.z+z}).typeId)){found=y;break;}
     if(found===undefined)return {outcome:'unsuitable',reason:'Ground is too uneven or unsupported'};
    }
    yield;
   }
   if(!(yield* clearVolume(dimension,from,[section.size[0],section.size[1]+2,section.size[2]],surface,ocean)))return {outcome:'unsuitable',reason:'Cavern ceiling, terrain or existing blocks obstruct the footprint'};
   const sectionSupports=[];
   for(const anchor of FOUNDATIONS[candidate.id])if(anchor[0]>=ox&&anchor[0]<ox+section.size[0]&&anchor[2]>=oz&&anchor[2]<oz+section.size[2]){
    const support=yield* supportFor(dimension,origin,anchor);
    if(support===false)return {outcome:'unsuitable',reason:'Foundation cannot safely reach natural ground'};
    if(support)sectionSupports.push(support);
    yield;
   }
   supports.push(sectionSupports);lease.release();yield;
  }
  return {outcome:'ready',origin,surface,ocean,supports,box:{x:origin.x,z:origin.z,sx:arena.size[0],sz:arena.size[2]}};
 }finally{lease.release();}
}
export function* fillSupports(dimension,supports,guard=()=>true){
 for(const p of supports){
  if(!guard())throw Error('Player approached the foundation');
  // Check again before writing: never replace unrelated blocks added after surveying.
  const volume=new BlockVolume({x:p.x,y:p.bottom,z:p.z},{x:p.x,y:p.top,z:p.z});
  if(dimension.containsBlock(volume,{excludeTypes:[...AIR,...FLUID,'minecraft:polished_blackstone']},false))throw Error('Foundation changed after survey');
  dimension.fillBlocks(volume,'minecraft:polished_blackstone');yield;
 }
}
