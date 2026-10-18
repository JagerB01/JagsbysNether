import {casterHit,casterLinger} from './arena_damage.js';
import { DimensionTypes } from "@minecraft/server";
import { world } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("actors");


//cloud
function createPoisonCloud(timeLeft, dim, loc, hitPlayers=new Set()) {
    if (timeLeft <= 0 || dim.isChunkLoaded?.(loc)===false) return;
    if (timeLeft > 1) {
        dim.spawnParticle("dungeons:enemy_poison_cloud_smoke", loc)
        dim.spawnParticle("dungeons:enemy_poison_cloud_swirls", loc)
    }
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 3,
        families: ["player"]
    });
    for (const target of damageRange) {
        if(!target.isValid || ["Creative","Spectator"].includes(target.getGameMode?.()))continue;
        const damage = hitPlayers.has(target.id)?casterLinger(world.getDifficulty()):casterHit(world.getDifficulty());
        const damageDone = target.applyDamage(damage, { cause: "magic" })
        if (damageDone) {
            hitPlayers.add(target.id);
            target.applyKnockback({ x: 0, z: 0 }, -0.1)
            target.addEffect("fatal_poison", 11)
        }
    }
    system.runTimeout(() => {
        createPoisonCloud(timeLeft - 1, dim, loc, hitPlayers)
    }, 10)
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    if(e.eventId !== "minecraft:entity_spawned") return;
    const entity = e.entity;
    if(!entity || !entity.isValid || entity.typeId !== "dungeons:tower_wraith_poison") return;
    const dim = entity.dimension;
    const loc = entity.location
            dim.playSound('weapon.enchant.poison', loc)
            var duration = 5
            if (world.getDifficulty() == "Normal") duration = 7
            if (world.getDifficulty() == "Hard") duration = 9
            createPoisonCloud(duration, dim, loc)
})
