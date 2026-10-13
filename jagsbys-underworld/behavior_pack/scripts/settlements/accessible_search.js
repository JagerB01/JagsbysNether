import {rejectedSites} from './rejected_sites.js';
import {read,floorAt,replaceable} from './terrain.js';
import {SPACING,candidateAt,farEnough,recordedSites,outsidePlayerBuffer} from './navigation.js';
// Preliminary rankings describe original terrain, not live placement validity.
// Bound retained surveys; full plans and placement still inspect live blocks.
const surveys = new Map();
const SURVEY_LIMIT = 8192;
// Yield regularly while following accessible neighboring chunks; no distance radius is assumed.
export function* accessibleSites(dimension,players,world,seed,cooldowns,tick) {
  const queue=[],visited=new Set(),sites=[];
  const recorded=recordedSites(world);
  const regions=new Map();
  function eligibleRegion(x,z) {
    const gx=Math.floor(x/SPACING),gz=Math.floor(z/SPACING),key=`${gx},${gz}`;
    if (!regions.has(key)) regions.set(key,!world.getDynamicProperty(candidateAt(gx,gz,seed).key));
    return regions.get(key);
  }
  function loaded(x,y,z) {
    // Current engines provide a chunk-only probe; older stable APIs use one block read.
    if (typeof dimension.isChunkLoaded==='function') {
      try {return dimension.isChunkLoaded({x,y,z});} catch {return false;}
    }
    const block=read(dimension,x,y,z);
    try {return !!block && typeof block.typeId==='string';} catch {return false;}
  }
  function enqueue(cx,cz,near) {
    const key=`${cx},${cz}`;if(visited.has(key)) return;
    visited.add(key);queue.push({cx,cz,near});
  }
  for(const p of players)enqueue(Math.floor(p.location.x/16),Math.floor(p.location.z/16),Math.max(33,Math.min(118,Math.floor(p.location.y)-1)));
  let checked=0;
  for(let i=0;i<queue.length;i++) {
    const {cx,cz,near}=queue[i],x=cx*16+8,z=cz*16+8;
    const cell=`${Math.floor(x/24)},${Math.floor(z/24)}`;
    // Check all inexpensive exclusions before touching terrain for a site survey.
    const eligible=!rejectedSites.blocksPoint(x,z) && eligibleRegion(x,z) && !cooldowns.has(cell) &&
      farEnough(world,x,z,recorded) && outsidePlayerBuffer(players,{x,z,sx:1,sz:1});
    const accessible=loaded(x,near,z);
    if(accessible) {
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])enqueue(cx+dx,cz+dz,near);
      if(eligible) {
        const surveyKey=`${dimension.id}:${x},${z},${near}`;
        const cached=surveys.get(surveyKey);
        if(cached){sites.push({...cached});if(++checked%4===0)yield;continue;}
        const floor=floorAt(dimension,x,z,near,77,3);
        if(floor!==undefined) {
          let space=0,headroom=0,slope=0;
          // Cheap initial terrain ranking; shortlisted sites get the full connected-floor survey.
          for(const dx of [-8,0,8])for(const dz of [-8,0,8]) {
            const y=floorAt(dimension,x+dx,z+dz,floor,8,3);
            if(y===undefined)continue;
            space++;slope+=Math.abs(y-floor);
            if([4,5,6,7,8].every(dy=>replaceable(read(dimension,x+dx,y+dy,z+dz))))headroom++;
          }
          
          const site={x,z,floor,score:space*4+headroom*6-slope*.5};
          if(surveys.size>=SURVEY_LIMIT)surveys.delete(surveys.keys().next().value);
          surveys.set(surveyKey,site);
          sites.push({...site});
        }
      }
    }
    if(++checked%4===0)yield;
  }
  // Terrain quality alone determines the shortlist; player distance is not scored.
  sites.sort((a,b)=>b.score-a.score || a.x-b.x || a.z-b.z);
  return sites;
}
