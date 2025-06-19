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
  };
}
