import { EntityDamageCause } from "@minecraft/server";
import { world } from "../runtime.js";
import { scopedSystem } from "../runtime.js";
const system = scopedSystem("enchanted");


import { getDirection, makeVector } from "../helpers.js";
const id = "accelerate";

world.afterEvents.entitySpawn.subscribe((e) => {
  const entity = e.entity;
  if (!entity || !entity.isValid || !["minecraft:arrow", "dungeons:enchanted_arrow"].includes(entity.typeId)) return;
  const projectile = entity.getComponent("projectile");
  if (!projectile?.owner) return;
  if (projectile.owner.hasTag("dungeons:enchanted_mob_" + id)) {
    const v = entity.getVelocity();
    entity.applyImpulse({
      x: v.x * 1.5,
      y: v.y,
      z: v.z * 1.5,
    });
  }
});
