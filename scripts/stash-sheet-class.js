export function defineStashSheet(BaseSheet) {
  return class StashSheet extends BaseSheet {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["mosh", "sheet", "actor", "stash"],
        template: "modules/mosh-greybearded-qol/templates/stash-sheet.html",
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
          const val = this.value.replace(/\D/g, "");
          this.value = val;
        })
        .on("blur", function () {
          // Aufbereiten
          const raw = parseInt(this.value.replace(/\D/g, ""), 10) || 0;
          // Setze echten Wert (für Speicherung)
          this.value = raw;
          // Und zeitverzögert formatieren
          setTimeout(() => {
            this.value = `${raw.toLocaleString(game.i18n.lang)} cr`;
          }, 10);
        });
    }
  };
}
