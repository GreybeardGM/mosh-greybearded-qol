import { getNormalizedApplyDamageConfig } from "../settings/apply-damage-config.js";

export const APPLY_DAMAGE_VISIBILITY = {
  DISABLED: "disabled",
  GM_ONLY: "gmOnly",
  TRUSTED: "trusted",
  EVERYONE: "everyone"
};

export function getApplyDamageVisibilitySetting() {
  const value = getNormalizedApplyDamageConfig().visibility;
  return Object.values(APPLY_DAMAGE_VISIBILITY).includes(value)
    ? value
    : APPLY_DAMAGE_VISIBILITY.GM_ONLY;
}

export function canCurrentUserSeeApplyDamageButtons() {
  const visibility = getApplyDamageVisibilitySetting();
  if (visibility === APPLY_DAMAGE_VISIBILITY.DISABLED) return false;
  if (game.user?.isGM) return true;
  if (visibility === APPLY_DAMAGE_VISIBILITY.EVERYONE) return true;
  if (visibility === APPLY_DAMAGE_VISIBILITY.TRUSTED) return game.user?.isTrusted === true;
  return false;
}
