import { promptDamageInput } from "./apply-damage.js";
import { normalizeNumber } from "../utils/normalization.js";
import { canShowApplyDamageUI } from "./policy.js";

export async function applyDamageToSelectedTokens(damageInput, antiArmor, woundType = null, woundRollModifier = null) {
  const selected = canvas?.tokens?.controlled ?? [];
  if (!selected.length) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.NoTokensSelected"));
    return;
  }

  const damage = normalizeNumber(damageInput, { fallback: null, min: 1 });
  if (damage === null) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.PositiveValueRequired"));
    return;
  }

  let applied = 0;
  for (const token of selected) {
    const actorLike = token?.actor ?? token;
    if (!actorLike) continue;
    try {
      const didApply = await game.moshGreybeardQol.applyDamage(actorLike, damage, antiArmor, woundType, woundRollModifier);
      if (didApply !== false) applied++;
    } catch (err) {
      console.error("applyDamage failed for", token, err);
    }
  }

  ui.notifications.info(game.i18n.format("MoshQoL.Damage.AppliedToTokens", {
    applied,
    total: selected.length,
    tokens: game.i18n.localize(selected.length === 1 ? "MoshQoL.Damage.TokenSingular" : "MoshQoL.Damage.TokenPlural")
  }));
}

function insertApplyDamageTool(tokenControls, toolDef) {
  if (!tokenControls) return;

  if (Array.isArray(tokenControls.tools)) {
    tokenControls.tools.push(toolDef);
    return;
  }

  tokenControls.tools = tokenControls.tools ?? {};
  const order = Object.keys(tokenControls.tools).length;
  tokenControls.tools.applyDamage = { ...toolDef, order };
}

export function registerApplyDamageSceneControl() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = Array.isArray(controls)
      ? controls.find(c => c?.name === "token")
      : (controls?.token ?? controls?.tokens ?? null);
    if (!tokenControls) return;

    const toolDef = {
      name: "applyDamage",
      title: game.i18n.localize("MoshQoL.Damage.ApplyDamageToSelectedTokens"),
      icon: "fa-solid fa-heart-broken",
      visible: canShowApplyDamageUI(game.user),
      button: true,
      onClick: async () => {
        if (!canShowApplyDamageUI(game.user)) return;

        const selected = canvas?.tokens?.controlled ?? [];
        if (!selected.length) {
          ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.NoTokensSelected"));
          return;
        }

        const data = await promptDamageInput({
          title: game.i18n.localize("MoshQoL.Damage.ApplyDamageToSelectedTokens"),
          message: game.i18n.format("MoshQoL.Damage.EnterAmountForTokens", {
            count: selected.length,
            tokens: game.i18n.localize(selected.length === 1 ? "MoshQoL.Damage.TokenSingular" : "MoshQoL.Damage.TokenPlural")
          }),
          cancel: { label: game.i18n.localize("MoshQoL.Common.Cancel"), icon: "fa-solid fa-xmark" }
        });

        if (!data) return;
        await applyDamageToSelectedTokens(data.damage, data.antiArmor);
      }
    };

    const existingApplyDamageTool = Array.isArray(tokenControls.tools)
      ? tokenControls.tools.find(t => t?.name === "applyDamage")
      : tokenControls?.tools?.applyDamage;

    if (existingApplyDamageTool) {
      existingApplyDamageTool.visible = toolDef.visible;
      existingApplyDamageTool.title = toolDef.title;
      existingApplyDamageTool.icon = toolDef.icon;
      existingApplyDamageTool.onClick = toolDef.onClick;
      return;
    }

    insertApplyDamageTool(tokenControls, toolDef);
  });
}
