import { parseCurrencyValue } from "../utils/normalization.js";
import { attachCurrencyFieldHandlers } from "../utils/currency-field.js";

export function defineStashSheet(BaseSheet) {
  return class StashSheet extends BaseSheet {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["mosh", "greybeardqol", "sheet", "actor", "stash"],
        template: "modules/mosh-greybearded-qol/templates/sheets/stash-sheet.html",
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
      const creditsPath = "system.credits.value";
      if (creditsPath in formData) {
        formData[creditsPath] = parseCurrencyValue(formData[creditsPath]);
      }

      return super._updateObject(event, formData);
    }

    get title() {
      return this.actor.name || "Stash";
    }

    getData(options = {}) {
      const data = super.getData(options);
      return data;
    }

    activateListeners(html) {
      super.activateListeners(html);

      // Everything below here is only needed if the sheet is editable
      if (!this.options.editable) return;

            attachCurrencyFieldHandlers(html);

    }
  };
}
