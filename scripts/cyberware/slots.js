import { MODULE_ID } from "../codex/constants.js";
import { normalizeBoolean, normalizeNumber } from "../utils/normalization.js";
import { AUGMENTATION_DEFINITIONS } from "./config.js";

export function getAugmentation(item, definition) {
  const flags = item.getFlag(MODULE_ID, definition.id) ?? {};
  return {
    enabled: normalizeBoolean(flags.enabled),
    slots: normalizeNumber(flags.slots, { min: 0 }),
    notes: String(flags.notes ?? "")
  };
}

/** Keep the item shortcuts and slot calculation on the same item selection. */
export function getAugmentationItems(actor, definition) {
  return actor.items.filter(item => definition.itemTypes.includes(item.type)
    && getAugmentation(item, definition).enabled);
}

/** Count each enabled embedded document once, irrespective of quantity/equipped. */
export function calculateAugmentationSlots(actor, definition) {
  let used = 0;
  for (const item of getAugmentationItems(actor, definition)) {
    used += getAugmentation(item, definition).slots;
  }
  const stat = normalizeNumber(actor.system.stats?.[definition.stat]?.value, { min: 0 });
  const max = Math.floor(stat / 10);
  return { used, max, overclocking: Math.max(0, used - max) };
}

/** Combine excess slots while retaining separate Cyberware and Slickware totals. */
export function calculateAugmentationState(actor) {
  const state = Object.fromEntries(AUGMENTATION_DEFINITIONS.map(definition => [
    definition.id,
    calculateAugmentationSlots(actor, definition)
  ]));
  state.overclocking = AUGMENTATION_DEFINITIONS.reduce(
    (total, definition) => total + state[definition.id].overclocking,
    0
  );
  return state;
}
