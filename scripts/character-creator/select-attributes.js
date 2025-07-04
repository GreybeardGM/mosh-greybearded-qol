import { getThemeColor } from "../utils/get-theme-color.js";

export async function selectAttributes(actor, attributeChoices) {

    // Umwandeln für das Template
    function getGridClass(length) {
        return {
            2: "two-col-grid",
            3: "three-col-grid",
            4: "four-col-grid",
            5: "five-col-grid",
            6: "six-col-grid",
            7: "seven-col-grid"
        }[length] || "auto-grid";
    }
    
    const attributeSets = attributeChoices.map(choice => ({
        gridClass: getGridClass(choice.stats.length),
        modification: parseInt(choice.modification, 10) || 0,
        stats: choice.stats
    }));
    
    // Calculate dialog width
    const maxCols = Math.max(...attributeChoices.map(choice => choice.stats.length));
    const dialogWidth = Math.min(maxCols * 160, 1200); // 160px pro Karte, max 1200px

    // Vorher: Template rendern
    const htmlContent = await renderTemplate("modules/mosh-greybearded-qol/templates/character-creator/select-attributes.html", {
      attributeSets,
      themeColor: getThemeColor()
    });
    
    // Dann Dialog mit dem gerenderten Inhalt erzeugen
    return new Promise((resolve, reject) => {
      const dlg = new Dialog({
        title: "Select Attributes",
        content: htmlContent,
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
          const dialogElement = html.closest('.app');
          dialogElement.css({ width: `${dialogWidth}px`, maxWidth: '95vw', margin: '0 auto' });
          setTimeout(() => {
            dialogElement[0].style.height = 'auto';
          }, 0);
    
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

