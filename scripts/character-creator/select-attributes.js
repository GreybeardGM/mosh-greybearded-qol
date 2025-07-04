import { getThemeColor } from "../utils/get-theme-color.js";


export async function selectAttributes(actor, attributeChoices) {

  // Umwandeln für das Template
  const attributeSets = attributeChoices.map(choice => {
    const mod = parseInt(choice.modification, 10) || 0;
    const gridClass = {
      2: "two-col-grid",
      3: "three-col-grid",
      4: "four-col-grid",
      5: "five-col-grid",
      6: "six-col-grid"
      7: "seven-col-grid"
    }[choice.stats.length] || "auto-grid";

    return {
      gridClass,
      modification: mod,
      stats: choice.stats
    };
  });

  // Renderdialog
  return new Promise((resolve, reject) => {
    const dlg = new Dialog({
      title: "Select Attributes",
      content: await renderTemplate("modules/greybearded-qol/templates/attribute-choice.hbs", {
        attributeSets,
        themeColor: getThemeColor();
      }),
      buttons: {
        confirm: {
          label: "Confirm",
          callback: async (html) => {
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

            // Anwenden auf Actor
            for (const { attr, mod } of selections) {
              const current = getProperty(actor.system, `stats.${attr}.value`) || 0;
              await actor.update({ [`system.stats.${attr}.value`]: current + mod });
            }

            resolve(selections);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => reject("Cancelled")
        }
      },
      render: (html) => {
        html.on("click", ".card", function () {
          const parent = this.closest(".attribute-set");
          parent.querySelectorAll(".card").forEach(el => el.classList.remove("selected"));
          this.classList.add("selected");
        });
      },
      default: "confirm"
    });
    dlg.render(true);
  });
}

