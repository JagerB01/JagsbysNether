import {
    system
} from "@minecraft/server";

import { getDirection, makeVector } from "./helpers.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:glaive', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const spooky = params.spooky
            if (!attacker.isValid || !hit.isValid) return;
            const dim = hit.dimension
            const weapon = e.itemStack
            if (spooky == true) {
                dim.playSound('weapon.cackling_broom.swing', attacker.location);
                dim.spawnParticle(`${weapon.typeId}_sweep`, hit.location);
            } else {
                dim.playSound('weapon.glaive.swing', attacker.location);
                dim.spawnParticle(`${weapon.typeId}_sweep`, hit.location);
            }

            const dir = getDirection(attacker.location, hit.location);
            hit.applyKnockback(makeVector(dir, 1.2), 0.23)
        }
    });
});
