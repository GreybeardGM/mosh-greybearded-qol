import { MODULE_ID } from "../codex/constants.js";
import { normalizeBoolean, normalizeNumber } from "../utils/normalization.js";
import { AUGMENTATION_DEFINITIONS } from "./config.js";

export function getAugmentation(item, definition) {
  const flags = item.getFlag(MODULE_ID, definition.id) ?? {};
  return {
    enabled: normalizeBoolean(flags.enabled),
    slots: normalizeNumber(flags.slots, { min: 0, max: 9 }),
    notes: String(flags.notes ?? "")
  };
}

/** Count each enabled embedded document once, irrespective of quantity/equipped. */
function summarizeAugmentation(actor, definition) {
  const items = [];
  let used = 0;
  for (const item of actor.items) {
    if (!definition.itemTypes.includes(item.type)) continue;
    const augmentation = getAugmentation(item, definition);
    if (!augmentation.enabled) continue;
    items.push(item);
    used += augmentation.slots;
  }
  const statKey = actor.type === "creature" ? "instinct" : definition.stat;
  const stat = normalizeNumber(actor.system.stats?.[statKey]?.value, { min: 0 });
  const max = Math.floor(stat / 10);
  return { items, used, max, overclocking: Math.max(0, used - max) };
}

export function getAugmentationItems(actor, definition) {
  return summarizeAugmentation(actor, definition).items;
}

export function calculateAugmentationSlots(actor, definition) {
  const { items, ...slots } = summarizeAugmentation(actor, definition);
  return slots;
}

/** Combine excess slots while retaining separate Cyberware and Slickware totals. */
export function calculateAugmentationState(actor, { includeItems = false } = {}) {
  const state = Object.fromEntries(AUGMENTATION_DEFINITIONS.map(definition => {
    const { items, ...slots } = summarizeAugmentation(actor, definition);
    return [definition.id, includeItems ? { ...slots, items } : slots];
  }));
  state.overclocking = AUGMENTATION_DEFINITIONS.reduce(
    (total, definition) => total + state[definition.id].overclocking,
    0
  );
  return state;
}
