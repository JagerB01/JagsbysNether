import {runGenerationJob,generationBusy} from '../generation_queue.js';
import {villageLandmarkClear,landmarkRecords} from '../landmark_sites.js';
import {planningCache} from './planning_cache.js';
import {rejectedSites} from './rejected_sites.js';
import {world,system,StructureRotation} from '@minecraft/server';
import {catalog,pools} from './catalog.js';
import {villageSize} from './sizing.js';
import {roadMaterial} from './road_material.js';
import {rankSites,siteOffsets} from './site_selection.js';
import {SPACING,RECORD_PREFIX,candidateAt,nearestRecorded,farEnough} from './navigation.js';
import {populate} from './population.js';
import {plantStructureCrops} from './village_crops.js';
import {accessibleSites} from './accessible_search.js';
import {distantCandidates,distantClear} from './distant_sites.js';
import {chunkLease} from '../chunk_loading.js';
const outsidePlayerBuffer=distantClear;
import {directions,read,replaceable,floorAt,rotate,rotateDirection,dimensions,overlap,
  planRoad,planRigid} from './terrain.js';

const ROTATIONS=[StructureRotation.None,StructureRotation.Rotate90,
  StructureRotation.Rotate180,StructureRotation.Rotate270];
let busy=false;
const cooldowns=new Map(),localCooldowns=new Map();
let nextRemoteAttempt=0;
let generationStatus='Waiting for a Nether player.';
function random(seed) {
  let value=seed>>>0;
  return () => {value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
function weightedOrder(entries,rng) {
  return entries.map(([id,weight])=>({id,key:-Math.log(Math.max(rng(),1e-9))/weight}))
    .sort((a,b)=>a.key-b.key).map(entry=>entry.id);
}
export function themeAt(dimension,x,y,z) {
  // Use the biome itself: decorative soul soil/warped blocks in Nether Wastes
  // must not turn an automatically generated village into the warped style.
  const biome=dimension.getBiome?.({x,y,z})?.id;
  if (['minecraft:hell','minecraft:nether_wastes','minecraft:crimson_forest'].includes(biome)) return 'crimson';
  if (['minecraft:warped_forest','minecraft:soulsand_valley','minecraft:soul_sand_valley'].includes(biome)) return 'warped';
  let warped=0,crimson=0;
  for (let dx=-8;dx<=8;dx+=4) for (let dz=-8;dz<=8;dz+=4) {
    for (let dy=-2;dy<=2;dy++) {
      const id=read(dimension,x+dx,y+dy,z+dz)?.typeId ?? '';
      if (id.includes('warped') || id==='minecraft:soul_sand' || id==='minecraft:soul_soil') warped++;
      if (id.includes('crimson')) crimson++;
    }
  }
  return warped>crimson ? 'warped' : 'crimson';
}
function connectors(piece,rotation,origin,baseY,roadPlan,skip) {
  return piece.connectors.filter(connector=>connector!==skip).map(connector=>{
    const [x,z]=rotate(connector.x,connector.z,piece.size,rotation);
    const wx=origin.x+x,wz=origin.z+z;
    const groundY=roadPlan?.heights.get(`${wx},${wz}`) ?? baseY;
    return {...connector,x:wx,y:groundY+connector.y,z:wz,
      dir:rotateDirection(connector.dir,rotation)};
  });
}
function* place(dimension,piece,rotation,origin,baseY,plan,automatic=false,inVillage=false) {
  const [sx,,sz]=dimensions(piece,rotation);
  function* guard(){
    if(!automatic)return;
    const deadline=system.currentTick+1200;
    while(!outsidePlayerBuffer(world.getPlayers(),{...origin,sx,sz})){
      if(system.currentTick>=deadline)throw Error('Village placement stopped after a player remained nearby for one minute.');
      yield {waitTicks:20};
    }
  }
  yield* guard();
  if (piece.kind==='road') {
    let operations=0;
    for (const cell of plan.cells) {
      if (operations%8===0) yield* guard();
      for (let y=cell.naturalY+1;y<cell.y;y++) {
        const support=read(dimension,cell.x,y,cell.z);
        if (!support) throw new Error('Terrain unloaded during road support placement.');
        support.setType('minecraft:blackstone');
      }
      const block=read(dimension,cell.x,cell.y,cell.z);
      if (!block) throw new Error('Terrain unloaded during road placement.');
      const below=read(dimension,cell.x,cell.y-1,cell.z);
      if (!below) throw new Error('Terrain unloaded below road placement.');
      if (replaceable(below) || below.isLiquid) below.setType('minecraft:blackstone');
      block.setType(roadMaterial(cell.x,cell.z));
      for (let dy=1;dy<=2;dy++) {
        const above=read(dimension,cell.x,cell.y+dy,cell.z);
        if (!above) throw new Error('Terrain unloaded during road placement.');
        if (!above.isAir) above.setType('minecraft:air');
      }
      if (++operations%8===0) yield;
    }
  } else {
    // Structures stay rigid; short foundations support small terrain differences.
    let operations=0;
    for (const support of plan.supports) {
      if (operations%16===0) yield* guard();
      const block=read(dimension,support.x,support.y,support.z);
      if (!block) throw new Error('Terrain unloaded during foundation placement.');
      block.setType('minecraft:blackstone');
      if (++operations%16===0) yield;
    }
    yield* guard();
    world.structureManager.place(piece.id,dimension,{...origin,y:baseY},
      {rotation:ROTATIONS[rotation],includeEntities:true,includeBlocks:true});
    yield* plantStructureCrops(dimension,piece,rotation,origin,baseY,inVillage);
    yield;
  }
}
export function* village(dimension,x,z,near,theme,seed,notify,regionKey,onComplete,options={}) {
  const planning=options.cache===false?dimension:planningCache(dimension);let playerBlocked=false;
  const landmarks=regionKey?landmarkRecords():[];
  const unsuitable=reason=>({outcome:planning.missing||playerBlocked?'deferred':'unsuitable',reason});
  const rng=random(seed),boxes=[],queue=[],layout=[];let houses=0,roads=0,buildings=0,farms=0;
  const size=villageSize(rng);
  try {
    const requestedTheme=theme;
    const candidates=yield* rankSites(planning,x,z,near,size.radius);
    if (!candidates.length) {notify?.('No open Nether floor found within 12 blocks (lava, unloaded terrain, or no three-block opening).');return unsuitable('No suitable floor');}
    let best;
    // Compare every surveyed site before writing anything to the world.
    for (const site of candidates) {
      if(regionKey && (!farEnough(world,site.x,site.z)||!outsidePlayerBuffer(world.getPlayers(),{x:site.x,z:site.z,sx:1,sz:1}))){playerBlocked=true;continue;}
      const siteTheme=requestedTheme || themeAt(planning,site.x,site.floor,site.z);
      const centerPool=`nether_settlements:villages/${siteTheme}/town_centers`;
      const usableCenters=pools[centerPool].filter(([id])=>
        catalog[id].connectors.some(connector=>pools[connector.pool]));
      for (const id of weightedOrder(usableCenters,rng)) {
        const piece=catalog[id],firstRotation=Math.floor(rng()*4);
        for (let step=0;step<4;step++) {
          const rotation=(firstRotation+step)%4,[sx,,sz]=dimensions(piece,rotation);
          const origin={x:site.x-Math.floor(sx/2),z:site.z-Math.floor(sz/2)};
          for (const shift of [0,1,-1,2,-2,3]) {
            const baseY=site.floor+shift;
            if(regionKey && (rejectedSites.blocksBox({...origin,sx,sz})||!villageLandmarkClear({...origin,sx,sz},landmarks))){playerBlocked=true;continue;}
            if (regionKey && !outsidePlayerBuffer(world.getPlayers(),{...origin,sx,sz})) {playerBlocked=true;continue;}
            const plan=yield* planRigid(planning,piece,rotation,origin,baseY);
            if (!plan) continue;
            const exits=connectors(piece,rotation,origin,baseY);
            let viableExits=0;
            for (const exit of exits) {
              if (!pools[exit.pool]) continue;
              const [dx,dz]=directions[exit.dir];
              const floor=floorAt(planning,exit.x+dx,exit.z+dz,exit.y-1,4,3);
              if (floor!==undefined && Math.abs(floor-(exit.y-1))<=1) viableExits++;
            }
            const score=site.score+viableExits*30-plan.supports.length*0.05-
              Math.abs(shift)*3-site.distance*0.1;
            if (!best || score>best.score) best={site,theme:siteTheme,piece,rotation,
              origin,baseY,plan,exits,sx,sz,score};
            break;
          }
        }
      }
      yield;
    }
    if (!best) {notify?.('No center fits the surveyed sites: lava, unloaded terrain, a solid ceiling, or a large cliff blocks placement.');return unsuitable('No center fits');}
    x=best.site.x;z=best.site.z;theme=best.theme;
    // The survey yields across ticks; verify the selected footprint is still usable.
    const verifiedPlan=yield* planRigid(dimension,best.piece,best.rotation,best.origin,best.baseY);
    if (!verifiedPlan) {notify?.('The selected site became blocked or unloaded. Try again closer to it.');return;}
    notify?.(`Selected a site with ${best.site.connected} connected terrain samples and ${best.site.buildingSpace} with building headroom.`);
    const center={piece:best.piece,rotation:best.rotation,origin:best.origin,baseY:best.baseY,plan:verifiedPlan};
    boxes.push({...best.origin,sx:best.sx,sz:best.sz});
    queue.push(...best.exits.map(c=>({...c,depth:1})));
    while (queue.length && (houses<size.houses||farms===0) && buildings<size.houses+3 && boxes.length<1+size.houses+3+size.roads) {
      // Attach nearby houses before extending more roads.
      queue.sort((a,b)=>(a.pool.endsWith('/houses')?0:1)-(b.pool.endsWith('/houses')?0:1));
      const parent=queue.shift();
      const wantsHouse=parent.pool.endsWith('/houses');
      if (parent.depth>size.depth+(wantsHouse?1:0)) continue;
      if (!wantsHouse && roads>=size.roads) continue;
      const [dx,dz]=directions[parent.dir];let attached=false;
      const entries=pools[parent.pool];if (!entries) continue;
      const ordered=weightedOrder(entries,rng);
      // Once three homes fit, try every farm candidate before other buildings
      // until one fits. Keep the normal weighted order within each category.
      if(wantsHouse && houses>=3 && farms===0)
        ordered.sort((a,b)=>Number(b.includes('_farm_'))-Number(a.includes('_farm_')));
      else if(wantsHouse && houses<6)
        ordered.sort((a,b)=>Number(catalog[a].countsAsHouse===false)-Number(catalog[b].countsAsHouse===false));
      if(!wantsHouse){
        const merit=id=>catalog[id].connectors.filter(c=>c.pool.endsWith('/houses')).length*3+
          catalog[id].connectors.filter(c=>c.pool.endsWith('/streets')).length;
        ordered.sort((a,b)=>merit(b)-merit(a));
      }
      for (const id of ordered) {
        const piece=catalog[id];
        // Secure real buildings first; amenities cannot establish a village alone.
        if (wantsHouse && houses<3 && piece.countsAsHouse===false) continue;
        if(wantsHouse && farms>=1 && id.includes('_farm_'))continue;
        if(wantsHouse && houses>=size.houses && piece.countsAsHouse!==false)continue;
        if(wantsHouse && piece.countsAsHouse===false && !id.includes('_farm_') && buildings-houses-farms>=2)continue;
        const offset=Math.floor(rng()*4);
        for (let step=0;step<4;step++) {
          const rotation=(step+offset)%4;
          for (const connector of piece.connectors) {
            if (connector.name!==parent.target) continue;
            const direction=rotateDirection(connector.dir,rotation);
            const [cx,cz]=directions[direction];if (cx!==-dx || cz!==-dz) continue;
            const [rx,rz]=rotate(connector.x,connector.z,piece.size,rotation);
            const origin={x:parent.x+dx-rx,z:parent.z+dz-rz};
            const [sx,,sz]=dimensions(piece,rotation),box={...origin,sx,sz};
            if (Math.max(Math.abs(origin.x-x),Math.abs(origin.z-z),
              Math.abs(origin.x+sx-1-x),Math.abs(origin.z+sz-1-z))>size.radius) continue;
            if (boxes.some(old=>overlap(old,box))) continue;
            if(regionKey && (rejectedSites.blocksBox(box)||!villageLandmarkClear(box,landmarks))){playerBlocked=true;continue;}
            if (regionKey && !outsidePlayerBuffer(world.getPlayers(),box)) {playerBlocked=true;continue;}
            const baseY=parent.y-connector.y;
            const plan=piece.kind==='road' ?
              yield* planRoad(planning,piece,rotation,origin,baseY,{x:parent.x+dx,z:parent.z+dz}) :
              yield* planRigid(planning,piece,rotation,origin,baseY);
            if (!plan) continue;
            layout.push({piece,rotation,origin,baseY,plan,entry:{x:parent.x+dx,z:parent.z+dz}});
            if(id.includes('_farm_'))farms++;
            boxes.push(box);if (piece.kind==='house') {buildings++;if (piece.countsAsHouse!==false) houses++;}else roads++;
            if (piece.kind==='road') queue.push(...connectors(piece,rotation,origin,baseY,plan,connector)
              .map(c=>({...c,depth:parent.depth+1})));
            attached=true;break;
          }
          if (attached) break;
        }
        if (attached) break;
      }
      yield;
    }
    if (houses<3) {
      notify?.(`Only ${houses} residential houses fit: at least 3 are required. Nothing was placed.`);
      return unsuitable(`Only ${houses} houses fit`);
    }
    const chosen=[...layout.filter(item=>item.piece.kind==='house'),
      ...layout.filter(item=>item.piece.kind==='road'),center];
    if (regionKey && chosen.some(item=>{
      const [sx,,sz]=dimensions(item.piece,item.rotation);
      return !outsidePlayerBuffer(world.getPlayers(),{...item.origin,sx,sz});
    })) return;
    // Recheck all selected pieces before the first write: surveys span multiple ticks.
    for (const item of chosen) {
      const plan=item.piece.kind==='road' ?
        yield* planRoad(dimension,item.piece,item.rotation,item.origin,item.baseY,item.entry) :
        yield* planRigid(dimension,item.piece,item.rotation,item.origin,item.baseY);
      if (!plan) {
        notify?.('The planned layout became blocked or unloaded. Nothing was placed.');
        return;
      }
      item.plan=plan;
    }
    // Place the center last so an interrupted job cannot leave an empty center.
    for (const item of chosen) yield* place(dimension,item.piece,item.rotation,item.origin,item.baseY,item.plan,!!regionKey,true);
    world.setDynamicProperty(`${RECORD_PREFIX}${x}_${z}`,JSON.stringify({
      x,y:best.baseY+1,z,theme,houses,roads,bounds:{
        x:Math.min(...boxes.map(b=>b.x)),z:Math.min(...boxes.map(b=>b.z)),
        sx:Math.max(...boxes.map(b=>b.x+b.sx))-Math.min(...boxes.map(b=>b.x)),
        sz:Math.max(...boxes.map(b=>b.z+b.sz))-Math.min(...boxes.map(b=>b.z))}}));
    if (regionKey) world.setDynamicProperty(regionKey,true);
    yield* populate(dimension,chosen,notify);
    notify?.(`${theme} ${size.name} terrain village: ${roads} road pieces, ${houses} houses, ${buildings-houses} amenities. Steep or blocked branches were skipped.`);
  } catch (error) {
    console.warn(`[Nether Settlements] ${error}`);
    notify?.(`Generation stopped: ${error}. Check the content log.`);
  } finally {if (onComplete) onComplete();else busy=false;}
}
function start(dimension,x,z,near,theme,seed,notify,regionKey) {
  if (busy) {notify?.('A village is already being assembled. Try again shortly.');return;}
  notify?.('Comparing nearby village sites, then assembling the best fit...');
  busy=true;runGenerationJob(village(dimension,x,z,near,theme,seed,notify,regionKey));
}

system.afterEvents.scriptEventReceive.subscribe(event=>{
  if (!['nether_settlements:test','nether_settlements:find','nether_settlements:status'].includes(event.id)) return;
  const player=event.sourceEntity;
  if (!player || player.typeId!=='minecraft:player') return;
  const notify=message=>player.sendMessage(`[Nether Settlements] ${message}`);
  if (player.dimension.id!=='minecraft:nether') {notify('Run this command in the Nether.');return;}
  if(event.id==='nether_settlements:status'){notify(`${busy?'Working':'Idle'}: ${generationStatus}`);return;}
  if (event.id==='nether_settlements:find') {
    const mode=event.message.trim().toLowerCase();
    if (!['','nearest','village','site'].includes(mode)) {notify('Use nearest, village, or site.');return;}
    const {x,z}=player.location;
    if (mode!=='site') {
      const found=nearestRecorded(world,x,z);
      if (found) {
        notify(`Nearest recorded ${found.theme} village: X ${found.x}, Y ${found.y}, Z ${found.z} (${Math.round(found.distance)} blocks horizontally; ${found.houses} houses).`);
        return;
      }
      notify('No villages recorded yet. Villages from older pack versions were not indexed.');
      if (mode==='village') return;
    }
    let seed=world.getDynamicProperty('nether_settlements:terrain_seed');
    if (typeof seed!=='number') {seed=Math.floor(Math.random()*2147483647);world.setDynamicProperty('nether_settlements:terrain_seed',seed);}
    const candidate=distantCandidates(world,world.getPlayers(),seed,cooldowns,system.currentTick)[0];
    if (!candidate) {notify('No unchecked village sites nearby. Explore farther into the Nether.');return;}
    notify(`Potential village site: X ${candidate.x}, Z ${candidate.z} (${Math.round(candidate.distance)} blocks horizontally).`);
    notify('These coordinates mark an unchecked region, not a confirmed village. Automatic generation surveys accessible terrain and chooses suitable sites.');
    return;
  }
  const theme=event.message.trim().toLowerCase();
  if (theme && !['crimson','warped'].includes(theme)) {notify('Use crimson or warped.');return;}
  const {x,y,z}=player.location;
  start(player.dimension,Math.floor(x),Math.floor(z),Math.floor(y)-1,theme,Date.now(),notify);
});

export function* automaticSearch(seed) {
  let lease;
  try {
    const players=world.getPlayers().filter(p=>p.dimension.id==='minecraft:nether' && p.location.y<120);
    if (!players.length) return;
    const dimension=players[0].dimension;
    // Preserve the existing terrain-ranked local survey; extend it with remote
    // region candidates when the loaded neighborhood has no eligible good site.
    const local=yield* accessibleSites(dimension,players,world,seed,localCooldowns,system.currentTick);
    const nearby=local.map(site=>{const region=candidateAt(Math.floor(site.x/SPACING),Math.floor(site.z/SPACING),seed);return {...region,...site};})
      .filter(site=>(cooldowns.get(site.key)??0)<=system.currentTick).slice(0,8);
    const remote=distantCandidates(world,players,seed,cooldowns,system.currentTick).filter(c=>!nearby.some(s=>s.key===c.key)).slice(0,2);
    const candidates=[...nearby,...remote];
    if(!candidates.length){generationStatus='No unchecked eligible sites; explore farther.';return;}
    for(const candidate of candidates){
      if(rejectedSites.blocksPoint(candidate.x,candidate.z))continue;
      const cell=`${Math.floor(candidate.x/24)},${Math.floor(candidate.z/24)}`;
      localCooldowns.set(cell,system.currentTick+1200);
      lease=chunkLease(dimension,'village');
      try{
        generationStatus=`Loading site ${candidate.x}, ${candidate.z}.`;
        yield* lease.load({x:candidate.x-72,y:0,z:candidate.z-72},[145,128,145]);
        // The loaded survey can contain a player; only actual planned building
        // footprints are excluded. Do not reject the entire 113-block square.
        const near=candidate.floor??64;
        generationStatus=`Planning site ${candidate.x}, ${candidate.z}.`;
        const result=yield* village(dimension,candidate.x,candidate.z,near,'',candidate.seed,
          message=>{generationStatus=message;},candidate.key,()=>{});
        if(world.getDynamicProperty(candidate.key))return;
        if(result?.outcome==='unsuitable')rejectedSites.reject({x:candidate.x-72,z:candidate.z-72,sx:145,sz:145},result.reason);
        if(candidate.floor===undefined)cooldowns.set(candidate.key,system.currentTick+2400);
      }catch(error){generationStatus=`Site failed: ${error.message}`;console.warn(`[Nether Settlements] ${generationStatus}`);}
      finally{lease.release();lease=undefined;}
      yield;
    }
  } catch (error) {
    generationStatus=`Search failed: ${error.message}`;console.warn(`[Nether Settlements] ${generationStatus}`);
  } finally {
    try{lease?.release();}catch(error){console.warn(`[Nether Settlements] Temporary area cleanup failed: ${error}`);}
    busy=false;
  }
}
system.runInterval(()=>{
  if (busy || generationBusy()) return;
  for(const map of [cooldowns,localCooldowns])for(const [key,until] of map)if(until<=system.currentTick)map.delete(key);
  if (!world.getPlayers().some(p=>p.dimension.id==='minecraft:nether' && p.location.y<120)) return;
  let seed=world.getDynamicProperty('nether_settlements:terrain_seed');
  if (typeof seed!=='number') {seed=Math.floor(Math.random()*2147483647);world.setDynamicProperty('nether_settlements:terrain_seed',seed);}
  if(system.currentTick<nextRemoteAttempt)return;
  nextRemoteAttempt=system.currentTick+100;
  busy=true;runGenerationJob(automaticSearch(seed));
},100);
