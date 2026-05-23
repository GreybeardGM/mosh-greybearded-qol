import {
  SHORE_LEAVE_CONFIG_SETTING,
  ShoreLeaveConfigApp,
  getDefaultShoreLeaveConfig
} from "./shore-leave-config.js";
import { ToolbandConfigApp, getDefaultToolbandConfig } from "./toolband-config.js";
import {
  APPLY_DAMAGE_CONFIG_SETTING,
  ApplyDamageConfigApp,
  getDefaultApplyDamageConfig
} from "./apply-damage-config.js";
import {
  LEGACY_SHIP_CRITS_SETTING,
  SHIP_CRITS_MIGRATION_SETTING
} from "../migration/toolband.js";
import { SHORE_LEAVE_CONFIG_MIGRATION_SETTING } from "../migration/shore-leave.js";
import { SHORE_LEAVE_TIERS } from "../codex/default-shore-leave-tiers.js";

const WORLD_SETTING_DEFINITIONS = [
  {
    key: "themeColor",
    options: {
      name: "MoshQoL.Settings.ThemeColor.Name",
      hint: "MoshQoL.Settings.ThemeColor.Hint",
      config: true,
      type: String,
      default: "#f50"
    }
  },
  {
    key: "shoreLeaveTiers",
    options: {
      name: "MoshQoL.Settings.ShoreLeaveTiers.Name",
      config: false,
      type: Object,
      default: SHORE_LEAVE_TIERS
    }
  },
  {
    key: "enableCharacterCreator",
    options: {
      name: "MoshQoL.Settings.EnableCharacterCreator.Name",
      hint: "MoshQoL.Settings.EnableCharacterCreator.Hint",
      config: true,
      type: Boolean,
      default: true
    }
  }
];

const CLIENT_SETTING_DEFINITIONS = [
  {
    key: "themeColorOverride",
    options: {
      name: "MoshQoL.Settings.ThemeColorOverride.Name",
      hint: "MoshQoL.Settings.ThemeColorOverride.Hint",
      config: true,
      type: String,
      default: ""
    }
  },
  {
    key: "applyDamageTargetLogic",
    options: {
      name: "MoshQoL.Settings.ApplyDamageTargetLogic.Name",
      hint: "MoshQoL.Settings.ApplyDamageTargetLogic.Hint",
      config: true,
      type: String,
      choices: {
        alwaysCharacter: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.AlwaysCharacter",
        alwaysToken: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.AlwaysToken",
        characterFirst: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.CharacterFirst",
        tokenFirst: "MoshQoL.Settings.ApplyDamageTargetLogic.Choices.TokenFirst"
      },
      default: "alwaysCharacter"
    }
  },
  {
    key: "simpleShoreLeave.disableFlavor",
    options: {
      name: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Name",
      hint: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Hint",
      config: true,
      default: false,
      type: Boolean
    }
  }
];

const MIGRATION_SETTING_DEFINITIONS = [
  {
    key: "convertStress.noSanitySave",
    options: {
      name: "MoshQoL.Settings.ConvertStress.NoSanitySave.Name",
      hint: "MoshQoL.Settings.ConvertStress.NoSanitySave.Hint",
      type: Boolean,
      default: false
    }
  },
  {
    key: "convertStress.noStressRelieve",
    options: {
      name: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Name",
      hint: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Hint",
      type: Boolean,
      default: false
    }
  },
  {
    key: "convertStress.minStressConversion",
    options: {
      name: "MoshQoL.Settings.ConvertStress.MinStressConversion.Name",
      hint: "MoshQoL.Settings.ConvertStress.MinStressConversion.Hint",
      type: Boolean,
      default: false
    }
  },
  {
    key: "convertStress.formula",
    options: {
      name: "MoshQoL.Settings.ConvertStress.Formula.Name",
      hint: "MoshQoL.Settings.ConvertStress.Formula.Hint",
      type: String,
      default: "1d5"
    }
  },
  {
    key: "simpleShoreLeave.randomFlavor",
    options: {
      name: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Name",
      hint: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Hint",
      type: Boolean,
      default: true
    }
  },
  {
    key: LEGACY_SHIP_CRITS_SETTING,
    options: {
      name: "MoshQoL.Settings.EnableShipCrits.Name",
      hint: "MoshQoL.Settings.EnableShipCrits.Hint",
      type: Boolean,
      default: false
    }
  },
  {
    key: SHIP_CRITS_MIGRATION_SETTING,
    options: {
      type: Boolean,
      default: false
    }
  },
  {
    key: SHORE_LEAVE_CONFIG_MIGRATION_SETTING,
    options: {
      type: Boolean,
      default: false
    }
  }
];

const MENU_DEFINITIONS = [
  {
    key: "shoreLeaveEditor",
    options: {
      name: "MoshQoL.Settings.ShoreLeaveEditor.Name",
      label: "MoshQoL.Settings.ShoreLeaveEditor.Label",
      hint: "MoshQoL.Settings.ShoreLeaveEditor.Hint",
      icon: "fas fa-edit",
      type: ShoreLeaveConfigApp,
      restricted: true
    },
    setting: {
      key: SHORE_LEAVE_CONFIG_SETTING,
      options: {
        name: "MoshQoL.Common.ShoreLeaveConfiguration",
        type: Object,
        default: getDefaultShoreLeaveConfig()
      }
    }
  },
  {
    key: "toolbandConfigMenu",
    options: {
      name: "MoshQoL.Settings.ToolbandConfig.Name",
      label: "MoshQoL.Settings.ToolbandConfig.Label",
      hint: "MoshQoL.Settings.ToolbandConfig.Hint",
      icon: "fas fa-toolbox",
      type: ToolbandConfigApp,
      restricted: true
    },
    setting: {
      key: "toolbandConfig",
      options: {
        name: "MoshQoL.Settings.ToolbandConfig.SettingName",
        type: Object,
        default: getDefaultToolbandConfig()
      }
    }
  },
  {
    key: "applyDamageConfigMenu",
    options: {
      name: "MoshQoL.Settings.ApplyDamageConfig.Name",
      label: "MoshQoL.Settings.ApplyDamageConfig.Label",
      hint: "MoshQoL.Settings.ApplyDamageConfig.Hint",
      icon: "fas fa-heart-broken",
      type: ApplyDamageConfigApp,
      restricted: true
    },
    setting: {
      key: APPLY_DAMAGE_CONFIG_SETTING,
      options: {
        name: "MoshQoL.Settings.ApplyDamageConfig.SettingName",
        type: Object,
        default: getDefaultApplyDamageConfig()
      }
    }
  }
];

export function registerSettings() {
  for (const menuDefinition of MENU_DEFINITIONS) {
    game.settings.register("mosh-greybearded-qol", menuDefinition.setting.key, {
      scope: "world",
      config: false,
      ...menuDefinition.setting.options
    });
    game.settings.registerMenu("mosh-greybearded-qol", menuDefinition.key, menuDefinition.options);
  }

  for (const settingDefinition of WORLD_SETTING_DEFINITIONS) {
    game.settings.register("mosh-greybearded-qol", settingDefinition.key, {
      scope: "world",
      ...settingDefinition.options
    });
  }

  for (const settingDefinition of CLIENT_SETTING_DEFINITIONS) {
    game.settings.register("mosh-greybearded-qol", settingDefinition.key, {
      scope: "client",
      ...settingDefinition.options
    });
  }

  for (const settingDefinition of MIGRATION_SETTING_DEFINITIONS) {
    game.settings.register("mosh-greybearded-qol", settingDefinition.key, {
      scope: "world",
      config: false,
      ...settingDefinition.options
    });
  }
}
