import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "echo"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    const cause = e.damageSource.cause;
    if (cause !== "entityAttack") return;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        //effect code
        if (e.damage <= 0) return;

        system.run(() => {
            var cd = world.scoreboard.getObjective('dungeons:echo_t');
            if (!cd) {
                cd = world.scoreboard.addObjective('dungeons:echo_t');
            }
            if (cd.hasParticipant(damageSource)) {
                return;
            }
            cd.setScore(damageSource, 80)
            system.runTimeout(() => {
                if (!damageSource.isValid) return;
                const hurt = e.hurtEntity;
                if (!hurt) return;
                if (!hurt.isValid) return;
                const dim = hurt.dimension
                const hurtLoc = hurt.location;
                dim.spawnParticle('dungeons:echo', hurtLoc);
                dim.playSound('weapon.daggers.hit', hurtLoc, {
                    volume: 0.6
                });
                hurt.applyDamage(10, { cause: cause, damagingEntity: damageSource })
            }, 10)
        })
    }


});

// TIMER
system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            var timeLeft = world.scoreboard.getObjective('dungeons:echo_t');
            if (!timeLeft) return;
            if (!entity.scoreboardIdentity) continue;
            if (!timeLeft.hasParticipant(entity.scoreboardIdentity)) continue;
            let duration = timeLeft.getScore(entity);

            if (duration > 0) {
                timeLeft.addScore(entity, -1);
            }
            if (duration <= 0) {
                timeLeft.removeParticipant(entity)
            }
        }
    }
})