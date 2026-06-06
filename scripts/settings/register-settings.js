import {
  SHORE_LEAVE_CONFIG_SETTING,
  ShoreLeaveConfigApp,
  getDefaultShoreLeaveConfigWithTiers
} from "./shore-leave-config.js";
import { TOOLBAND_CONFIG_SETTING, ToolbandConfigApp, getDefaultToolbandConfig } from "./toolband-config.js";
import {
  APPLY_DAMAGE_CONFIG_SETTING,
  ApplyDamageConfigApp,
  getDefaultApplyDamageConfig
} from "./apply-damage-config.js";
import { SHORE_LEAVE_TIERS } from "../codex/default-shore-leave-tiers.js";
import { MIGRATION_SETTING_DEFINITIONS } from "../migration/legacy-settings.js";
import {
  MODULE_ID,
  SETTING_APPLY_DAMAGE_TARGET_LOGIC,
  SETTING_ENABLE_CHARACTER_CREATOR,
  SETTING_THEME_COLOR,
  SETTING_THEME_COLOR_OVERRIDE
} from "../codex/constants.js";

const WORLD_SETTING_DEFINITIONS = [
  {
    key: SETTING_THEME_COLOR,
    options: {
      name: "MoshQoL.Settings.ThemeColor.Name",
      hint: "MoshQoL.Settings.ThemeColor.Hint",
      type: String,
      default: "#f50"
    }
  },
  {
    key: SETTING_ENABLE_CHARACTER_CREATOR,
    options: {
      name: "MoshQoL.Settings.EnableCharacterCreator.Name",
      hint: "MoshQoL.Settings.EnableCharacterCreator.Hint",
      type: Boolean,
      default: true
    }
  }
];

const CLIENT_SETTING_DEFINITIONS = [
  {
    key: SETTING_THEME_COLOR_OVERRIDE,
    options: {
      name: "MoshQoL.Settings.ThemeColorOverride.Name",
      hint: "MoshQoL.Settings.ThemeColorOverride.Hint",
      type: String,
      default: ""
    }
  },
  {
    key: SETTING_APPLY_DAMAGE_TARGET_LOGIC,
    options: {
      name: "MoshQoL.Settings.ApplyDamageTargetLogic.Name",
      hint: "MoshQoL.Settings.ApplyDamageTargetLogic.Hint",
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
      default: false,
      type: Boolean
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
        default: getDefaultShoreLeaveConfigWithTiers(SHORE_LEAVE_TIERS)
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
      key: TOOLBAND_CONFIG_SETTING,
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
    game.settings.register(MODULE_ID, menuDefinition.setting.key, {
      scope: "world",
      config: false,
      ...menuDefinition.setting.options
    });
    game.settings.registerMenu(MODULE_ID, menuDefinition.key, menuDefinition.options);
  }

  for (const settingDefinition of WORLD_SETTING_DEFINITIONS) {
    game.settings.register(MODULE_ID, settingDefinition.key, {
      scope: "world",
      ...settingDefinition.options,
      config: true
    });
  }

  for (const settingDefinition of CLIENT_SETTING_DEFINITIONS) {
    game.settings.register(MODULE_ID, settingDefinition.key, {
      scope: "client",
      ...settingDefinition.options,
      config: true
    });
  }

  for (const settingDefinition of MIGRATION_SETTING_DEFINITIONS) {
    game.settings.register(MODULE_ID, settingDefinition.key, {
      scope: "world",
      config: false,
      ...settingDefinition.options
    });
  }
}
