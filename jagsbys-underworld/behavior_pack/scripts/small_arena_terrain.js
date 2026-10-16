import {chunkLease} from './chunk_loading.js';
import {NATURAL_ARENAS} from './natural_arena_catalog.js';
export const SMALL_FOUNDATION_DEPTH=6;
const GROUND=new Set(['minecraft:netherrack','minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone','minecraft:soul_soil','minecraft:soul_sand','minecraft:gravel','minecraft:magma','minecraft:bedrock']);
export function chooseSmallGroundLevel(heights){
 let best;
 for(const level of new Set(heights.filter(Number.isFinite))){
  let fits=0,cost=0;
  for(const floor of heights){
   if(!Number.isFinite(floor)){cost+=200;continue;}
   const gap=level-floor;
   if(gap<=SMALL_FOUNDATION_DEPTH&&gap>=-8)fits++;
   cost+=gap>SMALL_FOUNDATION_DEPTH?200+gap:gap< -8?200-gap:gap>0?gap*gap*2:-gap*.75;
  }
  if(fits/heights.length>=.8&&(!best||cost<best.cost))best={level,cost};
 }
 return best?.level;
}
export function* surveySmallGround(candidate,dimension,reference){
 const arena=NATURAL_ARENAS.small_arena,x=candidate.x-Math.floor(arena.size[0]/2),z=candidate.z-Math.floor(arena.size[2]/2);
 const lease=chunkLease(dimension,'small_ground'),heights=[];
 try{
  // At most 35 chunks for the 56x93 arena, within Bedrock's 100-chunk area limit.
  yield* lease.load({x,y:0,z},[arena.size[0],128,arena.size[2]]);
  for(const section of arena.sections){
   const columns=section.foundationColumns??[],chosen=columns.filter(([cx,cz])=>(cx+section.offset[0])%8===4&&(cz+section.offset[2])%8===4);
   if(!chosen.length&&columns.length)chosen.push(columns[Math.floor(columns.length/2)]);
   for(const [cx,cz] of chosen){
    const px=x+section.offset[0]+cx,pz=z+section.offset[2]+cz;let found;
    for(let y=Math.min(120,reference+12);y>=Math.max(1,reference-48);y--){
     const b=dimension.getBlock({x:px,y,z:pz});if(!b)throw Error('Small Arena ground sample unloaded');
     if(GROUND.has(b.typeId)){
      const above=dimension.getBlock({x:px,y:y+1,z:pz});if(!above)throw Error('Small Arena ground sample unloaded');
      if(above.isAir||above.typeId==='minecraft:air'){found=y;break;}
     }
     if(y%8===0)yield;
    }
    heights.push(found);yield;
   }
  }
  return chooseSmallGroundLevel(heights);
 }finally{lease.release();}
}
