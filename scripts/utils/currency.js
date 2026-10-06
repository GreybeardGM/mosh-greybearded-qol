import { CURRENCY_DIALOG_CLASS, qolWindowClasses, templatePath } from "../codex/constants.js";
import { appendQolThemeContext } from "./application-options.js";
import { classifyCurrency } from "./currency-parser.js";
import { CURRENCY_DIALOG_WIDTH, getCreditConfig } from "../currency/config.js";

/**
 * Numeric reads abort with null, never zero.
 * Callers must check null before continuing or writing anything. Corrections
 * are returned to the action, never saved to an actor or setting by this utility.
 * preserveInput returns the accepted original/corrected text instead of its integer value.
 * Only manual sheet edits opt into keepInvalidOnCancel: declining a correction
 * keeps the original field text. Payments and other numeric consumers still abort.
 */
export async function readCurrency(value, { label = "", preserveInput = false, keepInvalidOnCancel = false } = {}) {
  let input = value;
  const notation = getCreditConfig().notation;
  // A loop deliberately replaces recursive dialogs so repeated errors cannot grow the stack.
  while (true) {
    if (getCreditConfig().notation !== notation) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
      return null;
    }
    const parsed = classifyCurrency(input, { notation });
    if (parsed.status === "success") return preserveInput ? input : parsed.value;
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
      position: { width: CURRENCY_DIALOG_WIDTH, height: "auto" },
      content, buttons, modal: true, rejectClose: false
    });
    if (choice == null || choice === "cancel") {
      return preserveInput && keepInvalidOnCancel && typeof value === "string" ? value : null;
    }
    // Unexpected responses never authorize even the manual text-preservation exception.
    if (!choice || typeof choice.input !== "string") return null;
    input = choice.input;
  }
}

/** Validate explicit sheet edits without normalizing stored text or resaving untouched fields. */
export async function validateCurrencyFieldUpdate(sheet, formData, path) {
  if (!(path in formData)) return true;
  const originalValue = foundry.utils.getProperty(sheet.actor, path);
  const input = sheet.form?.elements.namedItem(path);
  const originalText = String(originalValue ?? "");
  const displayedText = input?.defaultValue ?? originalText;
  if (String(formData[path] ?? "") === displayedText) {
    // Other sheet edits must neither validate an old malformed value nor overwrite
    // a balance changed by another user since this form was rendered.
    delete formData[path];
    return true;
  }
  if (displayedText !== originalText) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
    return false;
  }
  const corrected = await readCurrency(formData[path], {
    label: sheet.actor.name, preserveInput: true, keepInvalidOnCancel: true
  });
  if (corrected === null) return false;
  if (!Object.is(originalValue, foundry.utils.getProperty(sheet.actor, path))) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
    return false;
  }
  formData[path] = corrected;
  // Both confirmed corrections and deliberately retained raw text belong in the update.
  if (input) input.value = String(corrected);
  return true;
}
