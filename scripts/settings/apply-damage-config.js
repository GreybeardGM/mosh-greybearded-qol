const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const MODULE_ID = "mosh-greybearded-qol";
export const APPLY_DAMAGE_CONFIG_SETTING = "applyDamageConfig";

export function getDefaultApplyDamageConfig() {
  return {
    tougherArmor: false,
    automateWoundRoll: true
  };
}

export function normalizeApplyDamageConfig(config) {
  const normalized = foundry.utils.deepClone(getDefaultApplyDamageConfig());

  if (config && typeof config === "object") {
    if (typeof config.tougherArmor === "boolean") {
      normalized.tougherArmor = config.tougherArmor;
    }
    if (typeof config.automateWoundRoll === "boolean") {
      normalized.automateWoundRoll = config.automateWoundRoll;
    }
  }

  return normalized;
}

export function getNormalizedApplyDamageConfig() {
  return normalizeApplyDamageConfig(game.settings.get(MODULE_ID, APPLY_DAMAGE_CONFIG_SETTING));
}

export function usesTougherArmor() {
  return getNormalizedApplyDamageConfig().tougherArmor === true;
}

export function automatesWoundRoll() {
  return getNormalizedApplyDamageConfig().automateWoundRoll === true;
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
      contentClasses: ["greybeardqol", "qolsettings-window"],
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
      description: game.i18n.localize("MoshQoL.Damage.Config.Description")
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

    const automateWoundRoll = submitted.automateWoundRoll;
    config.automateWoundRoll = isSubmittedCheckboxEnabled(automateWoundRoll);

    await game.settings.set(MODULE_ID, APPLY_DAMAGE_CONFIG_SETTING, config);
    ui.notifications.info(game.i18n.localize("MoshQoL.Damage.Config.UpdateSuccess"));
    this.close();
  }
}
