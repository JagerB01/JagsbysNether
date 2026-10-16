import {bossDamage,BOSS_DAMAGE} from './boss_damage.js';
import {teleportDestination} from './teleport.js';
import { EntityDamageCause } from "@minecraft/server";
import { world,recordBossAction } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("actors");


const teleportHiddenTime = 10

//projectiles
function multiply(a, b) {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

world.afterEvents.entitySpawn.subscribe((e) => {
    if(e.entity?.typeId!=="dungeons:nameless_one_projectile")return;
    system.run(()=>{
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (entity.typeId == "dungeons:nameless_one_projectile" && !entity.hasTag("dungeons:chud_projectile")) {

        const proj = entity.getComponent("projectile")
        if (!proj) return;
        const owner = proj.owner;
        if (!owner) return;
        if (owner.typeId == "dungeons:nameless_one_illusion") {
            system.runTimeout(() => {
                if (owner.isValid) owner.triggerEvent("dungeons:despawn")
            }, 20)
        } else if (owner.typeId == "dungeons:nameless_one") {
            const dim = owner.dimension;
            const viewDir = owner.getViewDirection()
            let amount = 3
            for (let i = 0; i < amount; i++) {
                const angle = -((amount - 1) / 2 * 10) + 10 * i;
                const radians = angle * (Math.PI / 180)
                if (angle == 0) continue;
                const hd = owner.getHeadLocation();
                const vd = owner.getViewDirection();
                const projectile = dim.spawnEntity(entity.typeId, { x: hd.x + vd.x, y: hd.y + vd.y, z: vd.z + hd.z })
                const comp = projectile.getComponent('projectile');
                let cosTheta = Math.cos(radians);
                let sinTheta = Math.sin(radians);
                const direction = {
                    x: viewDir.x * cosTheta + viewDir.z * sinTheta,
                    y: viewDir.y,
                    z: -viewDir.x * sinTheta + viewDir.z * cosTheta
                }
                if (comp) {
                    comp.owner = owner
                    comp.shoot(multiply(direction, { x: 0.53, y: 0.53, z: 0.53 }))
                } else {
                    projectile.applyImpulse(multiply(direction, { x: 0.53, y: 0.53, z: 0.53 }))
                }
                projectile.addTag("dungeons:chud_projectile")
            }

        } else {
            return;
        }
    }
    });
})

// Native on_hit applies impact damage and removes the projectile. This also
// works with Fire Resistance and without a live owner in an after-hit event.
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (projectile.typeId !== "dungeons:nameless_one_projectile") return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;

    e.damage*=bossDamage("standard",world.getDifficulty())/BOSS_DAMAGE.standard;
    if (hurt.matches({ families: ["undead"] }) || hurt.matches({ families: ["monster"] })) {
        e.cancel = true;
        e.damage = 0
    }

});

//teleport

function teleport(entity, loc) {
    if (!entity?.isValid) return;
    if (loc == undefined) loc = entity.location;
    const entityLoc = entity.location;
    const dim = entity.dimension;
    const teleportLoc = teleportDestination(entity, loc);
    if (!teleportLoc || !entity.tryTeleport(teleportLoc, {checkForBlocks: true})) return;
    recordBossAction(entity,'teleport_success');
    dim.playSound("mob.nameless_one.teleport_out", entityLoc)
    dim.spawnParticle("dungeons:nameless_teleport_out", entityLoc)
    system.runTimeout(() => {
        if (dim.isChunkLoaded(teleportLoc)) {
            dim.playSound("mob.nameless_one.teleport_in", teleportLoc)
            dim.spawnParticle("dungeons:nameless_teleport_in", teleportLoc)
        }
    }, teleportHiddenTime)
    entity.addEffect("invisibility", teleportHiddenTime, { showParticles: false })
    connectLine(entity, entityLoc, dim)
}
function connectLine(player, baseLoc, baseDim) {
    const baseDist = Math.hypot(baseLoc.x - player.location.x, baseLoc.y - player.location.y, baseLoc.z - player.location.z)
    for (let i = 1; i < teleportHiddenTime; i += teleportHiddenTime / baseDist) {
        system.runTimeout(() => {
            if (!player.isValid || player.dimension.id !== baseDim.id) return;
            const targetLoc = player.location;
            const xDif = targetLoc.x - baseLoc.x
            const yDif = targetLoc.y - baseLoc.y
            const zDif = targetLoc.z - baseLoc.z
            const particleLoc = { x: baseLoc.x + (xDif * (i / teleportHiddenTime)), y: 1 + baseLoc.y + (yDif * (i / teleportHiddenTime)), z: baseLoc.z + (zDif * (i / teleportHiddenTime)) }
            if (player.dimension.isChunkLoaded(particleLoc)) {
                player.dimension.spawnParticle("dungeons:nameless_one_orb_1", particleLoc)
                player.dimension.spawnParticle("dungeons:nameless_teleport_trail", particleLoc)
            }
        }, i)
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (entity.typeId !== "dungeons:nameless_one" || entity.getProperty("dungeons:casting") == true) return
    if (id === 'dungeons:nameless_one_teleport' && entity.typeId == "dungeons:nameless_one") {
        teleport(entity)
    }
    if (id === 'dungeons:nameless_one_teleport_to_player' && entity.typeId == "dungeons:nameless_one") {
        const nearbyPlayer = entity.dimension.getPlayers({ location: entity.location, closest: 1, maxDistance: 64 })
        var loc = entity.location;
        if (nearbyPlayer.length >= 1) loc = nearbyPlayer[0].location
        if(loc.y > entity.location.y + 10) {
            teleport(entity)
        } else {
            teleport(entity, loc)

        }
    }
    if (id === 'minecraft:entity_transformed' && entity.typeId == "dungeons:nameless_one") {
        system.runTimeout(() => {
            if (entity.isValid == false) return;
            teleport(entity)
        }, 20)
    }
});


//detect vanguards
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:detect_vanguards' && entity.typeId == "dungeons:nameless_one") {
        if (entity.getProperty("dungeons:casting") == true) return;
        const dim = entity.dimension;
        const loc = entity.location;
        if (!dim.isChunkLoaded(loc)) return;
        if (dim.getEntities({ location: loc, maxDistance: 64, type: "dungeons:vanguard", excludeTags: ["dungeons:love_medallion_active"] }).length <= 0) {
            if (entity.getProperty("dungeons:vanguards") == true) entity.triggerEvent("dungeons:no_vanguards_in_range")
            entity.setProperty("dungeons:vanguards", false)
        } else {
            if (entity.getProperty("dungeons:vanguards") == false) entity.triggerEvent("dungeons:vanguards_in_range")
            entity.setProperty("dungeons:vanguards", true)
        }
    }
});


//clone despawn
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:despawn' && entity.typeId == "dungeons:nameless_one_illusion") {
        const loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:nameless_teleport_out", loc)
        dim.spawnParticle("dungeons:nameless_teleport_out", entity.getHeadLocation())
        entity.remove()
    }
});

//clone teleport
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:complete_casting' && entity.typeId == "dungeons:nameless_one" && entity.getProperty("dungeons:vanguards") == true) {
        system.runTimeout(() => {
            teleport(entity)
        }, 4)
    }
});

//clone spawn
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (entity.typeId == "dungeons:nameless_one_illusion") {
        const loc = entity.location;
        const dim = entity.dimension;
        const teleportLoc = teleportDestination(entity, loc, {spread:2.5,minOffset:0});
        if (teleportLoc) entity.tryTeleport(teleportLoc, {checkForBlocks:true});
    }
})
