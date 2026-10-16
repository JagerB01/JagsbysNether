import {sampleSiteQuality} from './site_quality.js';
import {terrainSurvey} from './terrain_survey.js';
import {BlockVolume} from '@minecraft/server';
import {ARENAS} from './arena_catalog.js';
import {NATURAL_ARENAS} from './natural_arena_catalog.js';
import {FOUNDATIONS} from './landmark_foundations.js';
import {GIANTS} from './landmark_sites.js';
import {chunkLease} from './chunk_loading.js';
const AIR=['minecraft:air','minecraft:crimson_roots','minecraft:warped_roots','minecraft:nether_sprouts'];
const FLUID=['minecraft:lava','minecraft:flowing_lava'];
const GROUND=['minecraft:netherrack','minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone','minecraft:soul_soil','minecraft:soul_sand','minecraft:gravel','minecraft:magma','minecraft:bedrock'];
export const CARVABLE=['minecraft:netherrack','minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone','minecraft:gravel','minecraft:soul_soil','minecraft:soul_sand','minecraft:magma','minecraft:quartz_ore','minecraft:nether_gold_ore','minecraft:ancient_debris','minecraft:crimson_nylium','minecraft:warped_nylium','minecraft:crimson_stem','minecraft:warped_stem','minecraft:nether_wart_block','minecraft:warped_wart_block','minecraft:shroomlight','minecraft:glowstone','minecraft:bone_block','minecraft:crimson_roots','minecraft:warped_roots','minecraft:nether_sprouts','minecraft:crimson_fungus','minecraft:warped_fungus','minecraft:red_mushroom','minecraft:brown_mushroom','minecraft:weeping_vines','minecraft:twisting_vines','minecraft:fire','minecraft:soul_fire'];
export const MIN_OCEAN_COVERAGE={large_arena:.9,dragon_arena:.9,mega_fortress:.9};
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
// Coverage is an exact horizontal lava-surface plane, not a 3D volume.
// Whole-footprint budgets are shared across sections, so one shoreline tile
// may be mostly dry if the complete structure still meets the 90% threshold.
// Fully lava chunks need only one native query; count exceptions on demand.
// Reuse the offline-generated authored base mask, including its interior.
// A numeric index avoids rebuilding thousands of coordinate strings per survey.
const dragonSize=NATURAL_ARENAS.dragon_arena.size;
const dragonColumns=new Set(NATURAL_ARENAS.dragon_arena.sections.flatMap(s=>s.foundationColumns.map(([x,z])=>(x+s.offset[0])*dragonSize[2]+z+s.offset[2])));
export function footprintBudget(size,minimum=.9,shape=undefined){
 const area=shape?.columns.size??size[0]*size[2];
 return {area,missing:0,maxMissing:Math.floor(area*(1-minimum)+1e-9),shape};
}
export function dragonFootprintBudget(origin,minimum=.9){
 return footprintBudget(dragonSize,minimum,{columns:dragonColumns,origin,stride:dragonSize[2]});
}
export function* lavaFootprint(d,from,size,surface,budget=footprintBudget(size)){
 for(let x=Math.floor(from.x/16)*16;x<from.x+size[0];x+=16)for(let z=Math.floor(from.z/16)*16;z<from.z+size[2];z+=16){
  const a={x:Math.max(x,from.x),y:surface,z:Math.max(z,from.z)};
  const b={x:Math.min(x+15,from.x+size[0]-1),y:surface,z:Math.min(z+15,from.z+size[2]-1)};
  const volume=new BlockVolume(a,b),filter={excludeTypes:FLUID};
  if(d.containsBlock(volume,filter,false)){
   if(typeof d.getBlocks!=='function')throw Error('Native lava coverage counting unavailable');
   let visited=0;
   for(const p of d.getBlocks(volume,filter,false).getBlockLocationIterator()){
    const shape=budget.shape;
    if(!shape||shape.columns.has((p.x-shape.origin.x)*shape.stride+p.z-shape.origin.z)){
     if(++budget.missing>budget.maxMissing)return false;
    }
    if(++visited%64===0)yield;
   }
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
 const arena=ARENAS[candidate.id],ocean=GIANTS.includes(candidate.id),small=candidate.id==='small_arena',carving=small||ocean;
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
  const quality={solid:0,total:0};
  const supports=[],lavaBudget=candidate.id==='dragon_arena'?dragonFootprintBudget(origin):footprintBudget(arena.size,MIN_OCEAN_COVERAGE[candidate.id]??1);let totalSamples=0,groundSamples=0;
  lease.release();
  for(let index=0;index<arena.sections.length;index++){
   const section=arena.sections[index],[ox,oy,oz]=section.offset;
   const from={x:origin.x+ox,y:origin.y+oy,z:origin.z+oz};
   lease=chunkLease(dimension,'survey');
   progress(`Loading survey section ${index+1}/${arena.sections.length}`);
   yield* lease.load({...from,y:0},[section.size[0],128,section.size[2]]);
   progress(`Surveying section ${index+1}/${arena.sections.length}`);
   if(ocean&&!(yield* lavaFootprint(sampling,from,section.size,surface,lavaBudget)))return {outcome:'unsuitable',reason:'Less than 90% of the footprint is over lava'};
   // Ground sampling applies to land structures; ocean coverage is exact above.
   for(let x=0;x<section.size[0];x+=8)for(let z=0;z<section.size[2];z+=8){
    if(!ocean){
     let found;
     for(let y=surface+(small?12:0);y>=Math.max(1,surface-(small?12:3));y--)if(GROUND.includes(block(sampling,{x:from.x+x,y,z:from.z+z}).typeId)){found=y;break;}
     if(small){totalSamples++;if(found!==undefined)groundSamples++;}
     else if(found===undefined)return {outcome:'unsuitable',reason:'Ground is too uneven or unsupported'};
    }
    yield;
   }
   if(!(yield* clearVolume(sampling,from,[section.size[0],section.size[1]+2,section.size[2]],surface,ocean,[],carving)))return {outcome:'unsuitable',reason:obstructionReason()};
   if(candidate.compareQuality)yield* sampleSiteQuality(sampling,from,section.size,quality);
   const sectionSupports=[];
   for(const anchor of FOUNDATIONS[candidate.id])if(anchor[0]>=ox&&anchor[0]<ox+section.size[0]&&anchor[2]>=oz&&anchor[2]<oz+section.size[2]){
    const support=yield* supportFor(sampling,origin,anchor,carving);
    if(support===false)return {outcome:'unsuitable',reason:'Foundation cannot safely reach natural ground'};
    if(support)sectionSupports.push(support);
    yield;
   }
   supports.push(sectionSupports);lease.release();yield;
  }
  const coverage=ocean?1-lavaBudget.missing/lavaBudget.area:1;
  if(small&&groundSamples/totalSamples<.5)return {outcome:'unsuitable',reason:'Less than half the Small Arena footprint has nearby natural ground'};
  if(ocean&&coverage<MIN_OCEAN_COVERAGE[candidate.id])return {outcome:'unsuitable',reason:`Insufficient ocean coverage: ${Math.round(coverage*100)}%`};
  return {outcome:'ready',origin,surface,ocean,carve:carving,solidFoundation:ocean||carving,coverage,carveFraction:quality.total?quality.solid/quality.total:0,supports,box:{x:origin.x,z:origin.z,sx:arena.size[0],sz:arena.size[2]}};
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
// Thirteen brick and seven deepslate blocks per complete 20-block band.
// Coordinate-derived rotations scatter the mix without RNG or idle work.
export function megaFoundationMaterial(x,y,z){
 let seed=Math.imul(x|0,73856093)^Math.imul(z|0,19349663)^Math.imul(Math.floor(y/20),83492791);
 seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed^=seed>>>16;
 const slot=(((y%20+20)%20)*7+(seed>>>0)%20)%20;
 return slot<13?'minecraft:polished_blackstone_bricks':'minecraft:deepslate';
}
export function* fillSolidFoundation(dimension,pos,size,box,top,guard=()=>true,material=undefined,columns=undefined){
 const footprint=columns??(function*(){for(let x=0;x<size[0];x++)for(let z=0;z<size[2];z++)yield [x,z];})();
 for(const [cx,cz,floor,perimeter] of footprint){
  const x=pos.x+cx,z=pos.z+cz,columnTop=floor===undefined?top:pos.y+floor-1;
  if(!guard())throw Error('Player approached the foundation');
  let bottom=columnTop+1;
  for(let y=columnTop;y>=1;y--){
   const type=block(dimension,{x,y,z}).typeId;
   if(!['minecraft:air',...FLUID].includes(type))break;
   bottom=y;if((columnTop-y)%8===7)yield;
  }
  if(bottom<=columnTop){
   if(!guard())throw Error('Player approached the foundation');
   const edge=perimeter??(x===box.x||z===box.z||x===box.x+box.sx-1||z===box.z+box.sz-1);
   if(typeof material==='function'){
    // Bottom-up runs leave a solid checkpoint. On interruption, the next
    // scan fills only the remaining gap with the same coordinate pattern.
    for(let y=bottom;y<=columnTop;){
     const type=material(x,y,z);let end=y;
     while(end<columnTop&&material(x,end+1,z)===type)end++;
     if(!guard())throw Error('Player approached the foundation');
     dimension.fillBlocks(new BlockVolume({x,y,z},{x,y:end,z}),type,{blockFilter:{includeTypes:['minecraft:air',...FLUID]}});
     y=end+1;yield;
    }
   }else dimension.fillBlocks(new BlockVolume({x,y:bottom,z},{x,y:columnTop,z}),material??(edge?'minecraft:blackstone':'minecraft:netherrack'),{blockFilter:{includeTypes:['minecraft:air',...FLUID]}});
  }
  yield;
 }
}
