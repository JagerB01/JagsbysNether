import {world} from '@minecraft/server';
const PREFIX='nether_settlements:rejected_area_';
const overlap=(a,b)=>a.x<=b.x+b.sx-1&&a.x+a.sx-1>=b.x&&a.z<=b.z+b.sz-1&&a.z+a.sz-1>=b.z;
const cells=box=>{const out=[];for(let x=Math.floor(box.x/256);x<=Math.floor((box.x+box.sx-1)/256);x++)for(let z=Math.floor(box.z/256);z<=Math.floor((box.z+box.sz-1)/256);z++)out.push(`${x},${z}`);return out;};
export class RejectedSites{
 constructor(storage){this.storage=storage;this.loaded=false;this.index=new Map();}
 add(box){for(const cell of cells(box)){if(!this.index.has(cell))this.index.set(cell,[]);this.index.get(cell).push(box);}}
 load(){if(this.loaded)return;this.loaded=true;for(const key of this.storage.getDynamicPropertyIds()){
  if(!key.startsWith(PREFIX))continue;
  try{const b=JSON.parse(this.storage.getDynamicProperty(key));if([b.x,b.z,b.sx,b.sz].every(Number.isFinite)&&b.sx>0&&b.sz>0)this.add(b);}catch{}
 }}
 blocksBox(box){this.load();return cells(box).some(cell=>(this.index.get(cell)??[]).some(b=>overlap(box,b)));}
 blocksPoint(x,z){return this.blocksBox({x,z,sx:1,sz:1});}
 reject(box,reason){this.load();const key=`${PREFIX}${box.x}_${box.z}`;
  if(this.storage.getDynamicProperty(key))return;
  const value={...box,reason};this.storage.setDynamicProperty(key,JSON.stringify(value));this.add(value);
 }
}
export const rejectedSites=new RejectedSites(world);
