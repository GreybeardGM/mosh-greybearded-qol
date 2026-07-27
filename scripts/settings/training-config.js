import { normalizeBoolean, normalizeNumber } from "../utils/normalization.js";
import { MODULE_ID, SETTING_TRAINING_CONFIG } from "../codex/constants.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  resetSettingToDefaults,
  saveSettingAndClose
} from "./settings-app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export function getDefaultTrainingConfig() {
  return {
    useSkillTraining: true,
    autoTrainAfterShoreLeave: false,
    prices: {
      trained: 10_000,
      expert: 50_000,
      master: 200_000
    }
  };
}

function normalizeTrainingConfig(config) {
  const normalized = getDefaultTrainingConfig();

  if (config && typeof config === "object") {
    if (typeof config.useSkillTraining === "boolean") {
      normalized.useSkillTraining = config.useSkillTraining;
    }
    if (typeof config.autoTrainAfterShoreLeave === "boolean") {
      normalized.autoTrainAfterShoreLeave = config.autoTrainAfterShoreLeave;
    }
    for (const rank of Object.keys(normalized.prices)) {
      normalized.prices[rank] = normalizeNumber(config.prices?.[rank], {
        fallback: normalized.prices[rank],
        min: 0
      });
    }
  }

  return normalized;
}

export function getNormalizedTrainingConfig() {
  return normalizeTrainingConfig(game.settings.get(MODULE_ID, SETTING_TRAINING_CONFIG));
}

export class TrainingConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "training-config",
    title: "MoshQoL.Settings.TrainingConfig.Name",
    submitHandler: this._onSubmit,
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
      config.prices[rank] = normalizeNumber(submitted.prices?.[rank], {
        fallback: config.prices[rank],
        min: 0
      });
    }

    await saveSettingAndClose(this, MODULE_ID, SETTING_TRAINING_CONFIG, config);
  }
}
