import { getThemeColor } from "../utils/get-theme-color.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const MODULE_ID = "mosh-greybearded-qol";
export const APPLY_DAMAGE_CONFIG_SETTING = "applyDamageConfig";

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

export function normalizeApplyDamageConfig(config) {
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
  return normalizeApplyDamageConfig(game.settings.get(MODULE_ID, APPLY_DAMAGE_CONFIG_SETTING));
}

export function usesTougherArmor() {
  return usesTougherArmorFromConfig(getNormalizedApplyDamageConfig());
}

export function automatesWoundRoll(scope = "character") {
  return automatesWoundRollFromConfig(getNormalizedApplyDamageConfig(), scope);
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

function isSubmittedCheckboxEnabled(value) {
  return value === true || value === "true" || value === "on";
}

export class ApplyDamageConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "apply-damage-config",
    tag: "form",
    window: {
      title: "MoshQoL.Settings.ApplyDamageConfig.Name",
      contentClasses: ["greybeardqol", "qol-ui", "qolsettings-window"],
      resizable: true
    },
    position: {
      width: 550,
      height: "auto"
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      resetDefaults: this._onResetDefaults
    }
  };

  static PARTS = {
    form: {
      template: "modules/mosh-greybearded-qol/templates/settings/apply-damage-config.html"
    }
  };

  async _prepareContext() {
    return {
      config: getNormalizedApplyDamageConfig(),
      themeColor: getThemeColor(),
      visibilityChoices: [
        { value: APPLY_DAMAGE_VISIBILITY.DISABLED, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.Disabled") },
        { value: APPLY_DAMAGE_VISIBILITY.GM_ONLY, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.GMOnly") },
        { value: APPLY_DAMAGE_VISIBILITY.TRUSTED, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.TrustedPlayer") },
        { value: APPLY_DAMAGE_VISIBILITY.EVERYONE, label: game.i18n.localize("MoshQoL.Settings.ApplyDamageVisibility.Choices.Everyone") }
      ]
    };
  }

  static async _onResetDefaults(event) {
    event.preventDefault();
    await game.settings.set(MODULE_ID, APPLY_DAMAGE_CONFIG_SETTING, getDefaultApplyDamageConfig());
    this.render();
    ui.notifications.info(game.i18n.localize("MoshQoL.Damage.Config.ResetSuccess"));
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const submitted = expanded.applyDamage ?? {};
    const config = getDefaultApplyDamageConfig();

    const tougherArmor = submitted.tougherArmor;
    config.tougherArmor = isSubmittedCheckboxEnabled(tougherArmor);

    const applyArmorBroken = submitted.applyArmorBroken;
    config.applyArmorBroken = isSubmittedCheckboxEnabled(applyArmorBroken);

    const visibility = submitted.visibility;
    config.visibility = Object.values(APPLY_DAMAGE_VISIBILITY).includes(visibility)
      ? visibility
      : APPLY_DAMAGE_VISIBILITY.GM_ONLY;

    const automateWoundRoll = submitted.automateWoundRoll ?? {};
    for (const scope of APPLY_DAMAGE_ACTOR_SCOPES) {
      config.automateWoundRoll[scope] = isSubmittedCheckboxEnabled(automateWoundRoll[scope]);
    }

    await game.settings.set(MODULE_ID, APPLY_DAMAGE_CONFIG_SETTING, config);
    ui.notifications.info(game.i18n.localize("MoshQoL.Damage.Config.UpdateSuccess"));
    this.close();
  }
}
