import { getDefaultTrainingConfig, getNormalizedTrainingConfig } from "../training/config.js";
import { readCurrency } from "../utils/currency.js";
import { normalizeBoolean } from "../utils/normalization.js";
import { MODULE_ID, SETTING_TRAINING_CONFIG } from "../codex/constants.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  resetSettingToDefaults,
  saveSettingAndClose
} from "./settings-app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TrainingConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "training-config",
    title: "MoshQoL.Settings.TrainingConfig.Name",
    submitHandler: this._onSubmit,
    closeOnSubmit: false,
    resetDefaultsHandler: this._onResetDefaults
  });

  static PARTS = createSettingsAppParts("settings/training-config.html");

  async _prepareContext() {
    return appendThemeColor({ config: getNormalizedTrainingConfig() });
  }

  static async _onResetDefaults(event) {
    await resetSettingToDefaults(this, event, {
      moduleId: MODULE_ID,
      settingKey: SETTING_TRAINING_CONFIG,
      defaults: getDefaultTrainingConfig
    });
  }

  static async _onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const submitted = expanded.training ?? {};
    const config = getDefaultTrainingConfig();

    config.useSkillTraining = normalizeBoolean(submitted.useSkillTraining);
    config.autoTrainAfterShoreLeave = normalizeBoolean(submitted.autoTrainAfterShoreLeave);
    for (const rank of Object.keys(config.prices)) {
      const price = await readCurrency(submitted.prices?.[rank], {
        label: game.i18n.localize(`MoshQoL.CharacterCreator.Skills.${rank[0].toUpperCase() + rank.slice(1)}`)
      });
      if (price === null) return; // Do not save any part of this form after cancellation.
      config.prices[rank] = price;
    }

    await saveSettingAndClose(this, MODULE_ID, SETTING_TRAINING_CONFIG, config);
  }
}
