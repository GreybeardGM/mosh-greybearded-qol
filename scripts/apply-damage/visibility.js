import {
  APPLY_DAMAGE_VISIBILITY,
  getNormalizedApplyDamageConfig
} from "../settings/apply-damage-config.js";
import { normalizeEnum } from "../utils/normalization.js";

/**
 * Normalisiert den Apply-Damage-Sichtbarkeitswert aus der Modulkonfiguration.
 */
export function getApplyDamageVisibilitySetting() {
  const value = getNormalizedApplyDamageConfig().visibility;
  return normalizeEnum(
    value,
    Object.values(APPLY_DAMAGE_VISIBILITY),
    APPLY_DAMAGE_VISIBILITY.GM_ONLY
  );
}
