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

export function registerSettings() {
  game.settings.register("mosh-greybearded-qol", "themeColor", {
    name: "MoshQoL.Settings.ThemeColor.Name",
    hint: "MoshQoL.Settings.ThemeColor.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "#f50"
  });

  game.settings.register("mosh-greybearded-qol", "themeColorOverride", {
    name: "MoshQoL.Settings.ThemeColorOverride.Name",
    hint: "MoshQoL.Settings.ThemeColorOverride.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.noSanitySave", {
    name: "MoshQoL.Settings.ConvertStress.NoSanitySave.Name",
    hint: "MoshQoL.Settings.ConvertStress.NoSanitySave.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.noStressRelieve", {
    name: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Name",
    hint: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.minStressConversion", {
    name: "MoshQoL.Settings.ConvertStress.MinStressConversion.Name",
    hint: "MoshQoL.Settings.ConvertStress.MinStressConversion.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.formula", {
    name: "MoshQoL.Settings.ConvertStress.Formula.Name",
    hint: "MoshQoL.Settings.ConvertStress.Formula.Hint",
    scope: "world",
    config: false,
    default: "1d5",
    type: String
  });

  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.randomFlavor", {
    name: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Name",
    hint: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Hint",
    scope: "world",
    config: false,
    default: true,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.disableFlavor", {
    name: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Name",
    hint: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Hint",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", SHORE_LEAVE_CONFIG_SETTING, {
    name: "MoshQoL.Common.ShoreLeaveConfiguration",
    scope: "world",
    config: false,
    type: Object,
    default: getDefaultShoreLeaveConfig()
  });

  game.settings.register("mosh-greybearded-qol", "shoreLeaveTiers", {
    name: "MoshQoL.Settings.ShoreLeaveTiers.Name",
    scope: "world",
    config: false,
    type: Object,
    default: SHORE_LEAVE_TIERS
  });

  game.settings.registerMenu("mosh-greybearded-qol", "shoreLeaveEditor", {
    name: "MoshQoL.Settings.ShoreLeaveEditor.Name",
    label: "MoshQoL.Settings.ShoreLeaveEditor.Label",
    hint: "MoshQoL.Settings.ShoreLeaveEditor.Hint",
    icon: "fas fa-edit",
    type: ShoreLeaveConfigApp,
    restricted: true
  });

  game.settings.register("mosh-greybearded-qol", "toolbandConfig", {
    name: "MoshQoL.Settings.ToolbandConfig.SettingName",
    scope: "world",
    config: false,
    type: Object,
    default: getDefaultToolbandConfig()
  });

  game.settings.registerMenu("mosh-greybearded-qol", "toolbandConfigMenu", {
    name: "MoshQoL.Settings.ToolbandConfig.Name",
    label: "MoshQoL.Settings.ToolbandConfig.Label",
    hint: "MoshQoL.Settings.ToolbandConfig.Hint",
    icon: "fas fa-toolbox",
    type: ToolbandConfigApp,
    restricted: true
  });

  game.settings.register("mosh-greybearded-qol", APPLY_DAMAGE_CONFIG_SETTING, {
    name: "MoshQoL.Settings.ApplyDamageConfig.SettingName",
    scope: "world",
    config: false,
    type: Object,
    default: getDefaultApplyDamageConfig()
  });

  game.settings.registerMenu("mosh-greybearded-qol", "applyDamageConfigMenu", {
    name: "MoshQoL.Settings.ApplyDamageConfig.Name",
    label: "MoshQoL.Settings.ApplyDamageConfig.Label",
    hint: "MoshQoL.Settings.ApplyDamageConfig.Hint",
    icon: "fas fa-heart-broken",
    type: ApplyDamageConfigApp,
    restricted: true
  });

  game.settings.register("mosh-greybearded-qol", "enableCharacterCreator", {
    name: "MoshQoL.Settings.EnableCharacterCreator.Name",
    hint: "MoshQoL.Settings.EnableCharacterCreator.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("mosh-greybearded-qol", LEGACY_SHIP_CRITS_SETTING, {
    name: "MoshQoL.Settings.EnableShipCrits.Name",
    hint: "MoshQoL.Settings.EnableShipCrits.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register("mosh-greybearded-qol", SHIP_CRITS_MIGRATION_SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register("mosh-greybearded-qol", SHORE_LEAVE_CONFIG_MIGRATION_SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
}
