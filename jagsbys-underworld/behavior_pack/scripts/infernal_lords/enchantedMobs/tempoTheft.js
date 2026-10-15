import { world } from "../runtime.js";


const id = "tempo_theft"

world.afterEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    let slowness = hurt.getEffect("slowness");
    let speed = damageSource.getEffect("speed");
    if (!slowness) {
      hurt.addEffect("slowness", 60, { amplifier: 0 });
    } else {
      var slowLevel = slowness.amplifier + 1;
      if (slowLevel > 5) slowLevel = 5;
      var slowTime = slowness.duration + 25;
      if (slowTime > 155) slowTime = 155;
      hurt.addEffect("slowness", slowTime, { amplifier: slowLevel });
    }
    if (!speed) {
      damageSource.addEffect("speed", 60, { amplifier: 0 });
    } else {
      var speedLevel = speed.amplifier + 1;
      if (speedLevel > 5) speedLevel = 5;
      var speedTime = speed.duration + 25;
      if (speedTime > 155) speedTime = 155;
      damageSource.addEffect("speed", speedTime, { amplifier: speedLevel });
    }
    const dim = damageSource.dimension;
    const loc = damageSource.location;
    dim.playSound("artefact.swiftness_boot.use", loc);
    dim.spawnParticle("dungeons:swiftness", loc);

    }
});