export function registerStatusEffects() {
  const customStatus = {
    id: "qol-broken-armor",
    name: "MoshQoL.Status.BrokenArmor",
    img: "modules/mosh-greybearded-qol/assets/icons/status/armor-broken.svg"
  };

  if (!CONFIG.statusEffects.some(e => e.id === customStatus.id)) {
    CONFIG.statusEffects.push(customStatus);
  }
}
