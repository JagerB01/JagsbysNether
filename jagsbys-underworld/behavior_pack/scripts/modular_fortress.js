import {FORTRESS_MODULES} from './modular_fortress_catalog.js';
import {chunkLease} from './chunk_loading.js';
import {surfaceAt,clearVolume,obstructionReason} from './landmark_terrain.js';
export function moduleBox(c,m){return {x:c.x+m.offset[0],z:c.z+m.offset[2],sx:m.size[0],sz:m.size[2]};}
export function modularSections(indices){return indices.flatMap(i=>FORTRESS_MODULES[i].sections);}
export function modularCoreBox(c){return moduleBox(c,FORTRESS_MODULES[0]);}
export function* surveyModularFortress(c,dimension,{progress=()=>{},allowed=()=>true,coreOnly=false}={}){
 let lease;const accepted=[],skipped=[],sections=[];
 try{
  lease=chunkLease(dimension,'modular');yield* lease.load({x:c.x-8,y:0,z:c.z-8},[17,128,17]);
  const surface=yield* surfaceAt(dimension,c.x,c.z,true,c.surfaceHint,71);
  lease.release();lease=undefined;
  if(surface===undefined)return {outcome:'unsuitable',reason:'No exposed lava surface for fortress core'};
  const origin={x:c.x,y:surface-1,z:c.z};let box;
  for(const m of (coreOnly?FORTRESS_MODULES.slice(0,1):FORTRESS_MODULES)){
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

export function pendingModuleBox(c,record){
 const sections=modularSections(record.modules),section=sections[record.next];
 if(section?.foundation)return {...section.foundation,x:record.origin.x+section.foundation.x,z:record.origin.z+section.foundation.z};
 let next=record.expansionNext??0;
 while(next<FORTRESS_MODULES.length&&FORTRESS_MODULES[next].parent!==null&&!record.modules.includes(FORTRESS_MODULES[next].parent))next++;
 return moduleBox(c,FORTRESS_MODULES[next]??FORTRESS_MODULES[0]);
}
export const fortressModuleCount=FORTRESS_MODULES.length;
export function fortressParent(index){return FORTRESS_MODULES[index].parent;}
export function* surveyFortressModule(c,dimension,record,index,{progress=()=>{},allowed=()=>true}={}){
 const m=FORTRESS_MODULES[index],box=moduleBox(c,m);let lease;
 if(!allowed(box))return {outcome:'unsuitable',reason:'Module spacing conflict'};
 if(record.origin.y+m.offset[1]+m.size[1]+2>128)return {outcome:'unsuitable',reason:'Module exceeds Nether ceiling'};
 try{
  for(const s of m.sections){
   const pos={x:record.origin.x+s.offset[0],y:record.origin.y+s.offset[1],z:record.origin.z+s.offset[2]};
   progress(`Surveying next fortress module ${index+1}/${FORTRESS_MODULES.length}`);
   lease=chunkLease(dimension,'modular');yield* lease.load({...pos,y:0},[s.size[0],128,s.size[2]]);
   if(!(yield* clearVolume(dimension,pos,[s.size[0],s.size[1]+2,s.size[2]],record.surface,true,[],true)))return {outcome:'unsuitable',reason:obstructionReason()};
   lease.release();lease=undefined;yield;
  }
  return {outcome:'ready',box};
 }catch(error){return {outcome:'deferred',reason:error.message};}
 finally{lease?.release();}
}
export function extendFortressBox(box,next){
 const x=Math.min(box.x,next.x),z=Math.min(box.z,next.z);
 return {x,z,sx:Math.max(box.x+box.sx,next.x+next.sx)-x,sz:Math.max(box.z+box.sz,next.z+next.sz)-z};
}
