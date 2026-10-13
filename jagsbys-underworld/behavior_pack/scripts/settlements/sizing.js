// Residential targets; farms/amenities have their own slots.
export function villageSize(rng){
 const roll=rng();
 if(roll<.25)return {name:'small',houses:6+Math.floor(rng()*3),roads:16,radius:40,depth:5};
 if(roll<.85)return {name:'medium',houses:9+Math.floor(rng()*3),roads:22,radius:48,depth:6};
 return {name:'large',houses:12+Math.floor(rng()*3),roads:28,radius:56,depth:7};
}
