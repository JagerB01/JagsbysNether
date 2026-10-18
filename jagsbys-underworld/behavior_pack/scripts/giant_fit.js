import {surveyModularFortress,modularCoreBox} from './modular_fortress.js';
import {ARENAS} from './arena_catalog.js';
import {surveyLandmark} from './landmark_terrain.js';
export const GIANT_WEIGHTS={large_arena:1,dragon_arena:1,mega_fortress:1};
export const FIT_ORDER=['dragon_arena','large_arena','mega_fortress'];
export function chooseFittingGiant(ids,roll,forcedId){
 if(!FIT_ORDER.every(id=>ids.includes(id)))return undefined;
 if(FIT_ORDER.includes(forcedId))return forcedId;
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
export function* assessGiantSite(c,dimension,{progress=()=>{},allowed=()=>true,survey=surveyGiant,forcedId}={}){
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
 const id=chooseFittingGiant([...fits.keys()],c.selectionRoll??.5,typeof forcedId==='function'?forcedId():forcedId);
 if(!id)return {outcome:'unsuitable',reason:`Site must fit all three giants. ${reasons.join('; ')}`};
 return {...fits.get(id),id,fitting:[...fits.keys()],plans:Object.fromEntries(fits)};
}

// Compare at most three shortlisted positions; never search indefinitely for perfection.
export function* compareGiantSites(candidates,dimension,{assess=assessGiantSite,allowed=()=>true,progress=()=>{},onResult=()=>{},forcedId,canContinue=()=>true}={}){
 let best;
 for(const c of candidates.slice(0,3)){
  if(!canContinue())return {outcome:'paused'};
  progress(`Comparing giant site ${c.x}, ${c.z}`);
  const plan=yield* assess({...c,compareQuality:true},dimension,{progress,allowed:(id,box)=>allowed(c,id,box)});
  onResult(c,plan);
  if(plan.outcome!=='ready')continue;
  const plans=Object.values(plan.plans??{[plan.id]:plan});
  const score=plans.reduce((sum,p)=>sum+(p.coverage??1)-(p.carveFraction??0),0)/plans.length;
  if(!best||score>best.score)best={candidate:c,plan,score};
 }
 if(!canContinue())return {outcome:'paused'};
 if(!best)return {outcome:'no_ready_site'};
 const id=chooseFittingGiant(best.plan.fitting,best.candidate.selectionRoll??.5,typeof forcedId==='function'?forcedId():forcedId);
 return {outcome:'ready',candidate:{...best.candidate,id,selected:true},plan:{...(best.plan.plans?.[id]??best.plan),id,fitting:best.plan.fitting},score:best.score};
}
