// Bounded local floor searches work inside multi-level Nether structures.
// Never scan to the Nether roof or load chunks to complete a combat ability.
export function readBlock(d,p){try{return d.getBlock({x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)});}catch{return undefined;}}
export function solidFloor(block){return !!block&&!block.isAir&&!block.isLiquid&&(block.isSolid!==false||/(glass|slab|stairs|brick|stone|deepslate|obsidian|planks)/.test(block.typeId))&&!['minecraft:fire','minecraft:soul_fire','minecraft:lava','minecraft:flowing_lava','minecraft:water','minecraft:flowing_water'].includes(block.typeId);}
export function landingAt(d,x,z,y,{height=3,halfWidth=.4,maxDrop=3,maxRise=1}={}){
 x=Math.floor(x)+.5;z=Math.floor(z)+.5;y=Math.floor(y);
 const offsets=[0];for(let n=1;n<=Math.max(maxRise,maxDrop);n++){if(n<=maxRise)offsets.push(n);if(n<=maxDrop)offsets.push(-n);}
 for(const dy of offsets){
  const feet=y+dy;if(!solidFloor(readBlock(d,{x,y:feet-1,z})))continue;
  let clear=true;
  for(let bx=Math.floor(x-halfWidth);bx<=Math.floor(x+halfWidth)&&clear;bx++)for(let bz=Math.floor(z-halfWidth);bz<=Math.floor(z+halfWidth)&&clear;bz++)for(let by=feet;by<Math.ceil(feet+height);by++)if(!readBlock(d,{x:bx,y:by,z:bz})?.isAir){clear=false;break;}
  if(clear)return {x,y:feet,z};
 }
}
export function teleportDestination(entity,center=entity.location,{spread=15,minOffset=5,attempts=20,requireSight=false,...options}={}){
 const height=entity.typeId==='dungeons:wretched_wraith'?4:3;
 for(let n=0;n<attempts;n++){
  const offset=()=>{const v=Math.random()*spread*2-spread;return Math.abs(v)<minOffset?(v<0?-minOffset:minOffset):v;};
  const p=landingAt(entity.dimension,center.x+offset(),center.z+offset(),center.y,{height,...options});if(!p)continue;
  const distance=Math.hypot(p.x-center.x,p.y-center.y,p.z-center.z);let clear=true;
  for(let i=1;requireSight&&i<Math.ceil(distance);i++){
   const t=i/Math.ceil(distance),block=readBlock(entity.dimension,{x:center.x+(p.x-center.x)*t,y:center.y+1+(p.y-center.y)*t,z:center.z+(p.z-center.z)*t});
   if(!block?.isAir){clear=false;break;}
  }
  if(clear)return p;
 }
 // Short escape destinations remain usable in halls crowded with pillars.
 for(const radius of [2,4,6,8])for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,p=landingAt(entity.dimension,center.x+Math.cos(angle)*radius,center.z+Math.sin(angle)*radius,center.y,{height,...options});
  if(p&&Math.hypot(p.x-entity.location.x,p.z-entity.location.z)>=1.5)return p;
 }
}
