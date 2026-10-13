import {world} from '@minecraft/server';
const PREFIX='underworld_terrain:ocean_';
// Shared observations are hints, never authorization to place a structure.
// Positive ocean observations survive restart; unloaded reads are never recorded.
export class TerrainSurvey {
 constructor(storage=world){this.storage=storage;this.tiles=new Map();this.probed=new Set();this.dirty=new Set();}
 tile(tx,tz){
  const key=`${tx}_${tz}`;
  if(!this.tiles.has(key)){
   let points;try{points=JSON.parse(this.storage.getDynamicProperty(PREFIX+key)??'[]');}catch{points=[];}
   this.tiles.set(key,new Map(points.filter(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)).map(p=>[`${Math.floor(p[0]/16)},${Math.floor(p[1]/16)}`,p])));
  }
  return this.tiles.get(key);
 }
 ocean(x,z,y){
  const tx=Math.floor(x/128),tz=Math.floor(z/128),key=`${tx}_${tz}`,points=this.tile(tx,tz);
  // One hint per 16-block column. The full footprint is always checked live.
  const cell=`${Math.floor(x/16)},${Math.floor(z/16)}`;
  points.set(cell,[x,z,y]);this.dirty.add(key);
 }
 observeLoadedColumn(d,x,z){
  if(d.id!=='minecraft:nether')return;
  const key=`${x},${z}`;if(this.probed.has(key))return;
  try{
   const base=d.getBlock({x,y:31,z}),above=d.getBlock({x,y:32,z});
   if(!base||!above)return;
   if(this.probed.size>=65536)this.probed.delete(this.probed.values().next().value);
   this.probed.add(key);
   if(['minecraft:lava','minecraft:flowing_lava'].includes(base.typeId)&&above.typeId==='minecraft:air')this.ocean(x,z,31);
  }catch{}
 }
 nearby(online,range=768){
  const keys=new Set(),points=[];
  for(const p of online){
   for(let tx=Math.floor((p.location.x-range)/128);tx<=Math.floor((p.location.x+range)/128);tx++)
   for(let tz=Math.floor((p.location.z-range)/128);tz<=Math.floor((p.location.z+range)/128);tz++){
    const key=`${tx}_${tz}`;if(keys.has(key))continue;keys.add(key);
    for(const point of this.tile(tx,tz).values())if(online.some(p=>Math.hypot(point[0]-p.location.x,point[1]-p.location.z)<=range))points.push(point);
   }
  }
  return points;
 }
 flush(){
  for(const key of this.dirty)this.storage.setDynamicProperty(PREFIX+key,JSON.stringify([...this.tiles.get(key).values()]));
  this.dirty.clear();
  // Bound memory after exploration; persisted tiles can be reloaded later.
  while(this.tiles.size>512)this.tiles.delete(this.tiles.keys().next().value);
 }
}
export const terrainSurvey=new TerrainSurvey();
// Reuse village's already-loaded survey footprint, including distant temporary
// areas that are not connected to the player's currently loaded neighborhood.
export function* observeLoadedArea(d,from,size){
 let count=0;
 for(let x=Math.floor(from.x/16)*16+8;x<from.x+size[0];x+=16)
 for(let z=Math.floor(from.z/16)*16+8;z<from.z+size[2];z+=16){
  terrainSurvey.observeLoadedColumn(d,Math.max(x,from.x),Math.max(z,from.z));
  if(++count%8===0)yield;
 }
 terrainSurvey.flush();
}
