import { world } from "../runtime.js";


const id = "fire_aspect"

world.afterEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const hurt = e.hurtEntity;
        if (!hurt) return;
        if (!hurt.isValid) return;
        var time = 4
        if(world.getDifficulty() == "Normal") time = 6
        if(world.getDifficulty() == "Hard") time = 8
        const isFire = hurt.setOnFire(time, true)
        if (!isFire) return;
        damageSource.dimension.playSound('mob.ghast.fireball', hurt.location, {
            pitch: 1.05,
            volume: 0.33
        })
    }
});