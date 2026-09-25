import { MODULE_ID, SETTING_CYBERWARE_SLOT_RULES, SETTING_ENABLE_CYBERWARE } from "../codex/constants.js";
import { AUGMENTATION_DEFINITIONS, getDefaultSlotRules, getSlotRules, normalizeSlotRules, SLOT_ATTRIBUTES, SLOT_ROUNDING } from "../cyberware/config.js";
import { normalizeBoolean } from "../utils/normalization.js";
import {
  appendThemeColor,
  createSettingsAppDefaultOptions,
  createSettingsAppParts,
  resetSettingToDefaults,
  saveSettingAndClose
} from "./settings-app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CyberwareConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "cyberware-config",
    title: "MoshQoL.Settings.CyberwareConfig.Name",
    submitHandler: this._onSubmit,
    resetDefaultsHandler: this._onResetDefaults
  });

  static PARTS = createSettingsAppParts("settings/cyberware-config.html");

  async _prepareContext() {
    const rules = getSlotRules();
    const groups = Object.entries(SLOT_ATTRIBUTES).map(([actorType, attributes]) => ({
      actorType,
      label: game.i18n.localize(`MoshQoL.Cyberware.Config.${actorType === "character" ? "Characters" : "Contractors"}`),
      entries: AUGMENTATION_DEFINITIONS.map(definition => {
        const rule = rules[actorType][definition.id];
        return {
          id: definition.id,
          label: game.i18n.localize(`${definition.localization}.Label`),
          rule,
          attributes: attributes.map(value => ({
            value,
            label: game.i18n.localize(value === "none" ? "MoshQoL.Cyberware.Config.None"
              : ["sanity", "fear", "body"].includes(value) ? `MoshQoL.Attributes.${value[0].toUpperCase()}${value.slice(1)}`
                : `Mosh.${value[0].toUpperCase()}${value.slice(1)}`),
            selected: value === rule.attribute
          })),
          rounding: SLOT_ROUNDING.map(value => ({
            value,
            label: game.i18n.localize(`MoshQoL.Cyberware.Config.Rounding.${value}`),
            selected: value === rule.rounding
          }))
        };
      })
    }));
    return appendThemeColor({
      enabled: game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE),
      groups
    });
  }

  static async _onResetDefaults(event) {
    event.preventDefault();
    await game.settings.set(MODULE_ID, SETTING_CYBERWARE_SLOT_RULES, getDefaultSlotRules());
    await resetSettingToDefaults(this, event, {
      moduleId: MODULE_ID,
      settingKey: SETTING_ENABLE_CYBERWARE,
      defaults: () => false
    });
  }

  static async _onSubmit(event, form, formData) {
    const enabled = normalizeBoolean(formData.object?.enabled);
    const rules = normalizeSlotRules(foundry.utils.expandObject(formData.object ?? {}).rules);
    await game.settings.set(MODULE_ID, SETTING_CYBERWARE_SLOT_RULES, rules);
    await saveSettingAndClose(this, MODULE_ID, SETTING_ENABLE_CYBERWARE, enabled);
  }
}
