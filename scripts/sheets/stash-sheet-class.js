import { qolSheetClasses, templatePath } from "../codex/constants.js";
import { validateCurrencyFieldUpdate } from "../utils/currency.js";
import { MOSH_CREDITS_PATH } from "../codex/mosh-system.js";
import { attachCurrencyFieldHandlers, syncCurrencyFieldBaseline } from "../utils/currency-field.js";

export function defineStashSheet(BaseSheet) {
  return class StashSheet extends BaseSheet {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: qolSheetClasses("actor", "stash"),
        template: templatePath("sheets/stash-sheet.html"),
        width: 700,
        height: 700,
        tabs: [
          {
            navSelector: ".sheet-tabs",
            contentSelector: ".sheet-body",
            initial: "items"
          }
        ]
      });
    }

    async _updateObject(event, formData) {
      // Manual edits are checked even with automation off; declining a correction
      // keeps the entered text. Automatic payments retain their separate abort rule.
      if (!await validateCurrencyFieldUpdate(this, formData, MOSH_CREDITS_PATH)) return;

      formData["system.health.value"] = 0;
      formData["system.health.max"] = 0;
      formData["system.hits.value"] = 0;
      formData["system.hits.max"] = 0;

      const result = await super._updateObject(event, formData);
      syncCurrencyFieldBaseline(this, formData, MOSH_CREDITS_PATH);
      return result;
    }

    get title() {
      return this.actor.name || "Stash";
    }

    activateListeners(html) {
      super.activateListeners(html);

      // Everything below here is only needed if the sheet is editable
      if (!this.options.editable) return;

      attachCurrencyFieldHandlers(html);
    }
  };
}
