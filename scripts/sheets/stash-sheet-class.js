import { formatCurrency, parseCurrencyValue } from "../utils/normalization.js";

export function defineStashSheet(BaseSheet) {
  return class StashSheet extends BaseSheet {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["mosh", "sheet", "actor", "stash"],
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

      // Salary Display
      html.find(".currency-input")
        .on("focus", function () {
          // Bei Fokus: Nur die Zahl zeigen
          const raw = parseCurrencyValue(this.value);
          this.value = String(raw);
        })
        .on("blur", function () {
          // Aufbereiten
          const raw = parseCurrencyValue(this.value);
          // Setze echten Wert (für Speicherung)
          this.value = raw;
          // Und zeitverzögert formatieren
          setTimeout(() => {
            this.value = formatCurrency(raw);
          }, 10);
        });

      // Initial format currency fields
      html.find(".currency-input").each(function () {
        const raw = parseCurrencyValue(this.value);
        this.value = formatCurrency(raw);
      });
    }
  };
}
