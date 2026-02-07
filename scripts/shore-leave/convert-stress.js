import { StressDistributionApp } from "./stress-distribution.js";
import { chatOutput } from "../utils/chat-output.js";

export async function convertStress(actor, formula, options = {}) {
  // Fallback Actor
  actor = actor || game.user.character;
  if (!actor) return ui.notifications.warn("No actor available for stress conversion.");

  formula = formula ?? game.settings.get("mosh-greybearded-qol", "convertStress.formula");
  const noSanitySave = options.noSanitySave ?? game.settings.get("mosh-greybearded-qol", "convertStress.noSanitySave");
  const noStressRelieve = options.noStressRelieve ?? game.settings.get("mosh-greybearded-qol", "convertStress.noStressRelieve");
  const minStressConversion = options.minStressConversion ?? game.settings.get("mosh-greybearded-qol", "convertStress.minStressConversion");
  
  const stress = actor.system.other.stress;
  const currentStress = stress?.value ?? 0;
  const minStress = stress?.min ?? 2;

  // No stress to convert
  if ((!minStressConversion && currentStress <= minStress) || (minStressConversion && currentStress <= 0)) return { result: "none" };

  let conversionPoints = currentStress;
  if (!minStressConversion) conversionPoints -= minStress;
  let rollResult = null;

  // Optional: Sanity Save
  if (!noSanitySave) {
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
      if (!noStressRelieve) {
        const targetStress = minStress + 1;
        await actor.update({"system.other.stress.value": targetStress});
      }
      return { result: "nochange" };
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
  const roll = new Roll(formula);
  await roll.evaluate();
  rollResult = roll;
  conversionPoints = Math.min(roll.total, conversionPoints);
  await chatOutput({
    actor,
    title: "Stress Conversion",
    content: `Converted Stress: <label class="counter">${conversionPoints}</label>`,
    subtitle: actor.name,
    image: actor.img,
    roll
  });

  const finalSaves = await StressDistributionApp.wait({ actor, points: conversionPoints });
  if (!finalSaves) return { result: "canceled" };

  const targetStress = noStressRelieve ? Math.max(minStress, currentStress - conversionPoints) : minStress;
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
