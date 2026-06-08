import { assetPath, STATUS_ARMOR_BROKEN } from "../codex/constants.js";

export function registerStatusEffects() {
  const customStatus = {
    id: STATUS_ARMOR_BROKEN,
    name: "MoshQoL.Status.BrokenArmor",
    img: assetPath("icons/status/armor-broken.svg")
  };

  if (!CONFIG.statusEffects.some(e => e.id === customStatus.id)) {
    CONFIG.statusEffects.push(customStatus);
  }
}
