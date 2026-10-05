import { CURRENCY_DIALOG_CLASS, qolWindowClasses, templatePath } from "../codex/constants.js";
import { appendQolThemeContext } from "./application-options.js";
import { classifyCurrency } from "./currency-parser.js";

/**
 * Resolve external currency input. null means cancelled, never zero.
 * Callers must check null before continuing or writing anything. Corrections
 * are returned to the action, never saved to an actor or setting by this utility.
 */
export async function readCurrency(value, { label = "" } = {}) {
  let input = value;
  let notation = null;
  // A loop deliberately replaces recursive dialogs so repeated errors cannot grow the stack.
  while (true) {
    const parsed = classifyCurrency(input, { notation });
    if (parsed.status === "success") return parsed.value;
    const ambiguous = parsed.status === "unclear";
    const raw = String(input);
    const content = await foundry.applications.handlebars.renderTemplate(
      templatePath("dialogs/currency-resolution.html"),
      appendQolThemeContext({
        ambiguous, raw, label,
        reason: ambiguous ? "" : game.i18n.localize(`MoshQoL.Currency.Errors.${parsed.code}`),
        candidates: parsed.candidates?.map(candidate => ({
          label: game.i18n.localize(`MoshQoL.Currency.Notation.${candidate.notation}`),
          credits: candidate.credits
        })) ?? []
      })
    );
    const buttons = ambiguous
      ? ["de", "en"].map(action => ({ action, label: game.i18n.localize(`MoshQoL.Currency.Notation.${action}`) }))
      : [{
        action: "submit", label: game.i18n.localize("MoshQoL.Currency.Submit"), default: true,
        callback: (_event, button) => ({ input: button.form.elements.currencyInput.value })
      }];
    buttons.push({ action: "cancel", label: game.i18n.localize("MoshQoL.Common.Cancel"), default: ambiguous });
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MoshQoL.Currency.Title"), contentClasses: qolWindowClasses(CURRENCY_DIALOG_CLASS) },
      content, buttons, modal: true, rejectClose: false
    });
    // Closing, Escape, or an unexpected response must abort just like the Cancel button.
    if (ambiguous) {
      if (choice !== "de" && choice !== "en") return null;
      notation = choice;
    } else {
      if (!choice || typeof choice.input !== "string") return null;
      input = choice.input;
      notation = null; // New input must be checked against both notations again.
    }
  }
}
