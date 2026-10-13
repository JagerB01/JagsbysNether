import {assessSite,rankSites} from './site_selection.js';
import {planningCache} from './planning_cache.js';
const surveys=new Map();
export const COMPARISON_LIMIT=6;
export function comparisonCandidates(nearby,remote){
 const chosen=[],keys=new Set();
 function add(c){if(c&&!keys.has(c.key)&&chosen.length<COMPARISON_LIMIT){keys.add(c.key);chosen.push(c);}}
 // Two strong loaded areas, then samples throughout the permitted search range.
 for(const c of nearby){add(c);if(chosen.length===2)break;}
 for(const [min,max] of [[0,192],[192,384],[384,576],[576,769]])add(remote.find(c=>!keys.has(c.key)&&c.distance>=min&&c.distance<max));
 for(const c of remote)add(c);
 for(const c of nearby)add(c);
 return chosen;
}
function tie(seed){let n=seed>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;}
export function rankComparedSites(sites){return [...sites].sort((a,b)=>b.assessment.score-a.assessment.score||b.assessment.buildingSpace-a.assessment.buildingSpace||tie(a.seed)-tie(b.seed)||a.x-b.x||a.z-b.z);}
export function cachedVillageAssessment(candidate){return surveys.get(`${candidate.key}:${candidate.x},${candidate.z}`);}
export function* compareVillageSite(dimension,candidate){
 const key=`${candidate.key}:${candidate.x},${candidate.z}`;
 if(surveys.has(key))return {outcome:'ready',assessment:surveys.get(key)};
 const planning=planningCache(dimension),near=candidate.floor??64;
 let assessment=yield* assessSite(planning,candidate.x,candidate.z,near,48);
 if(!assessment){const alternatives=yield* rankSites(planning,candidate.x,candidate.z,near,48);assessment=alternatives[0];}
 if(planning.missing)return {outcome:'deferred',reason:'Comparison terrain incomplete'};
 if(!assessment)return {outcome:'unsuitable',reason:'No connected floor in the fully loaded comparison area'};
 if(surveys.size>=512)surveys.delete(surveys.keys().next().value);surveys.set(key,assessment);
 return {outcome:'ready',assessment};
}
