import { applyDamageToActors, getUniqueActorsFromTargets, promptDamageInput } from "./apply-damage.js";
import { normalizeNumber } from "../utils/normalization.js";
import { canShowApplyDamageUI } from "./policy.js";
import { getFeatureIcon } from "../codex/feature-actions.js";

async function applyDamageToSelectedActors(damageInput, antiArmor, selectedActors = null) {
  const selectedActorsList = getUniqueActorsFromTargets(selectedActors ?? (canvas?.tokens?.controlled ?? []));
  if (!selectedActorsList.length) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.NoTokensSelected"));
    return;
  }

  const damage = normalizeNumber(damageInput, { fallback: null, min: 1 });
  if (damage === null) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.PositiveValueRequired"));
    return;
  }

  const normalizedPayload = {
    damage: Math.trunc(damage),
    antiArmorHit: Boolean(antiArmor)
  };

  try {
    await applyDamageToActors(selectedActorsList, normalizedPayload);
  } catch (err) {
    console.error("applyDamage failed for selected actors", selectedActorsList, err);
  }
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

let applyDamageSceneControlRegistered = false;

export function registerApplyDamageSceneControl() {
  if (applyDamageSceneControlRegistered) return;
  applyDamageSceneControlRegistered = true;

  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = Array.isArray(controls)
      ? controls.find(c => c?.name === "token")
      : (controls?.token ?? controls?.tokens ?? null);
    if (!tokenControls) return;

    const toolDef = {
      name: "applyDamage",
      title: game.i18n.localize("MoshQoL.Damage.ApplyDamageToSelectedTokens"),
      icon: getFeatureIcon("apply-damage", "fa-solid fa-heart-broken"),
      visible: canShowApplyDamageUI(game.user),
      button: true,
      onClick: async () => {
        if (!canShowApplyDamageUI(game.user)) return;

        const selected = canvas?.tokens?.controlled ?? [];
        if (!selected.length) {
          ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.NoTokensSelected"));
          return;
        }
        const targets = getUniqueActorsFromTargets(selected);

        const data = await promptDamageInput({
          title: game.i18n.localize("MoshQoL.Damage.ApplyDamageToSelectedTokens"),
          message: game.i18n.format("MoshQoL.Damage.EnterAmountForTokens", {
            count: targets.length,
            tokens: game.i18n.localize(targets.length === 1 ? "MoshQoL.Damage.TokenSingular" : "MoshQoL.Damage.TokenPlural")
          }),
          targets,
          cancel: { label: game.i18n.localize("MoshQoL.Common.Cancel"), icon: "fa-solid fa-xmark" }
        });

        if (!data) return;

        const selectedIndexes = Array.isArray(data.selectedTargetIndexes) ? data.selectedTargetIndexes : [];
        const filteredActors = targets.filter((_actor, index) => selectedIndexes.includes(index));
        const selectedActors = getUniqueActorsFromTargets(filteredActors);
        if (!selectedActors.length) return;

        await applyDamageToSelectedActors(data.damage, data.antiArmor, selectedActors);
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
