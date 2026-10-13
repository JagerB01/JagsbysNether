import {terrainSurvey} from './terrain_survey.js';
import {BlockVolume} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
import {FOUNDATIONS} from './landmark_foundations.js';
import {GIANTS} from './landmark_sites.js';
import {chunkLease} from './chunk_loading.js';
const AIR=['minecraft:air','minecraft:crimson_roots','minecraft:warped_roots','minecraft:nether_sprouts'];
const FLUID=['minecraft:lava','minecraft:flowing_lava'];
const GROUND=['minecraft:netherrack','minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone','minecraft:soul_soil','minecraft:soul_sand','minecraft:gravel','minecraft:magma','minecraft:bedrock'];
export const CARVABLE=['minecraft:netherrack','minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone','minecraft:gravel','minecraft:soul_soil','minecraft:soul_sand','minecraft:magma','minecraft:quartz_ore','minecraft:nether_gold_ore','minecraft:ancient_debris','minecraft:crimson_nylium','minecraft:warped_nylium','minecraft:crimson_stem','minecraft:warped_stem','minecraft:nether_wart_block','minecraft:warped_wart_block','minecraft:shroomlight','minecraft:glowstone','minecraft:bone_block','minecraft:crimson_roots','minecraft:warped_roots','minecraft:nether_sprouts','minecraft:crimson_fungus','minecraft:warped_fungus','minecraft:red_mushroom','minecraft:brown_mushroom','minecraft:weeping_vines','minecraft:twisting_vines','minecraft:fire','minecraft:soul_fire'];
export const MIN_OCEAN_COVERAGE={large_arena:.20,dragon_arena:.15,mega_fortress:.10};
function block(d,p){const b=d.getBlock(p);if(!b)throw Error('Terrain is unloaded');return b;}
export function biomeName(id){return ({'minecraft:hell':'nether_wastes','minecraft:nether_wastes':'nether_wastes','minecraft:crimson_forest':'crimson_forest','minecraft:warped_forest':'warped_forest','minecraft:soulsand_valley':'soulsand_valley','minecraft:soul_sand_valley':'soulsand_valley','minecraft:basalt_deltas':'basalt_deltas'})[id];}
export function biomeAllows(c,biome){
 if(GIANTS.includes(c.id))return !!biome;
 if(c.id==='small_arena')return biome==='basalt_deltas';
 if(c.id==='grave_yard')return biome==='soulsand_valley';
 return biome==='basalt_deltas'||biome==='nether_wastes';
}
export function* surfaceAt(d,x,z,ocean,near=undefined,max=115){
 const tried=new Set();
 const heights=[];
 if(Number.isFinite(near))for(let y=Math.min(max,near+8);y>=Math.max(8,near-16);y--)heights.push(y);
 for(let y=Math.min(max,115);y>=8;y--)heights.push(y);
 for(const y of heights){
  if(tried.has(y))continue;tried.add(y);
  const type=block(d,{x,y,z}).typeId;
  if((ocean?FLUID:GROUND).includes(type)&&AIR.includes(block(d,{x,y:y+1,z}).typeId))return y;
  if(tried.size%8===0)yield;
 }
 return undefined;
}
let obstruction='Protected blocks obstruct the footprint';
export function obstructionReason(){return obstruction;}
function describeObstruction(d,volume,filter){
 obstruction=`Protected block within ${volume.from.x}, ${volume.from.y}, ${volume.from.z}`;
 try{if(d.getBlocks)for(const p of d.getBlocks(volume,filter,false).getBlockLocationIterator()){
  obstruction=`Protected ${block(d,p).typeId} at ${p.x}, ${p.y}, ${p.z}`;break;
 }}catch{}
 return false;
}
// Native volume filtering avoids millions of JS getBlock calls. Each query is
// limited to a 16x16 column, and unloaded chunks are never silently ignored.
export function* clearVolume(d,from,size,surface,ocean,extra=[],carve=ocean){
 const removable=carve?[...CARVABLE,...FLUID]:[];
 if(typeof d.containsBlock!=='function')throw Error('Native block-volume query unavailable');
 for(let x=Math.floor(from.x/16)*16;x<from.x+size[0];x+=16)for(let z=Math.floor(from.z/16)*16;z<from.z+size[2];z+=16){
  const start={x:Math.max(x,from.x),y:Math.max(from.y,surface+1),z:Math.max(z,from.z)};
  const end={x:Math.min(x+15,from.x+size[0]-1),y:from.y+size[1]-1,z:Math.min(z+15,from.z+size[2]-1)};
  if(start.y<=end.y&&d.containsBlock(new BlockVolume(start,end),{excludeTypes:[...AIR,...removable,...extra]},false))return describeObstruction(d,new BlockVolume(start,end),{excludeTypes:[...AIR,...removable,...extra]});
  if(ocean&&from.y<=surface){
   if(d.containsBlock(new BlockVolume({...start,y:from.y},{...end,y:surface}),{excludeTypes:[...AIR,...FLUID,...removable,...extra]},false))return describeObstruction(d,new BlockVolume({...start,y:from.y},{...end,y:surface}),{excludeTypes:[...AIR,...FLUID,...removable,...extra]});
  }
  yield;
 }
 return true;
}
export function* supportFor(d,origin,anchor,carve=false){
 const p={x:origin.x+anchor[0],y:origin.y+anchor[1]-1,z:origin.z+anchor[2]},top=p.y;
 for(let depth=0;depth<=128&&p.y>=1;depth++,p.y--){
  const type=block(d,p).typeId;
  if(GROUND.includes(type)&&(!carve||p.y<origin.y||type==='minecraft:bedrock'))return p.y===top?undefined:{x:p.x,z:p.z,bottom:p.y+1,top};
  if(![...AIR,...FLUID,...(carve?CARVABLE:[])].includes(type))return false;
  if(depth%8===0)yield;
 }
 return false;
}
export function* surveyLandmark(candidate,dimension,progress=()=>{},cache=undefined){
 const sampling=cache??dimension;
 const arena=ARENAS[candidate.id],ocean=GIANTS.includes(candidate.id),small=candidate.id==='small_arena',carving=ocean||small;
 const floor=candidate.id==='grave_yard'||ocean?0:1;
 const offset=ocean?(candidate.id==='mega_fortress'?-1:2):1-floor;
 let lease=chunkLease(dimension,'survey');
 try{
  progress('Loading initial terrain probe');
  yield* lease.load({x:candidate.x-8,y:0,z:candidate.z-8},[17,128,17]);
  progress('Surveying initial terrain probe');
  const surface=yield* surfaceAt(sampling,candidate.x,candidate.z,ocean,candidate.floorHint??candidate.surfaceHint,128-arena.size[1]-2-offset);
  if(surface===undefined)return {outcome:'unsuitable',reason:ocean?'No open lava surface':'No exposed natural ground'};
  if(ocean){terrainSurvey.ocean(candidate.x,candidate.z,surface);terrainSurvey.flush();}
  if(!ocean){
   let rawBiome;
   try{rawBiome=dimension.getBiome?.({x:candidate.x,y:surface+1,z:candidate.z})?.id;}catch{}
   const biome=biomeName(rawBiome);
   if(!biome)return {outcome:'deferred',reason:`Biome unavailable (${rawBiome??'no native result'})`};
   if(!biomeAllows(candidate,biome))return {outcome:'unsuitable',reason:`Biome ${biome} does not match ${candidate.id}`};
  }
  const origin={x:candidate.x-Math.floor(arena.size[0]/2),y:ocean?(candidate.id==='mega_fortress'?surface-1:surface+2):surface+1-floor,z:candidate.z-Math.floor(arena.size[2]/2)};
  if(origin.y+arena.size[1]+2>128)return {outcome:'unsuitable',reason:'Insufficient height below Nether ceiling'};
  const supports=[];let oceanSamples=0,totalSamples=0,groundSamples=0;
  lease.release();
  for(let index=0;index<arena.sections.length;index++){
   const section=arena.sections[index],[ox,oy,oz]=section.offset;
   const from={x:origin.x+ox,y:origin.y+oy,z:origin.z+oz};
   lease=chunkLease(dimension,'survey');
   progress(`Loading survey section ${index+1}/${arena.sections.length}`);
   yield* lease.load({...from,y:0},[section.size[0],128,section.size[2]]);
   progress(`Surveying section ${index+1}/${arena.sections.length}`);
   // All sampled ground must be nearby in height; oceans must cover every sample.
   for(let x=0;x<section.size[0];x+=8)for(let z=0;z<section.size[2];z+=8){
    if(ocean){totalSamples++;if(FLUID.includes(block(sampling,{x:from.x+x,y:surface,z:from.z+z}).typeId))oceanSamples++;}
    else{
     let found;
     for(let y=surface+(small?12:0);y>=Math.max(1,surface-(small?12:3));y--)if(GROUND.includes(block(sampling,{x:from.x+x,y,z:from.z+z}).typeId)){found=y;break;}
     if(small){totalSamples++;if(found!==undefined)groundSamples++;}
     else if(found===undefined)return {outcome:'unsuitable',reason:'Ground is too uneven or unsupported'};
    }
    yield;
   }
   if(!(yield* clearVolume(sampling,from,[section.size[0],section.size[1]+2,section.size[2]],surface,ocean,[],carving)))return {outcome:'unsuitable',reason:obstructionReason()};
   const sectionSupports=[];
   for(const anchor of FOUNDATIONS[candidate.id])if(anchor[0]>=ox&&anchor[0]<ox+section.size[0]&&anchor[2]>=oz&&anchor[2]<oz+section.size[2]){
    const support=yield* supportFor(sampling,origin,anchor,carving);
    if(support===false)return {outcome:'unsuitable',reason:'Foundation cannot safely reach natural ground'};
    if(support)sectionSupports.push(support);
    yield;
   }
   supports.push(sectionSupports);lease.release();yield;
  }
  const coverage=ocean?oceanSamples/totalSamples:1;
  if(small&&groundSamples/totalSamples<.5)return {outcome:'unsuitable',reason:'Less than half the Small Arena footprint has nearby natural ground'};
  if(ocean&&coverage<MIN_OCEAN_COVERAGE[candidate.id])return {outcome:'unsuitable',reason:`Insufficient ocean coverage: ${Math.round(coverage*100)}%`};
  return {outcome:'ready',origin,surface,ocean,carve:carving,coverage,supports,box:{x:origin.x,z:origin.z,sx:arena.size[0],sz:arena.size[2]}};
 }finally{lease.release();}
}
export function* fillSupports(dimension,supports,guard=()=>true,carve=false){
 for(const p of supports){
  if(!guard())throw Error('Player approached the foundation');
  // Check again before writing: never replace unrelated blocks added after surveying.
  const volume=new BlockVolume({x:p.x,y:p.bottom,z:p.z},{x:p.x,y:p.top,z:p.z});
  if(dimension.containsBlock(volume,{excludeTypes:[...AIR,...FLUID,...(carve?CARVABLE:[]),'minecraft:polished_blackstone']},false))throw Error('Foundation changed after survey');
  dimension.fillBlocks(volume,'minecraft:polished_blackstone');yield;
 }
}

export function carveTile(dimension,pos,size){
 // Remove only ordinary Nether terrain. Liquids, bedrock and constructed
 // blocks are not removed by this pass. Native template air clears its rooms.
 const volume=new BlockVolume(pos,{x:pos.x+size[0]-1,y:pos.y+size[1]-1,z:pos.z+size[2]-1});
 dimension.fillBlocks(volume,'minecraft:air',{blockFilter:{includeTypes:CARVABLE}});
}

// Fill only empty space and lava beneath the footprint; existing solids end
// each column. Yield during scans and after writes to keep generation staged.
export function* fillSolidFoundation(dimension,pos,size,box,top,guard=()=>true){
 for(let x=pos.x;x<pos.x+size[0];x++)for(let z=pos.z;z<pos.z+size[2];z++){
  if(!guard())throw Error('Player approached the foundation');
  let bottom=top+1;
  for(let y=top;y>=1;y--){
   const type=block(dimension,{x,y,z}).typeId;
   if(!['minecraft:air',...FLUID].includes(type))break;
   bottom=y;if((top-y)%8===7)yield;
  }
  if(bottom<=top){
   if(!guard())throw Error('Player approached the foundation');
   const edge=x===box.x||z===box.z||x===box.x+box.sx-1||z===box.z+box.sz-1;
   dimension.fillBlocks(new BlockVolume({x,y:bottom,z},{x,y:top,z}),edge?'minecraft:blackstone':'minecraft:netherrack',{blockFilter:{includeTypes:['minecraft:air',...FLUID]}});
  }
  yield;
 }
}
