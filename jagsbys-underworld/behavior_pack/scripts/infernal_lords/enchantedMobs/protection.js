import { world } from "../runtime.js";


const id = "protection"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurtEntity = e.hurtEntity;
    if (!hurtEntity) return;
    if (e.damageSource.cause == "selfDestruct") return;
    if (hurtEntity.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] }))
        e.damage = e.damage * 0.5
});