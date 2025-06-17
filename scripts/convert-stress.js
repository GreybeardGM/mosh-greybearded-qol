import { showStressConversionDialog } from "./ui/stress-distribution.js";

export async function convertStress(actor, formula = "1d5", options = { useSanitySave: true, relieveStress: true }) {
  const stress = actor.system.other.stress;
  const currentStress = stress?.value ?? 0;
  const minStress = stress?.min ?? 2;

  // No stress to convert
  if (currentStress <= minStress) return { result: "none" };

  let conversionPoints = currentStress - minStress;
  let rollResult = null;

  // Optional: Sanity Save
  if (options.useSanitySave) {
    const sanityCheck = await actor.rollCheck(null, "low", "sanity", null, null, null);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: sanityCheck.rollHtml + sanityCheck.outcomeHtml
    });

    // Wait for async resolution of result flags
    await foundry.utils.wait(10); // Small delay to allow flags to resolve if needed

    const success = sanityCheck?.success === true;
    const critical = sanityCheck?.critical === true;

    if (!success && critical) {
      ui.notifications.warn("PANIC CHECK TRIGGERED (not yet implemented)");
    }

    if (!success) {
      conversionPoints = 0;
    }

    if (success && critical) {
      const match = formula.match(/(\d+)d(\d+)/);
      if (match) {
        const [_, count, die] = match;
        formula = `${parseInt(count) * parseInt(die)}`;
      }
    }
  }

  // Roll for conversion
  if (conversionPoints > 0) {
    const roll = await new Roll(formula).roll({ async: true });
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Stress Conversion Roll" });
    rollResult = roll;
    conversionPoints = Math.min(roll.total, conversionPoints);
  } 
  else {
    if (options.relieveStress) {
      const targetStress = minStress + 1;
      await actor.update({"system.other.stress.value": targetStress});
    }
    return { result: "nochange" };
  }

  const finalSaves = await showStressConversionDialog(actor, conversionPoints);
  if (!finalSaves) return { result: "canceled" };

  const targetStress = options.relieveStress ? minStress : Math.max(minStress, currentStress - conversionPoints);
  await actor.update({
    "system.other.stress.value": targetStress,
    "system.stats.sanity.value": finalSaves.sanity,
    "system.stats.fear.value": finalSaves.fear,
    "system.stats.body.value": finalSaves.body
  });

  return {
    result: "success",
    stressBefore: currentStress,
    stressAfter: targetStress,
    converted: conversionPoints,
    newSaves: finalSaves,
    roll: rollResult
  };
}
