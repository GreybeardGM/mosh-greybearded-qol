export class ShoreLeaveTierEditor extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "shore-leave-tier-editor",
      title: "Edit Shore Leave Tiers",
      template: "modules/mosh-greybearded-qol/templates/edit-shore-leave-tiers.html",
      width: 600,
      height: "auto",
      closeOnSubmit: true,
      resizable: true
    });
  }

  async getData() {
    const tiers = game.settings.get("mosh-greybearded-qol", "shoreLeaveTiers");
    return { tiers: foundry.utils.deepClone(tiers) };
  }

  async _updateObject(event, formData) {
    const data = foundry.utils.expandObject(formData);
    await game.settings.set("mosh-greybearded-qol", "shoreLeaveTiers", data.tiers);
    ui.notifications.info("Shore Leave Tiers updated.");
  }
}
