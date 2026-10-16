// Raw inputs for native Bedrock mitigation; never subtract player health or
// read equipment to defeat armour, enchantments, resistance or absorption.
export const BOSS_DAMAGE=Object.freeze({standard:96,powerful:160,shockwave:208,groundFire:32});
export function bossDamage(attack,difficulty='Hard'){
 const factor=difficulty==='Easy'?.5:difficulty==='Normal'?2/3:difficulty==='Peaceful'?0:1;
 return BOSS_DAMAGE[attack]*factor;
}
export function shockwaveDamage(distance,difficulty='Hard'){
 // Preserve Alylica's exact original 20-round(distance*3) falloff and radius.
 return bossDamage('shockwave',difficulty)*Math.max(0,20-Math.round(distance*3))/20;
}
