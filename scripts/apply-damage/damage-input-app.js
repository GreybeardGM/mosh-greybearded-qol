const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ApplyDamageInputApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mosh-greybearded-qol-apply-damage-input",
    tag: "form",
    window: {
      title: "MoshQoL.Damage.ApplyDamage",
      contentClasses: ["greybeardqol", "mosh-qol-apply-damage-input-window"],
      resizable: false
    },
    position: {
      width: 520,
      height: "auto"
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      cancel: this._onCancel
    }
  };

  static PARTS = {
    form: {
      template: "modules/mosh-greybearded-qol/templates/dialogs/apply-damage-input.html"
    }
  };

  constructor({ title, message, targets = [], cancel = null } = {}) {
    super();
    this._title = title ?? game.i18n.localize("MoshQoL.Damage.ApplyDamage");
    this._message = message ?? game.i18n.localize("MoshQoL.Damage.EnterAmount");
    this._targets = targets;
    this._cancel = cancel;
    this._resolver = null;
  }

  async _prepareContext() {
    const portraits = this._targets.map((actor) => ({
      name: actor?.name ?? "",
      src: actor?.img || "icons/svg/mystery-man.svg"
    }));

    return {
      message: this._message,
      portraits,
      antiArmorLabel: game.i18n.localize("MoshQoL.Damage.AntiArmor"),
      applyLabel: game.i18n.localize("MoshQoL.Damage.Apply"),
      cancelLabel: game.i18n.localize("Cancel")
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.window.title = this._title;
  }

  async close(options = {}) {
    const wasResolved = this._resolver === null;
    const result = await super.close(options);
    if (!wasResolved && this._resolver) {
      this._resolver(null);
      this._resolver = null;
    }
    return result;
  }

  wait() {
    return new Promise((resolve) => {
      this._resolver = resolve;
      this.render(true);
    });
  }

  static async _onCancel(event) {
    event?.preventDefault?.();
    await this.close();
  }

  static async _onSubmit(_event, _form, formData) {
    const app = this;
    const expanded = foundry.utils.expandObject(formData.object ?? {});
    const payload = expanded.applyDamage ?? {};

    const resolver = app._resolver;
    app._resolver = null;
    resolver?.({
      damage: payload.damage,
      antiArmor: payload.antiArmor === true || payload.antiArmor === "on" || payload.antiArmor === "true"
    });

    await app.close();
  }
}
