import {world,system,StructureRotation} from '@minecraft/server';
import {catalog,pools} from './catalog.js';
import {villageSize} from './sizing.js';
import {roadMaterial} from './road_material.js';
import {rankSites,siteOffsets} from './site_selection.js';
import {SPACING,RECORD_PREFIX,candidateAt,nearestRecorded,nearestCandidate,farEnough,outsidePlayerBuffer} from './navigation.js';
import {populate} from './population.js';
import {plantStructureCrops} from './village_crops.js';
import {accessibleSites} from './accessible_search.js';
import {directions,read,replaceable,floorAt,rotate,rotateDirection,dimensions,overlap,
  planRoad,planRigid} from './terrain.js';

const ROTATIONS=[StructureRotation.None,StructureRotation.Rotate90,
  StructureRotation.Rotate180,StructureRotation.Rotate270];
let busy=false;
let scanTick=0;
const cooldowns=new Map();
function random(seed) {
  let value=seed>>>0;
  return () => {value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
function weightedOrder(entries,rng) {
  return entries.map(([id,weight])=>({id,key:-Math.log(Math.max(rng(),1e-9))/weight}))
    .sort((a,b)=>a.key-b.key).map(entry=>entry.id);
}
function themeAt(dimension,x,y,z) {
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
  const guard=()=>{
    if (automatic && !outsidePlayerBuffer(world.getPlayers(),{...origin,sx,sz}))
      throw new Error('Placement paused because a player approached the planned building. The region remains eligible.');
  };
  guard();
  if (piece.kind==='road') {
    let operations=0;
    for (const cell of plan.cells) {
      if (operations%8===0) guard();
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
      if (operations%16===0) guard();
      const block=read(dimension,support.x,support.y,support.z);
      if (!block) throw new Error('Terrain unloaded during foundation placement.');
      block.setType('minecraft:blackstone');
      if (++operations%16===0) yield;
    }
    guard();
    world.structureManager.place(piece.id,dimension,{...origin,y:baseY},
      {rotation:ROTATIONS[rotation],includeEntities:true,includeBlocks:true});
    yield* plantStructureCrops(dimension,piece,rotation,origin,baseY,inVillage);
    yield;
  }
}
function* village(dimension,x,z,near,theme,seed,notify,regionKey,onComplete) {
  const rng=random(seed),boxes=[],queue=[],layout=[];let houses=0,roads=0,buildings=0;
  const size=villageSize(rng);
  try {
    const requestedTheme=theme;
    const candidates=yield* rankSites(dimension,x,z,near,size.radius);
    if (!candidates.length) {notify?.('No open Nether floor found within 12 blocks (lava, unloaded terrain, or no three-block opening).');return;}
    let best;
    // Compare every surveyed site before writing anything to the world.
    for (const site of candidates) {
      if (regionKey && (!farEnough(world,site.x,site.z) || !outsidePlayerBuffer(world.getPlayers(),{x:site.x,z:site.z,sx:1,sz:1}))) continue;
      const siteTheme=requestedTheme || themeAt(dimension,site.x,site.floor,site.z);
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
            if (regionKey && !outsidePlayerBuffer(world.getPlayers(),{...origin,sx,sz})) continue;
            const plan=yield* planRigid(dimension,piece,rotation,origin,baseY);
            if (!plan) continue;
            const exits=connectors(piece,rotation,origin,baseY);
            let viableExits=0;
            for (const exit of exits) {
              if (!pools[exit.pool]) continue;
              const [dx,dz]=directions[exit.dir];
              const floor=floorAt(dimension,exit.x+dx,exit.z+dz,exit.y-1,4,3);
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
    if (!best) {notify?.('No center fits the surveyed sites: lava, unloaded terrain, a solid ceiling, or a large cliff blocks placement.');return;}
    x=best.site.x;z=best.site.z;theme=best.theme;
    // The survey yields across ticks; verify the selected footprint is still usable.
    const verifiedPlan=yield* planRigid(dimension,best.piece,best.rotation,best.origin,best.baseY);
    if (!verifiedPlan) {notify?.('The selected site became blocked or unloaded. Try again closer to it.');return;}
    notify?.(`Selected a site with ${best.site.connected} connected terrain samples and ${best.site.buildingSpace} with building headroom.`);
    const center={piece:best.piece,rotation:best.rotation,origin:best.origin,baseY:best.baseY,plan:verifiedPlan};
    boxes.push({...best.origin,sx:best.sx,sz:best.sz});
    queue.push(...best.exits.map(c=>({...c,depth:1})));
    while (queue.length && buildings<size.houses && boxes.length<1+size.houses+size.roads) {
      // Attach nearby houses before extending more roads.
      queue.sort((a,b)=>(a.pool.endsWith('/houses')?0:1)-(b.pool.endsWith('/houses')?0:1));
      const parent=queue.shift();
      const wantsHouse=parent.pool.endsWith('/houses');
      if (parent.depth>size.depth+(wantsHouse?1:0)) continue;
      if (!wantsHouse && roads>=size.roads) continue;
      const [dx,dz]=directions[parent.dir];let attached=false;
      const entries=pools[parent.pool];if (!entries) continue;
      for (const id of weightedOrder(entries,rng)) {
        const piece=catalog[id];
        // Secure real buildings first; amenities cannot establish a village alone.
        if (wantsHouse && houses<2 && piece.countsAsHouse===false) continue;
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
            if (regionKey && !outsidePlayerBuffer(world.getPlayers(),box)) continue;
            const baseY=parent.y-connector.y;
            const plan=piece.kind==='road' ?
              yield* planRoad(dimension,piece,rotation,origin,baseY,{x:parent.x+dx,z:parent.z+dz}) :
              yield* planRigid(dimension,piece,rotation,origin,baseY);
            if (!plan) continue;
            layout.push({piece,rotation,origin,baseY,plan,entry:{x:parent.x+dx,z:parent.z+dz}});
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
    if (houses===0) {
      notify?.('No houses fit: nothing was placed, and this region remains eligible.');
      return;
    }
    const standalone=houses===1;
    const chosen=standalone ? layout.filter(item=>item.piece.kind==='house' && item.piece.countsAsHouse!==false) :
      [...layout.filter(item=>item.piece.kind==='house'),
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
    for (const item of chosen) yield* place(dimension,item.piece,item.rotation,item.origin,item.baseY,item.plan,!!regionKey,!standalone);
    if (standalone) {
      yield* populate(dimension,chosen,notify);
      notify?.('One house fits: placed a standalone house, with no center or roads. It does not count toward village spacing.');
      return;
    }
    world.setDynamicProperty(`${RECORD_PREFIX}${x}_${z}`,JSON.stringify({
      x,y:best.baseY+1,z,theme,houses,roads}));
    if (regionKey && houses>=2) world.setDynamicProperty(regionKey,true);
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
  busy=true;system.runJob(village(dimension,x,z,near,theme,seed,notify,regionKey));
}

system.afterEvents.scriptEventReceive.subscribe(event=>{
  if (!['nether_settlements:test','nether_settlements:find'].includes(event.id)) return;
  const player=event.sourceEntity;
  if (!player || player.typeId!=='minecraft:player') return;
  const notify=message=>player.sendMessage(`[Nether Settlements] ${message}`);
  if (player.dimension.id!=='minecraft:nether') {notify('Run this command in the Nether.');return;}
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
    const candidate=nearestCandidate(world,x,z,seed);
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

function* automaticSearch(seed) {
  try {
    const players=world.getPlayers().filter(p=>p.dimension.id==='minecraft:nether' && p.location.y<120);
    if (!players.length) return;
    const dimension=players[0].dimension;
    const sites=yield* accessibleSites(dimension,players,world,seed,cooldowns,scanTick);
    // Survey all reachable chunks first, then try the most promising terrain.
    // Failed layouts do not prevent another surveyed site from being considered.
    for (const site of sites.slice(0,8)) {
      if (!outsidePlayerBuffer(world.getPlayers(),{x:site.x,z:site.z,sx:1,sz:1}) || !farEnough(world,site.x,site.z)) continue;
      const candidate=candidateAt(Math.floor(site.x/SPACING),Math.floor(site.z/SPACING),seed);
      if (world.getDynamicProperty(candidate.key)) continue;
      const cell=`${Math.floor(site.x/24)},${Math.floor(site.z/24)}`;
      cooldowns.set(cell,scanTick+120);
      yield* village(dimension,site.x,site.z,site.floor,'',candidate.seed,undefined,candidate.key,()=>{});
      if (world.getDynamicProperty(candidate.key)) return;
      yield;
    }
  } catch (error) {
    console.warn(`[Nether Settlements] Accessible-terrain search stopped: ${error}`);
  } finally {busy=false;}
}
system.runInterval(()=>{
  scanTick++;
  if (busy) return;
  for (const [key,until] of cooldowns) if (until<=scanTick) cooldowns.delete(key);
  if (!world.getPlayers().some(p=>p.dimension.id==='minecraft:nether' && p.location.y<120)) return;
  let seed=world.getDynamicProperty('nether_settlements:terrain_seed');
  if (typeof seed!=='number') {seed=Math.floor(Math.random()*2147483647);world.setDynamicProperty('nether_settlements:terrain_seed',seed);}
  busy=true;system.runJob(automaticSearch(seed));
},100);
