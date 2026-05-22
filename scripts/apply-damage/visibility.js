import {
  APPLY_DAMAGE_VISIBILITY,
  getNormalizedApplyDamageConfig
} from "../settings/apply-damage-config.js";

/**
 * Normalisiert den Apply-Damage-Sichtbarkeitswert aus der Modulkonfiguration.
 */
export function getApplyDamageVisibilitySetting() {
  const value = getNormalizedApplyDamageConfig().visibility;
  return Object.values(APPLY_DAMAGE_VISIBILITY).includes(value)
    ? value
    : APPLY_DAMAGE_VISIBILITY.GM_ONLY;
}
