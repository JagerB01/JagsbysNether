import {casterHit} from './arena_damage.js';
import { DimensionTypes } from "@minecraft/server";
import { world } from "./runtime.js";
import { scopedSystem } from "./runtime.js";
const system = scopedSystem("necromancer");


import { isValidTarget, makeVector, getDirection } from "./helpers.js"


// Set the base before the existing enchanted-mob multiplier runs.
world.beforeEvents.entityHurt.subscribe(e=>{
 if(e.cancel||e.damageSource.cause!=='projectile'||e.damageSource.damagingProjectile?.typeId!=='dungeons:necromancer_shot')return;
 e.damage*=casterHit(world.getDifficulty())/10;
});

const huskBiomes = [
    "minecraft:desert",
    "minecraft:mesa",
    "minecraft:mesa_bryce",
    "minecraft:mesa_plateau_stone"
]
const frozenZombieBiomes = [
    "minecraft:ice_plains",
    "minecraft:cold_taiga",
    "minecraft:ice_plains_spikes",
    "minecraft:frozen_ocean",
    "minecraft:frozen_ocean",
    "minecraft:deep_frozen_ocean",
    "minecraft:frozen_river",
    "minecraft:snowy_slopes",
    "minecraft:jagged_peaks",
    "minecraft:frozen_peaks"
]
const jungleZombieBiomes = [
    "minecraft:jungle",
    "minecraft:bamboo_jungle",
    "minecraft:jungle_edge",
    "minecraft:swampland",
    "minecraft:mangrove_swamp",
    "minecraft:lush_caves"
]

//particles
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:zombie' && entity.typeId == "dungeons:necromancer_spawnpoint") {
        var loc = entity.location;
        const dim = entity.dimension;
        const zombiesNear = dim.getEntities({ location: loc, maxDistance: 32, tags: ["dungeons:necromancer_minion"] })
        if (zombiesNear.length > 10) {
            entity.remove()
            return;
        }
        dim.spawnParticle("dungeons:necromancer_zombie_spawn", loc)
        dim.spawnParticle("dungeons:wraith_teleport_out", { x: loc.x, y: loc.y - 0.75, z: loc.z })
        dim.playSound("mob.zombie.death", loc, { volume: 0.5, pitch: 0.5 })
        dim.playSound("mob.evocation_illager.prepare_summon", loc, { volume: 0.5, pitch: 2 + Math.random() })

        var zombieId = "minecraft:zombie"
        let biome;
        try{biome=dim.getBiome(loc)?.id;}catch{} // Missing biome data must not cancel a Nether summon.
        if (huskBiomes.includes(biome)) zombieId = "minecraft:husk"
        if (frozenZombieBiomes.includes(biome)) zombieId = "dungeons:frozen_zombie"
        if (jungleZombieBiomes.includes(biome)) zombieId = "dungeons:jungle_zombie"
        spawned(zombieId, loc, dim)
        entity.remove()
    }
});

function spawned(id, loc, dim) {
    const entity = dim.spawnEntity(id, loc)
    if (entity.isValid) entity.addTag("dungeons:necromancer_minion")
}

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const mob of dim.getEntities({ tags: ["dungeons:necromancer_minion"] })) {

            var loc = mob.location;
            const necromancerNearby = dim.getEntities({ location: loc, maxDistance: 32, families: ["necromancer"] })
            const playerNearby = dim.getEntities({ location: loc, maxDistance: 24, families: ["player"] })
            if (necromancerNearby.length == 0 && playerNearby.length == 0) {
                dim.spawnParticle("dungeons:necromancer_zombie_spawn", loc)
                dim.spawnParticle("dungeons:wraith_teleport_out", { x: loc.x, y: loc.y - 0.75, z: loc.z })
                mob.remove()
            }
        }
    }
})