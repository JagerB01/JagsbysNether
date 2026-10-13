// Pure geometry and bounded cave-floor sampling, shared with the offline tests.
export const directions = {2:[0,-1], 3:[0,1], 4:[-1,0], 5:[1,0]};
const ground = new Set(['minecraft:netherrack','minecraft:crimson_nylium',
  'minecraft:warped_nylium','minecraft:soul_sand','minecraft:soul_soil',
  'minecraft:basalt','minecraft:smooth_basalt','minecraft:blackstone','minecraft:gravel',
  'minecraft:quartz_ore','minecraft:nether_gold_ore']);
const plants = new Set(['minecraft:crimson_roots','minecraft:warped_roots',
  'minecraft:nether_sprouts','minecraft:crimson_fungus','minecraft:warped_fungus',
  'minecraft:twisting_vines','minecraft:weeping_vines','minecraft:fire','minecraft:soul_fire',
  'minecraft:crimson_stem','minecraft:warped_stem','minecraft:nether_wart_block',
  'minecraft:warped_wart_block','minecraft:shroomlight']);
export function replaceable(block) {
  return !!block && (block.isAir || plants.has(block.typeId));
}
export function read(dimension,x,y,z) {
  try { return dimension.getBlock({x,y,z}); } catch { return undefined; }
}
export function floorAt(dimension,x,z,near,range=4,clearance=3) {
  const memo=dimension.floorMemo,key=`${x},${z},${near},${range},${clearance}`;
  if(memo?.has(key))return memo.get(key);
  const remember=value=>{if(memo){if(memo.size>=60000)memo.delete(memo.keys().next().value);memo.set(key,value);}return value;};
  // Scan near the connected floor, never from the dimension's roof downward.
  for (let distance=0; distance<=range; distance++) {
    for (const y of distance ? [near-distance,near+distance] : [near]) {
      if (y<33 || y+clearance>119) continue;
      const base=read(dimension,x,y,z);
      if (!base || !ground.has(base.typeId)) continue;
      let clear=true;
      for (let dy=1;dy<=clearance;dy++) {
        if (!replaceable(read(dimension,x,y+dy,z))) {clear=false;break;}
      }
      if (clear) return remember(y);
    }
  }
  return remember(undefined);
}
export function rotate(x,z,size,rotation) {
  const [sx,,sz]=size;
  if (rotation===1) return [sz-1-z,x];
  if (rotation===2) return [sx-1-x,sz-1-z];
  if (rotation===3) return [z,sx-1-x];
  return [x,z];
}
export function rotateDirection(direction,rotation) {
  const order=[2,5,3,4];
  return order[(order.indexOf(direction)+rotation)%4];
}
export function dimensions(piece,rotation) {
  return rotation%2 ? [piece.size[2],piece.size[1],piece.size[0]] : piece.size;
}
export function overlap(a,b) {
  return a.x<=b.x+b.sx-1 && a.x+a.sx-1>=b.x &&
    a.z<=b.z+b.sz-1 && a.z+a.sz-1>=b.z;
}
export function* planRoad(dimension,piece,rotation,origin,near,incoming) {
  const cells=[],heights=new Map();let operations=0;
  for (const [x,z,type] of piece.floor) {
    const [rx,rz]=rotate(x,z,piece.size,rotation);
    const wx=origin.x+rx,wz=origin.z+rz;
    const y=floorAt(dimension,wx,wz,near,8,2);
    if (y===undefined) return undefined;
    heights.set(`${wx},${wz}`,y);cells.push({x:wx,y,z:wz,type});
    if (++operations%8===0) yield;
  }
  // Raise small dips by up to two blocks to turn uneven ground into walkable steps.
  const naturalHeights=new Map(heights);
  let changed=true;
  while (changed) {
    changed=false;
    for (const cell of cells) {
      for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const other=heights.get(`${cell.x+dx},${cell.z+dz}`);
        if (other!==undefined && other-cell.y>1) {
          const y=other-1;
          if (y-naturalHeights.get(`${cell.x},${cell.z}`)>2) return undefined;
          for (let level=cell.y+1;level<=y+2;level++) {
            if (!replaceable(read(dimension,cell.x,level,cell.z))) return undefined;
          }
          cell.y=y;heights.set(`${cell.x},${cell.z}`,y);changed=true;
        }
      }
    }
    yield;
  }
  for (const cell of cells) cell.naturalY=naturalHeights.get(`${cell.x},${cell.z}`);
  // Every shared road edge is walkable: a step can change by at most one block.
  for (const cell of cells) {
    for (const [dx,dz] of [[1,0],[0,1]]) {
      const other=heights.get(`${cell.x+dx},${cell.z+dz}`);
      if (other!==undefined && Math.abs(other-cell.y)>1) return undefined;
    }
  }
  if (incoming) {
    const y=heights.get(`${incoming.x},${incoming.z}`);
    if (y===undefined || Math.abs(y-near)>1) return undefined;
  }
  return {cells,heights};
}
export function* planRigid(dimension,piece,rotation,origin,baseY) {
  const [sx,sy,sz]=dimensions(piece,rotation);const supports=[];
  const footprint=new Set(piece.footprint.map(([x,z])=>rotate(x,z,piece.size,rotation).join(',')));
  let operations=0;
  // Support actual structure columns; empty template margins need no foundation.
  // Allow two blocks of excavation through natural ground, with ceilings protected.
  for (let x=0;x<sx;x++) for (let z=0;z<sz;z++) {
    const wx=origin.x+x,wz=origin.z+z;
    const needsSupport=footprint.has(`${x},${z}`);
    const floor=needsSupport ? floorAt(dimension,wx,wz,baseY,8,2) : undefined;
    if (needsSupport && (floor===undefined || floor>baseY+2 || baseY-floor>8)) return undefined;
    const bottom=read(dimension,wx,baseY,wz);
    if (!bottom || (!replaceable(bottom) && !ground.has(bottom.typeId))) return undefined;
    for (let y=baseY+1;y<baseY+sy;y++) {
      const block=read(dimension,wx,y,wz);
      if (!replaceable(block) && !(y<=baseY+2 && block && ground.has(block.typeId))) return undefined;
    }
    if (needsSupport) {
      for (let y=floor+1;y<baseY;y++) {
        if (!replaceable(read(dimension,wx,y,wz))) return undefined;
        supports.push({x:wx,y,z:wz});
      }
    }
    if (++operations%8===0) yield;
  }
  return {supports};
}
