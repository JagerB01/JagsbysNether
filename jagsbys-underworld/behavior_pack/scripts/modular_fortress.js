import {FORTRESS_MODULES} from './modular_fortress_catalog.js';
import {chunkLease} from './chunk_loading.js';
import {surfaceAt,clearVolume,obstructionReason} from './landmark_terrain.js';
export function moduleBox(c,m){return {x:c.x+m.offset[0],z:c.z+m.offset[2],sx:m.size[0],sz:m.size[2]};}
export function modularSections(indices){return indices.flatMap(i=>FORTRESS_MODULES[i].sections);}
export function modularCoreBox(c){return moduleBox(c,FORTRESS_MODULES[0]);}
export function* surveyModularFortress(c,dimension,{progress=()=>{},allowed=()=>true}={}){
 let lease;const accepted=[],skipped=[],sections=[];
 try{
  lease=chunkLease(dimension,'modular');yield* lease.load({x:c.x-8,y:0,z:c.z-8},[17,128,17]);
  const surface=yield* surfaceAt(dimension,c.x,c.z,true,c.surfaceHint,71);
  lease.release();lease=undefined;
  if(surface===undefined)return {outcome:'unsuitable',reason:'No exposed lava surface for fortress core'};
  const origin={x:c.x,y:surface-1,z:c.z};let box;
  for(const m of FORTRESS_MODULES){
   if(m.parent!==null&&!accepted.includes(m.parent)){skipped.push(m.index);continue;}
   const footprint=moduleBox(c,m);let reason;
   if(!allowed(footprint))reason='Spacing or player clearance';
   if(origin.y+m.offset[1]+m.size[1]+2>128)reason='Nether ceiling';
   if(!reason)for(const section of m.sections){
    const pos={x:origin.x+section.offset[0],y:origin.y+section.offset[1],z:origin.z+section.offset[2]};
    progress(`Checking fortress ${m.index===0?'core':`module ${m.index}`} of ${FORTRESS_MODULES.length}`);
    lease=chunkLease(dimension,'modular');yield* lease.load({...pos,y:0},[section.size[0],128,section.size[2]]);
    if(!(yield* clearVolume(dimension,pos,[section.size[0],section.size[1]+2,section.size[2]],surface,true,[],true)))reason=obstructionReason();
    lease.release();lease=undefined;if(reason)break;yield;
   }
   if(reason){if(m.index===0)return {outcome:'unsuitable',reason:`Fortress core: ${reason}`};skipped.push(m.index);continue;}
   accepted.push(m.index);sections.push(...m.sections);
   if(!box)box={...footprint};else{const right=Math.max(box.x+box.sx,footprint.x+footprint.sx),far=Math.max(box.z+box.sz,footprint.z+footprint.sz);box.x=Math.min(box.x,footprint.x);box.z=Math.min(box.z,footprint.z);box.sx=right-box.x;box.sz=far-box.z;}
  }
  return {outcome:'ready',id:'mega_fortress',modular:true,modules:accepted,skippedModules:skipped,sections,origin,box,surface,ocean:true,carve:true,supports:[]};
 }catch(error){return {outcome:'deferred',reason:`Modular fortress survey incomplete: ${error.message}`};}
 finally{lease?.release();}
}
