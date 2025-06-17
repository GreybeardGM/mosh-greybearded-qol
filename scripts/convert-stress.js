export async function convertStress(actor, formula = "1d5", options = { useSanitySave: false, resetToMin: false }) {
  const stress = actor.system.other.stress;
  const currentStress = stress?.value ?? 0;
  const minStress = stress?.min ?? 1;

  // No stress to convert
  if (currentStress <= minStress) return { result: "none" };

  let conversionPoints = 0;
  let rollResult = null;

  // Optional: Sanity Save
  if (options.useSanitySave) {
    const sanityCheck = await actor.rollCheck(null, "low", "sanity", null, null, null);
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: sanityCheck.rollHtml + sanityCheck.outcomeHtml
    });

    if (sanityCheck.criticalFailure) {
      ui.notifications.warn("PANIC CHECK TRIGGERED (not yet implemented)");
      return { result: "panic" };
    }

    if (!sanityCheck.success) {
      return { result: "fail" };
    }

    if (sanityCheck.criticalSuccess) {
      const match = formula.match(/(\d+)d(\d+)/);
      if (match) {
        const [_, count, die] = match;
        conversionPoints = parseInt(count) * parseInt(die);
      }
    }
  }

  // Roll for conversion if not auto-success
  if (conversionPoints === 0) {
    const roll = await new Roll(formula).roll({ async: true });
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Stress Conversion Roll" });
    rollResult = roll;
    conversionPoints = roll.total;
  }

  const targetStress = options.resetToMin ? minStress : Math.max(minStress, currentStress - conversionPoints);
  const converted = currentStress - targetStress;
  await actor.update({ "system.other.stress.value": targetStress });

  if (converted <= 0) return { result: "nochange" };

  const finalSaves = await showStressConversionDialog(actor, converted);
  if (!finalSaves) return { result: "canceled" };

  await actor.update({
    "system.stats.sanity.value": finalSaves.sanity,
    "system.stats.fear.value": finalSaves.fear,
    "system.stats.body.value": finalSaves.body
  });

  return {
    result: "success",
    stressBefore: currentStress,
    stressAfter: targetStress,
    converted,
    newSaves: finalSaves,
    roll: rollResult
  };
}
