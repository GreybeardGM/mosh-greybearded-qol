// scripts/codex/mosh-system.js
// Mothership system-/rules-facing constants used by Greybearded QoL integrations.

export const MOSH_PSG_MODULE_ID = "fvtt_mosh_1e_psg";
export const MOSH_ROLLTABLE_PACK_ID = "mosh.rolltables_1e";
export const MOSH_FALLBACK_ACTOR_IMAGE = "icons/svg/mystery-man.svg";
export const MOSH_ITEM_TYPE_CLASS = "class";
export const MOSH_ITEM_TYPE_SKILL = "skill";

export const MOSH_LOADOUT_ROLLTABLE_IMAGES = Object.freeze({
  Loadout: `modules/${MOSH_PSG_MODULE_ID}/icons/rolltables/loadouts.png`,
  Patches: `modules/${MOSH_PSG_MODULE_ID}/icons/rolltables/patch.png`,
  Trinkets: `modules/${MOSH_PSG_MODULE_ID}/icons/rolltables/trinket.png`
});

export const MOSH_INDEX_ONLY_ITEM_TYPES = Object.freeze([MOSH_ITEM_TYPE_SKILL, MOSH_ITEM_TYPE_CLASS]);
export const MOSH_HOT_CACHE_ITEM_TYPES = Object.freeze([MOSH_ITEM_TYPE_SKILL, MOSH_ITEM_TYPE_CLASS]);
export const MOSH_LOADOUT_CLEAR_ITEM_TYPES = Object.freeze(["weapon", "armor", "item"]);

export const MOSH_STARTING_CREDITS_FORMULA = "2d10 * 10";
