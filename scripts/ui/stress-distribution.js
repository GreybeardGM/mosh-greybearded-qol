export async function showStressConversionDialog(actor, points) {
  return new Promise(async (resolve) => {
    const base = {
      sanity: actor.system.stats.sanity.value ?? 0,
      fear: actor.system.stats.fear.value ?? 0,
      body: actor.system.stats.body.value ?? 0,
    };
    const values = structuredClone(base);

    const html = await renderTemplate("modules/mosh-greybearded-qol/templates/stress-conversion.html", {});
    const dlg = new Dialog({
      title: "Distribute Stress Conversion",
      content: html,
      buttons: {
        confirm: {
          icon: "<i class=\"fas fa-check\"></i>",
          label: "Confirm",
          callback: async (html) => {
            resolve(values);
          }
        },
        cancel: {
          icon: "<i class=\"fas fa-times\"></i>",
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "confirm",
      close: () => resolve(null),
      render: (html) => {
        const updateUI = () => {
          html.find("#counter-sanity").text(values.sanity);
          html.find("#counter-fear").text(values.fear);
          html.find("#counter-body").text(values.body);

          const assigned = values.sanity + values.fear + values.body - base.sanity - base.fear - base.body;
          html.find("#remaining").text(points - assigned);

          const confirmBtn = html.find("#confirm-button")
          confirmBtn.prop("disabled", assigned !== points);
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

        // Ensure confirm button is disabled at start
        html.find('button:contains("Confirm")')
          .attr("id", "confirm-button")
          .prop("disabled", true);

        updateUI();
      }
    }, { width: 480 });

    dlg.render(true);
  });
}
