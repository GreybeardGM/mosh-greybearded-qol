import { CURRENCY_DIALOG_CLASS, MODULE_ID, SETTING_CREDIT_HANDLER_CONFIG, qolWindowClasses, templatePath } from "../codex/constants.js";
import { CURRENCY_NOTATIONS, getCreditConfig, getDefaultCreditConfig } from "../currency/config.js";
import { getAppRoot } from "../utils/application-helpers.js";
import { normalizeBoolean } from "../utils/normalization.js";
import { appendThemeColor, createSettingsAppDefaultOptions, createSettingsAppParts, resetSettingToDefaults, saveSettingAndClose } from "./settings-app-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class CreditHandlerConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createSettingsAppDefaultOptions({
    id: "credit-handler-config",
    title: "MoshQoL.Settings.CreditHandlerConfig.Name",
    submitHandler: this._onSubmit,
    resetDefaultsHandler: this._onResetDefaults,
    closeOnSubmit: false
  });

  static PARTS = createSettingsAppParts("settings/credit-handler-config.html");

  async _prepareContext() {
    const config = getCreditConfig();
    this._notation ??= config.notation;
    return appendThemeColor({
      enabled: config.enabled,
      notations: Object.entries(CURRENCY_NOTATIONS).map(([value, rule]) => ({
        value,
        label: game.i18n.localize(`MoshQoL.Currency.Notation.${value}`),
        example: rule.example,
        selected: value === this._notation
      }))
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const select = getAppRoot(this.element)?.querySelector("select[name='notation']");
    select?.addEventListener("change", () => this._approveNotation(select));
  }

  async _approveNotation(select, requested = select.value) {
    const previous = this._notation ?? getCreditConfig().notation;
    // Restore immediately: only explicit confirmation may accept a new draft value.
    select.value = previous;
    if (this._notationPending || !Object.hasOwn(CURRENCY_NOTATIONS, requested)) return false;
    if (requested === previous) return true;
    this._notationPending = true;
    select.disabled = true;
    try {
      const content = await foundry.applications.handlebars.renderTemplate(
        templatePath("dialogs/currency-notation-warning.html"),
        appendThemeColor({
          from: game.i18n.localize(`MoshQoL.Currency.Notation.${previous}`),
          to: game.i18n.localize(`MoshQoL.Currency.Notation.${requested}`)
        })
      );
      const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("MoshQoL.Currency.Config.WarningTitle"), contentClasses: qolWindowClasses(CURRENCY_DIALOG_CLASS) },
        content,
        buttons: [
          { action: "confirm", label: game.i18n.localize("MoshQoL.Common.Confirm") },
          { action: "cancel", label: game.i18n.localize("MoshQoL.Common.Cancel"), default: true }
        ],
        modal: true,
        rejectClose: false
      });
      if (choice !== "confirm") return false;
      this._notation = requested;
      select.value = requested;
      return true;
    } finally {
      select.disabled = false;
      this._notationPending = false;
    }
  }

  static async _onSubmit(event, form, formData) {
    const notation = formData.object?.notation;
    // Saving while the warning is open or bypassing its change handler cannot apply a new format.
    if (this._notationPending || notation !== (this._notation ?? getCreditConfig().notation)
      || !Object.hasOwn(CURRENCY_NOTATIONS, notation)) return;
    await saveSettingAndClose(this, MODULE_ID, SETTING_CREDIT_HANDLER_CONFIG, {
      enabled: normalizeBoolean(formData.object?.enabled), notation
    });
  }

  static async _onResetDefaults(event) {
    event.preventDefault();
    const select = getAppRoot(this.element)?.querySelector("select[name='notation']");
    if (!select || !await this._approveNotation(select, getDefaultCreditConfig().notation)) return;
    await resetSettingToDefaults(this, event, {
      moduleId: MODULE_ID,
      settingKey: SETTING_CREDIT_HANDLER_CONFIG,
      defaults: getDefaultCreditConfig
    });
  }
}
