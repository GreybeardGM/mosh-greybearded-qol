import { showStressConversionDialog } from "./ui/stress-distribution.js";

export async function convertStress(actor, formula, options = {}) {
  formula = formula ?? game.settings.get("mosh-greybearded-qol", "convertStress.formula");
  const useSanitySave = options.useSanitySave ?? game.settings.get("mosh-greybearded-qol", "convertStress.useSanitySave");
  const relieveStress = options.relieveStress ?? game.settings.get("mosh-greybearded-qol", "convertStress.relieveStress");
  
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

    // Wait for evaluation
    await new Promise(resolve => setTimeout(resolve, 20));

    const result = Array.isArray(sanityCheck) ? sanityCheck[0]?.parsedRollResult : sanityCheck;
    const success = result?.success === true;
    const critical = result?.critical === true;

    if (!success && critical) {
      await actor.rollTable("panicCheck", null, null, null, null, null, null);
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
    const roll = new Roll(formula);
    await roll.evaluate({ async: true });
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
