const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ShoreLeaveTierEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "shore-leave-tier-editor",
    tag: "form",
    window: {
      title: "Edit Shore Leave Tiers",
      resizable: true
    },
    position: {
      width: 600,
      height: "auto"
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      resetDefaults: this._onResetDefaults
    }
  });

  static PARTS = {
    form: {
      template: "modules/mosh-greybearded-qol/templates/edit-shore-leave-tiers.html"
    }
  };

  async _prepareContext() {
    const tiers = game.settings.get("mosh-greybearded-qol", "shoreLeaveTiers");
    return { tiers: foundry.utils.deepClone(tiers) };
  }

  static async _onResetDefaults(event, target) {
    event.preventDefault();
    const module = await import("../config/default-shore-leave-tiers.js");
    await game.settings.set("mosh-greybearded-qol", "shoreLeaveTiers", module.SHORE_LEAVE_TIERS);
    this.render();
    ui.notifications.info("Shore Leave tiers reset to defaults.");
  }

  static async _onSubmit(event, form, formData) {
    await game.settings.set("mosh-greybearded-qol", "shoreLeaveTiers", formData.object.tiers);
    ui.notifications.info("Shore Leave Tiers updated.");
    this.close();
  }
}
