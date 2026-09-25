import { MODULE_ID } from "../codex/constants.js";
import { normalizeBoolean, normalizeNumber } from "../utils/normalization.js";
import { AUGMENTATION_DEFINITIONS, calculateSlotMaximum, getSlotRules } from "./config.js";

export function getAugmentation(item, definition) {
  const flags = item.getFlag(MODULE_ID, definition.id) ?? {};
  return {
    enabled: normalizeBoolean(flags.enabled),
    slots: normalizeNumber(flags.slots, { min: 0, max: 9 }),
    notes: String(flags.notes ?? "")
  };
}

/** Count each enabled embedded document once, irrespective of quantity/equipped. */
function summarizeAugmentation(actor, definition, rules) {
  const items = [];
  let used = 0;
  for (const item of actor.items) {
    if (!definition.itemTypes.includes(item.type)) continue;
    const augmentation = getAugmentation(item, definition);
    if (!augmentation.enabled) continue;
    items.push(item);
    used += augmentation.slots;
  }
  const max = calculateSlotMaximum(actor, definition, rules);
  return { items, used, max, overclocking: Math.max(0, used - max) };
}

export function getAugmentationItems(actor, definition) {
  return actor.items.filter(item => definition.itemTypes.includes(item.type) && getAugmentation(item, definition).enabled);
}

export function calculateAugmentationSlots(actor, definition) {
  const { items, ...slots } = summarizeAugmentation(actor, definition, getSlotRules());
  return slots;
}

/** Combine excess slots while retaining separate Cyberware and Slickware totals. */
export function calculateAugmentationState(actor, { includeItems = false } = {}) {
  const rules = getSlotRules();
  const state = Object.fromEntries(AUGMENTATION_DEFINITIONS.map(definition => {
    const { items, ...slots } = summarizeAugmentation(actor, definition, rules);
    return [definition.id, includeItems ? { ...slots, items } : slots];
  }));
  state.overclocking = AUGMENTATION_DEFINITIONS.reduce(
    (total, definition) => total + state[definition.id].overclocking,
    0
  );
  return state;
}
