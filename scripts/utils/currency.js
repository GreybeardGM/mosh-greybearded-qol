import { CURRENCY_DIALOG_CLASS, qolWindowClasses, templatePath } from "../codex/constants.js";
import { appendQolThemeContext } from "./application-options.js";
import { classifyCurrency } from "./currency-parser.js";
import { getCreditConfig } from "../currency/config.js";

/**
 * Resolve external currency input. null means cancelled, never zero.
 * Callers must check null before continuing or writing anything. Corrections
 * are returned to the action, never saved to an actor or setting by this utility.
 */
export async function readCurrency(value, { label = "" } = {}) {
  let input = value;
  const notation = getCreditConfig().notation;
  // A loop deliberately replaces recursive dialogs so repeated errors cannot grow the stack.
  while (true) {
    if (getCreditConfig().notation !== notation) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
      return null;
    }
    const parsed = classifyCurrency(input, { notation });
    if (parsed.status === "success") return parsed.value;
    const raw = String(input);
    const content = await foundry.applications.handlebars.renderTemplate(
      templatePath("dialogs/currency-resolution.html"),
      appendQolThemeContext({
        raw, label,
        notationLabel: game.i18n.localize(`MoshQoL.Currency.Notation.${notation}`),
        reason: game.i18n.localize(`MoshQoL.Currency.Errors.${parsed.code}`)
      })
    );
    const buttons = [{
      action: "submit", label: game.i18n.localize("MoshQoL.Currency.Submit"), default: true,
      callback: (_event, button) => ({ input: button.form.elements.currencyInput.value })
    }];
    buttons.push({ action: "cancel", label: game.i18n.localize("MoshQoL.Common.Cancel") });
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MoshQoL.Currency.Title"), contentClasses: qolWindowClasses(CURRENCY_DIALOG_CLASS) },
      content, buttons, modal: true, rejectClose: false
    });
    // Closing, Escape, or an unexpected response must abort just like the Cancel button.
    if (!choice || typeof choice.input !== "string") return null;
    input = choice.input;
  }
}
