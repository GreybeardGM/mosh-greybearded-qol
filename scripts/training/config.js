import { MODULE_ID, SETTING_TRAINING_CONFIG } from "../codex/constants.js";

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
      // Preserve stored currency input for explicit resolution; invalid values
      // must never silently turn into defaults or zero.
      if (Object.hasOwn(config.prices ?? {}, rank)) normalized.prices[rank] = config.prices[rank];
    }
  }

  return normalized;
}

export function getNormalizedTrainingConfig() {
  return normalizeTrainingConfig(game.settings.get(MODULE_ID, SETTING_TRAINING_CONFIG));
}
