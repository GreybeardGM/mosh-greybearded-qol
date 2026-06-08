import { normalizeBoolean } from "../utils/normalization.js";
import { MODULE_ID, SETTING_APPLY_DAMAGE_CONFIG } from "../codex/constants.js";
import {
  APPLY_DAMAGE_ACTOR_SCOPES,
  APPLY_DAMAGE_VISIBILITY,
  getDefaultApplyDamageConfig
} from "../apply-damage/config.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  resetSettingToDefaults,
  setSettingAndNotify
} from "./settings-app-helpers.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function normalizeApplyDamageConfig(config) {
  const normalized = foundry.utils.deepClone(getDefaultApplyDamageConfig());

  if (config && typeof config === "object") {
    if (typeof config.tougherArmor === "boolean") {
      normalized.tougherArmor = config.tougherArmor;
    }
    if (typeof config.applyArmorBroken === "boolean") {
      normalized.applyArmorBroken = config.applyArmorBroken;
    }
    if (Object.values(APPLY_DAMAGE_VISIBILITY).includes(config.visibility)) {
      normalized.visibility = config.visibility;
    }
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

export class ApplyDamageConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "apply-damage-config",
    title: "MoshQoL.Settings.ApplyDamageConfig.Name",
    submitHandler: this._onSubmit,
    resetDefaultsHandler: this._onResetDefaults
  });

  static PARTS = createSettingsAppParts("settings/apply-damage-config.html");

  async _prepareContext() {
    return appendThemeColor({
      config: getNormalizedApplyDamageConfig(),
      visibilityChoices: [
        { value: APPLY_DAMAGE_VISIBILITY.DISABLED, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.Disabled") },
        { value: APPLY_DAMAGE_VISIBILITY.GM_ONLY, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.GMOnly") },
        { value: APPLY_DAMAGE_VISIBILITY.TRUSTED, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.TrustedPlayer") },
        { value: APPLY_DAMAGE_VISIBILITY.EVERYONE, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.Everyone") }
      ]
    });
  }

  static async _onResetDefaults(event) {
    await resetSettingToDefaults(this, event, {
      moduleId: MODULE_ID,
      settingKey: SETTING_APPLY_DAMAGE_CONFIG,
      defaults: getDefaultApplyDamageConfig,
      notificationKey: "MoshQoL.Damage.Config.ResetSuccess"
    });
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const submitted = expanded.applyDamage ?? {};
    const config = getDefaultApplyDamageConfig();

    const tougherArmor = submitted.tougherArmor;
    config.tougherArmor = normalizeBoolean(tougherArmor);

    const applyArmorBroken = submitted.applyArmorBroken;
    config.applyArmorBroken = normalizeBoolean(applyArmorBroken);

    const visibility = submitted.visibility;
    config.visibility = Object.values(APPLY_DAMAGE_VISIBILITY).includes(visibility)
      ? visibility
      : APPLY_DAMAGE_VISIBILITY.GM_ONLY;

    const automateWoundRoll = submitted.automateWoundRoll ?? {};
    for (const scope of APPLY_DAMAGE_ACTOR_SCOPES) {
      config.automateWoundRoll[scope] = normalizeBoolean(automateWoundRoll[scope]);
    }

    await setSettingAndNotify(MODULE_ID, SETTING_APPLY_DAMAGE_CONFIG, config, "MoshQoL.Damage.Config.UpdateSuccess");
    this.close();
  }
}
