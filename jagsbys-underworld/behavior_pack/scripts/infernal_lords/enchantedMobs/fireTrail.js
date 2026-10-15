import { DimensionTypes } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


const id = "fire_trail";

system.runInterval(() => {
  const dims = [];
  for (const player of world.getPlayers())
    if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id);
  for (const dimensionType of dims) {
    const dim = world.getDimension(dimensionType);
    for (const entity of dim.getEntities({
      families: ["enchanted"],
      tags: ["dungeons:enchanted_mob_" + id],
    })) {
      if (dim.isChunkLoaded(entity.location)) {
        const riding = entity.getComponent("riding");
        if (riding) {
          const mount = riding.entityRidingOn;
          if (mount && mount.hasTag("dungeons:enchanted_mob_" + id)) return;
        }
        const loc = entity.location;
        const playersNearby = dim.getPlayers({
          location: loc,
          maxDistance: 32,
        });
        const isFire = dim.getEntities({
          location: loc,
          type: "dungeons:enchanted_fire",
          maxDistance: 0.66,
        });
        if (
          entity.isOnGround == false &&
          !entity.matches({ families: ["vex"] })
        )
          continue;
        if (
          isFire.length <= 0 &&
          playersNearby.length > 0 &&
          !entity.isInWater
        ) {
          var locs = [loc];
          if (entity.hasTag("dungeons:enchanted_mob_huge"))
            locs = [
              { x: loc.x + 0.5, y: loc.y, z: loc.z + 0.5 },
              { x: loc.x + 0.5, y: loc.y, z: loc.z - 0.5 },
              { x: loc.x - 0.5, y: loc.y, z: loc.z + 0.5 },
              { x: loc.x - 0.5, y: loc.y, z: loc.z - 0.5 },
            ];
          for (const fireLoc of locs) {
            if (
              dim.getEntities({
                location: fireLoc,
                type: "dungeons:enchanted_fire",
                maxDistance: 0.66,
              }).length > 0
            )
              continue;
            const fire = dim.spawnEntity("dungeons:enchanted_fire", fireLoc);
            if (entity.matches({ families: ["ancient"] }))
              fire.setProperty("dungeons:ancient", true);
          }
        }
      }
    }
  }
}, 3);

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  const entity = e.entity;
  const id = e.eventId;
  if (
    id === "dungeons:wraith_fire_hit" &&
    entity.typeId == "dungeons:enchanted_fire"
  ) {
    if (!entity.isValid) return;
    const dim = entity.dimension;
    var loc = entity.location;
    loc = { x: loc.x, y: loc.y + 0.1, z: loc.z };
    if (Math.random() > 0.25)
      dim.spawnParticle("dungeons:wretched_wraith_fire_smoke", loc);
    const damageRange = dim.getEntitiesAtBlockLocation(loc);
    if (damageRange.length < 1) return;
    var targets = [];

    var damage = 4;
    if (world.getDifficulty() == "Hard") damage += 2;
    if (world.getDifficulty() == "Easy") damage -= 2;
    for (const damaged of damageRange) {
      if (targets.includes(damaged)) continue;
      if (damaged.matches({ families: ["monster"] })) continue;
      if (damaged.matches({ families: ["undead"] })) continue;
      if (damaged.getEffect("fire_resistance")) continue;
      if (damaged.typeId == "minecraft:player") {
        if (damaged.getGameMode() == "Creative") continue;
      }
      if (
        damaged.typeId == "minecraft:player" ||
        damaged.matches({ families: ["player"] }) ||
        damaged.matches({ families: ["mob"] }) ||
        damaged.matches({ families: ["animal"] })
      )
        targets.push(damaged);
    }
    if (targets.length < 1) return;
    for (const target of targets) {
      const didDamage = target.applyDamage(damage, { cause: "fire" });
      if (didDamage) {
        target.setOnFire(2);
      }
    }
  }
});

//spawn fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  const entity = e.entity;
  const id = e.eventId;
  if (
    entity.typeId == "dungeons:enchanted_fire" &&
    id == "minecraft:entity_spawned"
  ) {
    const dim = entity.dimension;
    const loc = entity.location;
    const topMost = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y + 1);
    if (!topMost) return entity.remove();
    const block = dim
      .getTopmostBlock({ x: loc.x, z: loc.z }, loc.y + 1)
      .above();

    const tpLoc = {
      x: block.bottomCenter().x,
      y: block.bottomCenter().y - 0.1,
      z: block.bottomCenter().z,
    };
    entity.addEffect("invisibility", 3, { showParticles: false });
    if (block.below().isAir == false) {
      const isFire = dim.getEntities({
        location: tpLoc,
        families: ["dungeons_fire"],
        maxDistance: 0.1,
      });
      if (isFire.length >= 1) {
        entity.remove();
      } else {
        entity.tryTeleport(tpLoc);
      }
    }
    if (!entity.isValid) return;
    entity.setDynamicProperty("dungeons:fire_type", "enchanted_fire");
    dim.playSound("mob.wraith.fire", tpLoc, { pitch: 0.55, volume: 0.2 });
  }
});
