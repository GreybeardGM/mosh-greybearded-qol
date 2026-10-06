import { MODULE_ID, SETTING_APPLY_DAMAGE_CONFIG } from "../codex/constants.js";
import { normalizeEnum } from "../utils/normalization.js";

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

function normalizeApplyDamageConfig(config) {
  const normalized = foundry.utils.deepClone(getDefaultApplyDamageConfig());

  if (config && typeof config === "object") {
    if (typeof config.tougherArmor === "boolean") {
      normalized.tougherArmor = config.tougherArmor;
    }
    if (typeof config.applyArmorBroken === "boolean") {
      normalized.applyArmorBroken = config.applyArmorBroken;
    }
    normalized.visibility = normalizeEnum(
      config.visibility,
      Object.values(APPLY_DAMAGE_VISIBILITY),
      normalized.visibility
    );
    if (config.automateWoundRoll && typeof config.automateWoundRoll === "object") {
      for (const scope of APPLY_DAMAGE_ACTOR_SCOPES) {
        if (typeof config.automateWoundRoll[scope] === "boolean") {
          normalized.automateWoundRoll[scope] = config.automateWoundRoll[scope];
        }
      }
    }
  }

  return normalized;
}

export function getNormalizedApplyDamageConfig() {
  return normalizeApplyDamageConfig(game.settings.get(MODULE_ID, SETTING_APPLY_DAMAGE_CONFIG));
}

export function usesTougherArmorFromConfig(config) {
  return config?.tougherArmor === true;
}

export function appliesArmorBrokenFromConfig(config) {
  return config?.applyArmorBroken === true;
}

export function automatesWoundRollFromConfig(config, scope = "character") {
  return config?.automateWoundRoll?.[scope] === true;
}
