import { getThemeColor } from "../utils/get-theme-color.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ApplyDamageInputApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static #active = null;

  static DEFAULT_OPTIONS = {
    id: "mosh-greybearded-qol-apply-damage-input",
    tag: "form",
    window: {
      title: "MoshQoL.Damage.ApplyDamage",
      contentClasses: ["greybeardqol", "qol-ui", "mosh-qol-apply-damage-input-window"],
      resizable: false
    },
    position: { width: 520, height: "auto" },
    form: {
      handler: this._onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: { cancel: this._onCancel, toggleTarget: this._onToggleTarget }
  };

  static PARTS = {
    form: { template: "modules/mosh-greybearded-qol/templates/dialogs/apply-damage-input.html" }
  };

  static async waitForInput(options = {}) {
    await this.#active?.close();
    const app = new this(options);
    this.#active = app;
    return app.wait();
  }

  constructor({ title, message, targets = [], cancel = null } = {}) {
    super();
    this._title = title ?? game.i18n.localize("MoshQoL.Damage.ApplyDamage");
    this._message = message ?? game.i18n.localize("MoshQoL.Damage.EnterAmount");
    this._targets = targets;
    this._cancel = cancel;
    this._resolve = null;
    this._selectedTargetIndexes = new Set(targets.map((_actor, index) => index));
  }

  async _prepareContext() {
    return {
      message: this._message,
      portraits: this._targets.map((actor, index) => ({
        index,
        name: actor?.name ?? "",
        src: actor?.img || "icons/svg/mystery-man.svg"
      })),
      antiArmorLabel: game.i18n.localize("MoshQoL.Damage.AntiArmor"),
      applyLabel: game.i18n.localize("MoshQoL.Damage.Apply"),
      cancelLabel: this._cancel?.label ?? game.i18n.localize("Cancel"),
      themeColor: getThemeColor()
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.window.title = this._title;
  }

  async close(options = {}) {
    const resolve = this._resolve;
    this._resolve = null;
    if (ApplyDamageInputApp.#active === this) ApplyDamageInputApp.#active = null;
    await super.close(options);
    resolve?.(null);
  }

  wait() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.render(true);
    });
  }

  static async _onCancel(event) {
    event?.preventDefault?.();
    await this.close();
  }


  static _onToggleTarget(event, target) {
    event?.preventDefault?.();

    const index = Number.parseInt(target?.dataset?.index ?? "", 10);
    if (!Number.isInteger(index)) return;

    if (this._selectedTargetIndexes.has(index)) this._selectedTargetIndexes.delete(index);
    else this._selectedTargetIndexes.add(index);

    target.classList.toggle("selected", this._selectedTargetIndexes.has(index));
  }

  static async _onSubmit(_event, _form, formData) {
    const payload = foundry.utils.expandObject(formData.object ?? {}).applyDamage ?? {};
    const resolve = this._resolve;
    this._resolve = null;
    resolve?.({
      damage: payload.damage,
      antiArmor: payload.antiArmor === true || payload.antiArmor === "on" || payload.antiArmor === "true",
      selectedTargetIndexes: Array.from(this._selectedTargetIndexes)
    });
    await this.close();
  }
}
