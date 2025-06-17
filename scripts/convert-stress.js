/**
 * Converts stress into save points and reduces stress accordingly.
 * @param {Actor} actor - The actor to modify.
 * @param {Object} options - Configuration options.
 * @param {string} [options.rollFormula="1d5"] - Formula to roll for conversion amount.
 * @param {boolean} [options.requireSanitySave=false] - Placeholder, not yet implemented.
 * @param {boolean} [options.resetToMin=false] - If true, sets stress to minimum after conversion.
 * @param {boolean} [options.showDialog=true] - Whether to show the point distribution dialog.
 */
import { showStressConversionDialog } from "./ui/stress-distribution.js";

export async function convertStress(actor, {
  rollFormula = "1d5",
  requireSanitySave = false, // Placeholder
  resetToMin = false,
  showDialog = true
} = {}) {
  if (!actor || !actor.system?.other?.stress) {
    ui.notifications.error("Invalid actor or no stress value found.");
    return;
  }

  const stress = actor.system.other.stress.value;
  const min = actor.system.other.stress.min ?? 2;
  const stressAvailable = Math.max(0, stress - min);

  // Roll for conversion
  const roll = await new Roll(rollFormula).roll({ async: true });
  const converted = Math.min(roll.total, stressAvailable);

  // Stress update (we apply it after dialog so we can cancel)
  const newStress = resetToMin ? min : stress - converted;

  // Distribute converted points to saves
  if (converted > 0 && showDialog) {
    const result = await showStressConversionDialog(actor, converted);
    if (!result) return; // user canceled or invalid
  }

  await actor.update({ "system.other.stress.value": newStress });

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<strong>Stress Conversion:</strong><br>
              Rolled: ${roll.total} → Converted: ${converted}<br>
              Final Stress: ${newStress}`
  });

  return { roll, converted, stressBefore: stress, stressAfter: newStress };
}
