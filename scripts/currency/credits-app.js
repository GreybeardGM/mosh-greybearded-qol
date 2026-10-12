import { CREDITS_APP_CLASS, templatePath } from "../codex/constants.js";
import { FEATURE_ACTIONS } from "../codex/feature-actions.js";
import { MOSH_CREDITS_PATH } from "../codex/mosh-system.js";
import { appendQolThemeContext, createQolAppDefaultOptions } from "../utils/application-options.js";
import { classifyCurrency, formatCurrency } from "../utils/currency-parser.js";
import { chatOutput } from "../utils/chat-output.js";
import { CREDIT_OPERATIONS, CREDIT_PAY, CREDIT_RECEIVE, CURRENCY_DIALOG_WIDTH, isCreditHandlerEnabled } from "./config.js";
import { changeCredits } from "./credit-transactions.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CreditsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createQolAppDefaultOptions({
    id: "qol-credits-{id}", title: FEATURE_ACTIONS.credits.labelKey,
    windowClasses: [CREDITS_APP_CLASS], window: { icon: FEATURE_ACTIONS.credits.icon },
    position: { width: CURRENCY_DIALOG_WIDTH },
    form: { handler: () => {}, closeOnSubmit: false },
    actions: { [CREDIT_RECEIVE]: this._onTransaction, [CREDIT_PAY]: this._onTransaction, cancel: this._onCancel }
  });

  static PARTS = { form: { template: templatePath("dialogs/credits.html") } };

  constructor({ actor }, options = {}) {
    super(options);
    this.actor = actor;
    this._busy = false;
    this._cancelled = false;
  }

  async _prepareContext() {
    const raw = foundry.utils.getProperty(this.actor, MOSH_CREDITS_PATH);
    const parsed = classifyCurrency(raw);
    // Opening the app is read-only; only a deliberate transaction opens repairs.
    return appendQolThemeContext({
      actorName: this.actor.name,
      balance: parsed.status === "success" ? formatCurrency(parsed.value) : String(raw ?? ""),
      buttons: Object.entries(CREDIT_OPERATIONS).map(([action, meta]) => ({
        action, icon: meta.icon, label: game.i18n.localize(meta.labelKey)
      }))
    });
  }

  static async _onTransaction(event, target) {
    if (this._busy || this._cancelled) return;
    if (!isCreditHandlerEnabled()) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.Disabled"));
      return;
    }
    const operation = target.dataset.action;
    const input = this.form?.elements.namedItem("creditAmount");
    if (!input) return;
    this._busy = true;
    input.readOnly = true;
    const buttons = this.form.querySelectorAll("[data-credit-operation]");
    buttons.forEach(button => { button.disabled = true; });
    try {
      const result = await changeCredits(this.actor, input.value, {
        operation, allowNegativeAmount: true, canProceed: () => !this._cancelled
      });
      if (!result) return;
      // A successful save consumes this app before posting the receipt. A chat
      // failure must never leave a live button that could repeat the payment.
      this._cancelled = true;
      try {
        await this.close();
        const meta = CREDIT_OPERATIONS[operation];
        const { notation } = result;
        await chatOutput({
          actor: this.actor, title: game.i18n.localize(meta.labelKey), subtitle: this.actor.name, icon: meta.icon,
          blocks: [
            { type: "counter", label: game.i18n.localize("MoshQoL.Currency.App.Amount"), value: formatCurrency(result.amount * meta.sign, { notation }) },
            { type: "counter", label: game.i18n.localize("MoshQoL.Currency.App.Before"), value: formatCurrency(result.before, { notation }) },
            { type: "counter", label: game.i18n.localize("MoshQoL.Currency.App.After"), value: formatCurrency(result.after, { notation }) }
          ]
        });
      } catch (error) {
        console.error("[MoSh QoL] Credit receipt failed", error);
        ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.ChatError"));
      }
    } catch (error) {
      console.error("[MoSh QoL] Credit update failed", error);
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.App.SaveError"));
    } finally {
      this._busy = false;
      input.readOnly = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  static _onCancel() { return this.close(); }

  async close(options = {}) {
    this._cancelled = true;
    return super.close(options);
  }
}
