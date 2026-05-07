const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const MODULE_ID = "mosh-greybearded-qol";
export const SHORE_LEAVE_CONFIG_SETTING = "shoreLeaveConfig";

export function getDefaultShoreLeaveConfig() {
  return {
    convertStress: {
      noSanitySave: false,
      noStressRelieve: false,
      minStressConversion: false,
      formula: "1d5"
    },
    simpleShoreLeave: {
      randomFlavor: true
    }
  };
}

export function normalizeShoreLeaveConfig(config) {
  const normalized = foundry.utils.deepClone(getDefaultShoreLeaveConfig());

  if (config?.convertStress && typeof config.convertStress === "object") {
    for (const key of ["noSanitySave", "noStressRelieve", "minStressConversion"]) {
      if (typeof config.convertStress[key] === "boolean") normalized.convertStress[key] = config.convertStress[key];
    }
    if (typeof config.convertStress.formula === "string" && config.convertStress.formula.trim()) {
      normalized.convertStress.formula = config.convertStress.formula.trim();
    }
  }

  if (config?.simpleShoreLeave && typeof config.simpleShoreLeave === "object") {
    if (typeof config.simpleShoreLeave.randomFlavor === "boolean") {
      normalized.simpleShoreLeave.randomFlavor = config.simpleShoreLeave.randomFlavor;
    }
  }

  return normalized;
}

export function getNormalizedShoreLeaveConfig() {
  return normalizeShoreLeaveConfig(game.settings.get(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING));
}

export class ShoreLeaveConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "shore-leave-config",
    tag: "form",
    window: {
      title: "MoshQoL.Settings.ShoreLeaveEditor.Name",
      contentClasses: ["greybeardqol", "qol-shore-leave-editor"],
      resizable: true
    },
    position: {
      width: 680,
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
      template: "modules/mosh-greybearded-qol/templates/shore-leave/shore-leave-config.html"
    }
  };

  async _prepareContext() {
    const tiers = game.settings.get(MODULE_ID, "shoreLeaveTiers");
    return {
      options: getNormalizedShoreLeaveConfig(),
      tiers: foundry.utils.deepClone(tiers)
    };
  }

  static async _onResetDefaults(event) {
    event.preventDefault();
    const module = await import("./default-shore-leave-tiers.js");

    await Promise.all([
      game.settings.set(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING, getDefaultShoreLeaveConfig()),
      game.settings.set(MODULE_ID, "shoreLeaveTiers", module.SHORE_LEAVE_TIERS)
    ]);

    this.render();
    ui.notifications.info(game.i18n.localize("MoshQoL.ShoreLeave.Editor.ResetSuccess"));
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const submitted = normalizeShoreLeaveConfig(expanded.shoreLeave ?? {});

    await Promise.all([
      game.settings.set(MODULE_ID, SHORE_LEAVE_CONFIG_SETTING, submitted),
      game.settings.set(MODULE_ID, "shoreLeaveTiers", expanded.tiers)
    ]);

    ui.notifications.info(game.i18n.localize("MoshQoL.ShoreLeave.Editor.UpdateSuccess"));
    this.close();
  }
}
