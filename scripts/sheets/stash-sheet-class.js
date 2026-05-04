import { formatCurrency, parseCurrencyValue } from "../utils/normalization.js";

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

            // Currency display/edit separation
      const showDisplay = (input) => {
        const raw = parseCurrencyValue(input.value);
        input.value = String(raw);
        const display = input.closest(".currency-field")?.querySelector("[data-currency-display]");
        if (display) {
          display.textContent = formatCurrency(raw);
          display.style.display = "flex";
        }
        input.style.visibility = "hidden";
      };

      const showInput = (input) => {
        const raw = parseCurrencyValue(input.value);
        input.value = String(raw);
        const display = input.closest(".currency-field")?.querySelector("[data-currency-display]");
        if (display) display.style.display = "none";
        input.style.visibility = "visible";
      };

      html.find("[data-currency-display]").on("click", function () {
        const input = this.closest(".currency-field")?.querySelector(".currency-input");
        if (!input) return;
        showInput(input);
        input.focus();
        input.select();
      });

      html.find(".currency-input")
        .on("focus", function () {
          showInput(this);
        })
        .on("blur", function () {
          showDisplay(this);
        });
      // Initial display state
      html.find(".currency-input").each(function () {
        showDisplay(this);
      });
    }
  };
}
