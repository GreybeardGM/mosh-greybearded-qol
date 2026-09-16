import { FLAG_CYBERWARE, FLAG_SLICKWARE } from "../codex/constants.js";
import { MOSH_EQUIPMENT_ITEM_TYPES, MOSH_SLICKWARE_ITEM_TYPES } from "../codex/mosh-system.js";

export const AUGMENTATION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: FLAG_CYBERWARE,
    itemTypes: MOSH_EQUIPMENT_ITEM_TYPES,
    stat: "strength",
    localization: "MoshQoL.Cyberware"
  }),
  Object.freeze({
    id: FLAG_SLICKWARE,
    itemTypes: MOSH_SLICKWARE_ITEM_TYPES,
    stat: "sanity",
    localization: "MoshQoL.Slickware"
  })
]);
