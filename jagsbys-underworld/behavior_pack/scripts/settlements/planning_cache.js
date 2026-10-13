// Snapshots are confined to one layout plan. Placement rechecks real blocks.
export function planningCache(dimension,limit=60000){
 const blocks=new Map(),floors=new Map();let missing=false,reads=0,hits=0;
 const proxy={id:dimension.id,heightRange:dimension.heightRange,floorMemo:floors,
  getBiome:dimension.getBiome?.bind(dimension),
  getBlock(p){
   const key=`${p.x},${p.y},${p.z}`;
   if(blocks.has(key)){hits++;return blocks.get(key);}
   reads++;let block;
   try{block=dimension.getBlock(p);}catch{}
   if(!block){const h=dimension.heightRange;if(!h||(p.y>=h.min&&p.y<h.max))missing=true;return undefined;}
   let snapshot;try{snapshot={typeId:block.typeId,isAir:block.isAir,isLiquid:block.isLiquid,location:{...p}};}catch{missing=true;return undefined;}
   if(blocks.size>=limit)blocks.delete(blocks.keys().next().value);
   blocks.set(key,snapshot);return snapshot;
  },
  get missing(){return missing;},get stats(){return {reads,hits,cached:blocks.size};}
 };
 return proxy;
}
