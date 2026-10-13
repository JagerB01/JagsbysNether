export const SPACING=192;
export const RECORD_PREFIX='nether_settlements:village_location_';
export function candidateAt(gx,gz,seed) {
  let n=Math.imul(gx,374761393)^Math.imul(gz,668265263)^seed;
  n=Math.imul(n^(n>>>13),1274126177);
  const cellSeed=(n^(n>>>16))>>>0;let value=cellSeed;
  const rng=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  return {x:gx*SPACING+64+Math.floor(rng()*64),z:gz*SPACING+64+Math.floor(rng()*64),
    seed:cellSeed,key:`nether_settlements:villages_${gx}_${gz}`};
}
export function nearestRecorded(world,x,z) {
  let nearest;
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith(RECORD_PREFIX)) continue;
    let record;
    try {record=JSON.parse(world.getDynamicProperty(key));} catch {continue;}
    if (!record || ![record.x,record.y,record.z].every(Number.isFinite) || !(record.houses>=2)) continue;
    const distance=Math.hypot(record.x-x,record.z-z);
    if (!nearest || distance<nearest.distance) nearest={...record,distance};
  }
  return nearest;
}
export function nearestCandidate(world,x,z,seed) {
  const regionX=Math.floor(x/SPACING),regionZ=Math.floor(z/SPACING);let nearest;
  const sites=recordedSites(world);
  for (let gx=regionX-8;gx<=regionX+8;gx++) for (let gz=regionZ-8;gz<=regionZ+8;gz++) {
    const candidate=candidateAt(gx,gz,seed);
    if (world.getDynamicProperty(candidate.key) || !farEnough(world,candidate.x,candidate.z,sites)) continue;
    const distance=Math.hypot(candidate.x-x,candidate.z-z);
    if (!nearest || distance<nearest.distance) nearest={...candidate,distance};
  }
  return nearest;
}

export const MIN_VILLAGE_DISTANCE=256;
export function recordedSites(world) {
  const sites=[];
  for (const key of world.getDynamicPropertyIds()) {
    if (!key.startsWith(RECORD_PREFIX)) continue;
    try {
      const site=JSON.parse(world.getDynamicProperty(key));
      if (site && site.houses>=2 && [site.x,site.z].every(Number.isFinite)) sites.push(site);
    } catch {}
  }
  return sites;
}
export function farEnough(world,x,z,sites=recordedSites(world)) {
  return sites.every(site=>Math.hypot(site.x-x,site.z-z)>=
    MIN_VILLAGE_DISTANCE);
}
// Avoid placing a footprint directly over a player, without a spawn-distance band.
export const PLAYER_CLEARANCE=1;
export function outsidePlayerBuffer(players,box,clearance=PLAYER_CLEARANCE) {
  return players.filter(player=>player.dimension.id==='minecraft:nether').every(player=>{
    const x=Math.max(box.x,Math.min(player.location.x,box.x+box.sx-1));
    const z=Math.max(box.z,Math.min(player.location.z,box.z+box.sz-1));
    return Math.hypot(x-player.location.x,z-player.location.z)>=clearance;
  });
}
