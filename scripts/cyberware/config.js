import { FLAG_CYBERWARE, FLAG_SLICKWARE, MODULE_ID, SETTING_CYBERWARE_SLOT_RULES } from "../codex/constants.js";
import { MOSH_EQUIPMENT_ITEM_TYPES, MOSH_SLICKWARE_ITEM_TYPES } from "../codex/mosh-system.js";
import { normalizeEnum, normalizeNumber } from "../utils/normalization.js";

export const SLOT_ACTOR_TYPES = Object.freeze({ character: "character", contractor: "contractor" });
export const SLOT_ATTRIBUTES = Object.freeze({
  character: Object.freeze(["none", "strength", "speed", "intellect", "combat", "sanity", "fear", "body"]),
  contractor: Object.freeze(["none", "combat", "instinct", "loyalty"])
});
export const SLOT_ROUNDING = Object.freeze(["floor", "ceil", "round"]);

export function getDefaultSlotRules() {
  const rule = attribute => ({ attribute, multiplier: 0.1, rounding: "floor", bonus: 0 });
  return {
    character: { [FLAG_CYBERWARE]: rule("strength"), [FLAG_SLICKWARE]: rule("intellect") },
    contractor: { [FLAG_CYBERWARE]: rule("instinct"), [FLAG_SLICKWARE]: rule("instinct") }
  };
}

export function normalizeSlotRules(value) {
  const rules = getDefaultSlotRules();
  for (const [actorType, definitions] of Object.entries(rules)) {
    for (const [id, defaults] of Object.entries(definitions)) {
      const submitted = value?.[actorType]?.[id];
      rules[actorType][id] = {
        attribute: normalizeEnum(submitted?.attribute, SLOT_ATTRIBUTES[actorType], defaults.attribute),
        multiplier: normalizeNumber(submitted?.multiplier ?? defaults.multiplier, { fallback: defaults.multiplier, integer: false, min: 0 }),
        rounding: normalizeEnum(submitted?.rounding, SLOT_ROUNDING, defaults.rounding),
        bonus: normalizeNumber(submitted?.bonus ?? defaults.bonus, { fallback: defaults.bonus })
      };
    }
  }
  return rules;
}

export function getSlotRules() {
  return normalizeSlotRules(game.settings.get(MODULE_ID, SETTING_CYBERWARE_SLOT_RULES));
}

export function getSlotRule(actor, definition, rules = getSlotRules()) {
  const actorType = actor.type === "creature" ? SLOT_ACTOR_TYPES.contractor : SLOT_ACTOR_TYPES.character;
  return rules[actorType][definition.id];
}

/** The flat bonus is applied after rounding; "none" uses the bonus alone. */
export function calculateSlotMaximum(actor, definition, rules = getSlotRules()) {
  const { attribute, multiplier, rounding, bonus } = getSlotRule(actor, definition, rules);
  const stat = attribute === "none" ? 0 : normalizeNumber(actor.system.stats?.[attribute]?.value, { min: 0 });
  return Math.max(0, Math[rounding](stat * multiplier) + bonus);
}

export const AUGMENTATION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: FLAG_CYBERWARE,
    itemTypes: MOSH_EQUIPMENT_ITEM_TYPES,
    localization: "MoshQoL.Cyberware"
  }),
  Object.freeze({
    id: FLAG_SLICKWARE,
    itemTypes: MOSH_SLICKWARE_ITEM_TYPES,
    localization: "MoshQoL.Slickware"
  })
]);
