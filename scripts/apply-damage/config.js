export const APPLY_DAMAGE_ACTOR_SCOPES = ["character", "contractor", "creature"];

export const APPLY_DAMAGE_VISIBILITY = {
  DISABLED: "disabled",
  GM_ONLY: "gmOnly",
  TRUSTED: "trusted",
  EVERYONE: "everyone"
};

export function getDefaultApplyDamageConfig() {
  return {
    tougherArmor: false,
    applyArmorBroken: true,
    visibility: APPLY_DAMAGE_VISIBILITY.GM_ONLY,
    automateWoundRoll: {
      character: true,
      contractor: false,
      creature: false
    }
  };
}
