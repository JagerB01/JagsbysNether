import {surveyModularFortress,modularCoreBox} from './modular_fortress.js';
import {ARENAS} from './arena_catalog.js';
import {surveyLandmark} from './landmark_terrain.js';
export const GIANT_WEIGHTS={large_arena:1,dragon_arena:1,mega_fortress:1};
// Natural selection restored for all three giants.
export const TEST_ONLY_GIANT=null;
export const FIT_ORDER=['dragon_arena','large_arena','mega_fortress'];
export function chooseFittingGiant(ids,roll){
 if(!FIT_ORDER.every(id=>ids.includes(id)))return undefined;
 if(TEST_ONLY_GIANT)return TEST_ONLY_GIANT;
 const entries=Object.entries(GIANT_WEIGHTS).filter(([id])=>ids.includes(id));
 if(!entries.length)return undefined;
 let pick=roll*entries.reduce((n,[,weight])=>n+weight,0);
 for(const [id,weight] of entries){pick-=weight;if(pick<0)return id;}
 return entries.at(-1)[0];
}
// Reuse reads and proven-clear volumes only within this assessment. Placement
// always validates against the real dimension, never this snapshot.
export function footprintSurveyCache(d){
 const blocks=new Map(),clear=new Map();
 return {id:d.id,getBlocks:d.getBlocks?.bind(d),getBlock(p){
  const key=`${p.x},${p.y},${p.z}`;if(blocks.has(key))return blocks.get(key);
  const b=d.getBlock(p);if(!b)return undefined;
  const value={typeId:b.typeId,isAir:b.isAir,isLiquid:b.isLiquid,location:{...p}};
  if(blocks.size>=60000)blocks.delete(blocks.keys().next().value);blocks.set(key,value);return value;
 },containsBlock(volume,filter,allowUnloaded){
  const key=`${Math.floor(volume.from.x/16)},${Math.floor(volume.from.z/16)}:${JSON.stringify(filter)}`;
  const proofs=clear.get(key)??[];
  if(allowUnloaded===false&&proofs.some(p=>p.from.x<=volume.from.x&&p.from.y<=volume.from.y&&p.from.z<=volume.from.z&&p.to.x>=volume.to.x&&p.to.y>=volume.to.y&&p.to.z>=volume.to.z))return false;
  const found=d.containsBlock(volume,filter,allowUnloaded);
  if(!found&&allowUnloaded===false){proofs.push({from:{...volume.from},to:{...volume.to}});clear.set(key,proofs);}
  return found;
 }};
}
export function* surveyGiant(c,d,progress,cache){
 if(c.id==='mega_fortress')return yield* surveyModularFortress(c,d,{progress,coreOnly:true,sampling:cache??d});
 return yield* surveyLandmark(c,d,progress,cache);
}
export function giantStartingBox(c,id){
 if(id==='mega_fortress')return modularCoreBox(c);
 const a=ARENAS[id];return {x:c.x-Math.floor(a.size[0]/2),z:c.z-Math.floor(a.size[2]/2),sx:a.size[0],sz:a.size[2]};
}
export function* assessGiantSite(c,dimension,{progress=()=>{},allowed=()=>true,survey=surveyGiant}={}){
 const fits=new Map(),reasons=[],cache=footprintSurveyCache(dimension);
 for(const id of FIT_ORDER){
  const a=ARENAS[id],box=giantStartingBox(c,id);
  if(!allowed(id,box)){reasons.push(`${a.display_name}: spacing`);continue;}
  let plan;
  try{plan=yield* survey({...c,id},dimension,message=>progress(`Checking ${a.display_name}: ${message}`),cache);}
  catch(error){return {outcome:'deferred',reason:`${a.display_name} assessment incomplete: ${error.message}`};}
  if(plan.outcome==='deferred')return {outcome:'deferred',reason:`${a.display_name} assessment incomplete: ${plan.reason}`};
  if(plan.outcome==='ready')fits.set(id,plan);else reasons.push(`${a.display_name}: ${plan.reason}`);
 }
 const id=chooseFittingGiant([...fits.keys()],c.selectionRoll??.5);
 if(!id)return {outcome:'unsuitable',reason:`Site must fit all three giants. ${reasons.join('; ')}`};
 return {...fits.get(id),id,fitting:[...fits.keys()]};
}
