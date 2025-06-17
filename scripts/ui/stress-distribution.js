export async function showStressConversionDialog(actor, points) {
  return new Promise(async (resolve) => {
    const values = { sanity: 0, fear: 0, body: 0 };

    const html = await renderTemplate("modules/mosh-greybearded-qol/templates/stress-conversion.html", {});
    const dlg = new Dialog({
      title: "Distribute Stress Conversion",
      content: html,
      buttons: {
        confirm: {
          icon: "<i class=\"fas fa-check\"></i>",
          label: "Confirm",
          callback: async (html) => {
            await actor.update({
              "system.saves.sanity.value": actor.system.saves.sanity.value + values.sanity,
              "system.saves.fear.value": actor.system.saves.fear.value + values.fear,
              "system.saves.body.value": actor.system.saves.body.value + values.body
            });
            resolve(true);
          }
        },
        cancel: {
          icon: "<i class=\"fas fa-times\"></i>",
          label: "Cancel",
          callback: () => resolve(false)
        }
      },
      default: "confirm",
      close: () => resolve(false),
      render: (html) => {
        const updateUI = () => {
          html.find("#counter-sanity").text(values.sanity);
          html.find("#counter-fear").text(values.fear);
          html.find("#counter-body").text(values.body);
          const assigned = values.sanity + values.fear + values.body;
          html.find("#remaining").text(points - assigned);

          const confirmBtn = html.closest(".app.window-app.dialog").find("button[name='confirm']");
          confirmBtn.prop("disabled", assigned !== points);
        };

        html.find(".attribute-card").on("click", function () {
          const attr = $(this).data("attr");
          const current = values[attr];
          if ((values.sanity + values.fear + values.body) < points) {
            values[attr] = current + 1;
            updateUI();
          }
        });

        html.find(".attribute-card").on("contextmenu", function (event) {
          event.preventDefault();
          const attr = $(this).data("attr");
          if (values[attr] > 0) {
            values[attr] -= 1;
            updateUI();
          }
        });

        updateUI();
      }
    }, { width: 480 });

    dlg.render(true);
  });
}
