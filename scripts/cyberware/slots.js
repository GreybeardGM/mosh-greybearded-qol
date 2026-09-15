import { FLAG_CYBERWARE, MODULE_ID } from "../codex/constants.js";
import { MOSH_EQUIPMENT_ITEM_TYPES } from "../codex/mosh-system.js";
import { normalizeBoolean, normalizeNumber } from "../utils/normalization.js";

export function getCyberware(item) {
  const flags = item.getFlag(MODULE_ID, FLAG_CYBERWARE) ?? {};
  return {
    enabled: normalizeBoolean(flags.enabled),
    slots: normalizeNumber(flags.slots, { min: 0 }),
    notes: String(flags.notes ?? "")
  };
}

/** Keep the item shortcuts and slot calculation on the same equipment selection. */
export function getCyberwareItems(actor) {
  return actor.items.filter(item => MOSH_EQUIPMENT_ITEM_TYPES.includes(item.type)
    && getCyberware(item).enabled);
}

/** Count each enabled equipment document once, irrespective of quantity/equipped. */
export function calculateCyberwareSlots(actor) {
  let used = 0;
  for (const item of getCyberwareItems(actor)) used += getCyberware(item).slots;
  const strength = normalizeNumber(actor.system.stats?.strength?.value, { min: 0 });
  const max = Math.floor(strength / 10);
  return { used, max, overclocking: Math.max(0, used - max) };
}
