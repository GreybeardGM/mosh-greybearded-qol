Hooks.once("init", () => {
  const ActorCls = CONFIG.Actor?.documentClass;
  if (!ActorCls?.prototype?.chooseAttribute) return;

  const proto = ActorCls.prototype;
  if (proto._gbqolChooseAttributePatched) return;

  const originalChooseAttribute = proto.chooseAttribute;
  proto._gbqolOriginalChooseAttribute = originalChooseAttribute;

  proto.chooseAttribute = async function (rollString, aimFor) {
    if (this.type !== "creature") return originalChooseAttribute.call(this, rollString, aimFor);

    const stats = this.system?.stats ?? {};
    const activeAttributes = Object.entries(stats)
      .filter(([key, stat]) => {
        if (key === "armor") return false;
        if (!stat || typeof stat !== "object") return false;
        if (!("value" in stat)) return false;
        return stat.enabled === true;
      })
      .map(([key, stat]) => ({
        key,
        id: `gbqol-stat-${key}`,
        icon: `systems/mosh/images/icons/ui/attributes/${key}.png`,
        label: stat.label ?? key,
        example: stat.rollLabel ?? stat.label ?? key
      }));

    const fallbackAttribute = activeAttributes[0]?.key ?? "combat";

    const content = await foundry.applications.handlebars.renderTemplate(
      "modules/mosh-greybearded-qol/templates/dialogs/creature-skillfix-stat-selection-dialog.html",
      {
        showRollTypePrompt: !rollString,
        attributes: activeAttributes
      }
    );

    const allowedAttributes = new Set(activeAttributes.map((entry) => entry.key));

    const mkButton = (label, rs, icon, action) => ({
      label,
      icon,
      action,
      disabled: activeAttributes.length === 0,
      callback: (_event, button) => {
        const selected = button.form?.querySelector("input[name='stat']:checked")?.value;
        const attribute = allowedAttributes.has(selected) ? selected : fallbackAttribute;
        return [rs, "low", attribute];
      }
    });

    const buttons = rollString
      ? [mkButton(game.i18n.localize("Mosh.Next"), rollString, "fas fa-chevron-circle-right", "action_next")]
      : [
          mkButton(game.i18n.localize("Mosh.Advantage"), "1d100 [+]", "fas fa-angle-double-up", "action_advantage"),
          mkButton(game.i18n.localize("Mosh.Normal"), "1d100", "fas fa-minus", "action_normal"),
          mkButton(game.i18n.localize("Mosh.Disadvantage"), "1d100 [-]", "fas fa-angle-double-down", "action_disadvantage")
        ];

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("Mosh.ChooseAStat") },
      classes: ["macro-popup-dialog"],
      position: { width: 600 },
      content,
      buttons
    });

    if (result) return result;

    return [rollString ?? "1d100", "low", fallbackAttribute];
  };

  proto._gbqolChooseAttributePatched = true;
});
