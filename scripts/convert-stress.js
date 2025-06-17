export async function convertStress(actor, formula = "1d5", options = { useSanitySave: false, resetToMin: false }) {
  const stress = actor.system.stats.stress;
  const currentStress = stress?.value ?? 0;
  const minStress = stress?.min ?? 1;

  // No stress to convert
  if (currentStress <= minStress) return { result: "none" };

  let conversionPoints = 0;
  let rollResult = null;
  let conversionAllowed = true;

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
      if (options.resetToMin) {
        await actor.update({ "system.stats.stress.value": minStress });
      }
      return { result: "panic" };
    }

    if (!sanityCheck.success) {
      conversionAllowed = false;
      if (options.resetToMin) {
        await actor.update({ "system.stats.stress.value": minStress });
      }
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

  // Reduce stress
  const newStress = Math.max(minStress, currentStress - conversionPoints);
  await actor.update({ "system.stats.stress.value": options.resetToMin ? minStress : newStress });

  // Let player distribute points
  const finalSaves = await showStressConversionDialog(actor, currentStress - newStress);
  if (!finalSaves) return { result: "canceled" };

  await actor.update({
    "system.stats.sanity.value": finalSaves.sanity,
    "system.stats.fear.value": finalSaves.fear,
    "system.stats.body.value": finalSaves.body
  });

  return {
    result: "success",
    stressBefore: currentStress,
    stressAfter: options.resetToMin ? minStress : newStress,
    converted: currentStress - newStress,
    newSaves: finalSaves,
    roll: rollResult
  };
}
