import { getThemeColor } from "../utils/get-theme-color.js";

export async function showStressConversionDialog(actor, points) {
  return new Promise(async (resolve) => {
    const base = {
      sanity: actor.system.stats.sanity.value ?? 0,
      fear: actor.system.stats.fear.value ?? 0,
      body: actor.system.stats.body.value ?? 0,
    };
    const values = structuredClone(base);

    const html = await renderTemplate("modules/mosh-greybearded-qol/templates/stress-conversion.html", { 
      themeColor :getThemeColor()
    });

    const dlg = new Dialog({
      title: "Distribute Stress Conversion",
      content: html,
      buttons: {}, // No standard buttons
      close: () => resolve(null),
      render: (html) => {
        const updateUI = () => {
          for (const attr of Object.keys(values)) {
            const baseValue = base[attr];
            const currentValue = values[attr];
            const diff = currentValue - baseValue;
            const diffText = diff > 0 ? ` [<span class="counter">+${diff}]</span>` : "";
            html.find(`#counter-${attr}`).text(`${currentValue}${diffText}`);
          }
        
          const assigned = values.sanity + values.fear + values.body - base.sanity - base.fear - base.body;
          html.find("#remaining").text(points - assigned);
        
          const confirmBtn = html.find("#confirm-button");
          confirmBtn.toggleClass("locked", assigned !== points);
        };

        html.find(".card").on("click", function () {
          const attr = $(this).data("attr");
          const assigned = values.sanity + values.fear + values.body - base.sanity - base.fear - base.body;
          if (assigned < points && values[attr] < 90) {
            values[attr] += 1;
            updateUI();
          }
        });

        html.find(".card").on("contextmenu", function (event) {
          event.preventDefault();
          const attr = $(this).data("attr");
          if (values[attr] > base[attr]) {
            values[attr] -= 1;
            updateUI();
          }
        });

        // Confirm button handler
        html.find("#confirm-button").on("click", function () {
          if (!$(this).hasClass("locked")) {
            dlg.close();
            resolve(values);
          }
        });

        updateUI();
      }
    }, { width: 512 });

    dlg.render(true);
  });
}
