import { getThemeColor } from "../utils/get-theme-color.js";
import { calculateDialogWidth } from "../utils/calculate-dialog-width.js";

export async function selectAttributes(actor, attributeChoices) {
  const cardWidth = 160;

  const attributeSets = attributeChoices.map(choice => ({
    modification: parseInt(choice.modification, 10) || 0,
    stats: choice.stats,
    maxWidth: `${calculateDialogWidth(choice.stats.length, cardWidth, false)}px`
  }));

  const maxCols = Math.max(...attributeChoices.map(choice => choice.stats.length));
  const dialogWidth = calculateDialogWidth(maxCols, cardWidth, true);

  const htmlContent = await foundry.applications.handlebars.renderTemplate("modules/mosh-greybearded-qol/templates/character-creator/select-attributes.html", {
    attributeSets,
    themeColor: getThemeColor()
  });

  return new Promise((resolve, reject) => {
    const dlg = new Dialog({
      title: "Select Attributes",
      content: htmlContent,
      buttons: {}, // Keine Foundry-Buttons
      close: () => reject("Cancelled"),
      render: (html) => {
        const dialogElement = html.closest('.app');
        dialogElement.css({ width: `${dialogWidth}px`, maxWidth: '95vw', margin: '0 auto' });
        setTimeout(() => dialogElement[0].style.height = 'auto', 0);

        const confirmBtn = html.find("#confirm-button");
        const updateConfirmLock = () => {
          const sets = html[0].querySelectorAll(".attribute-set");
          const completed = Array.from(sets).every(set =>
            set.querySelector(".card.selected")
          );
          confirmBtn.toggleClass("locked", !completed);
        };

        // Auswahlverhalten
        html.on("click", ".card", function () {
          const parent = this.closest(".attribute-set");
          parent.querySelectorAll(".card").forEach(el => el.classList.remove("selected"));
          this.classList.add("selected");
          updateConfirmLock();
        });

        // Initial sperren
        confirmBtn.addClass("locked");

        // Bestätigungslogik
        confirmBtn.on("click", async () => {
          if (confirmBtn.hasClass("locked")) return;

          const selections = [];
          const sets = html[0].querySelectorAll(".attribute-set");
          sets.forEach(set => {
            const selected = set.querySelector(".card.selected");
            if (selected) {
              const attr = selected.dataset.attr;
              const mod = parseInt(set.dataset.mod, 10) || 0;
              selections.push({ attr, mod });
            }
          });

          if (selections.length !== attributeSets.length) {
            ui.notifications.warn("You must select one attribute per set.");
            return reject("Incomplete selection");
          }

          for (const { attr, mod } of selections) {
            const current = foundry.utils.getProperty(actor.system, `stats.${attr}.value`) || 0;
            await actor.update({ [`system.stats.${attr}.value`]: current + mod });
          }

          resolve(selections);
          dlg.close();
        });
      }
    });

    dlg.render(true);
  });
}
