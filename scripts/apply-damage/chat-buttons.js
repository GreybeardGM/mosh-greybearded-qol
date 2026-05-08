import { normalizeNumber } from "../utils/normalization.js";
import { applyDamage } from "./apply-damage.js";
import { extractDamageRollFromMessageContent } from "./extract-damage-roll.js";

function getApplyDamageChatButtonRoll(message) {
  const contentRoll = extractDamageRollFromMessageContent(message);
  if (contentRoll) return contentRoll;

  const rolls = Array.isArray(message?.rolls) ? message.rolls : [];
  for (const roll of rolls) {
    if (!isDamageRoll(roll)) continue;

    const total = normalizeNumber(roll.total, { fallback: null, min: 1 });
    if (total === null) continue;

    return {
      total: Math.trunc(total),
      formula: roll.formula,
      rollData: roll
    };
  }

  return null;
}

function isDamageRoll(roll) {
  if (typeof roll?.formula === "string" && roll.formula.includes("[damage]")) return true;

  return Array.isArray(roll?.terms)
    && roll.terms.some((term) => term?.options?.flavor === "damage");
}

function createApplyDamageChatButtons(damageRoll) {
  const panel = document.createElement("form");
  panel.classList.add("greybeardqol", "apply-damage-chat-buttons");

  const title = document.createElement("strong");
  title.textContent = game.i18n.localize("MoshQoL.Damage.ApplyDamage");
  panel.append(title);

  const buttonRow = document.createElement("div");
  buttonRow.classList.add("apply-damage-chat-buttons-row");

  const damageLabel = document.createElement("label");
  damageLabel.classList.add("apply-damage-chat-buttons-field");

  const damageText = document.createElement("span");
  damageText.textContent = game.i18n.localize("MoshQoL.Damage.Amount");

  const damageInput = document.createElement("input");
  damageInput.name = "damage";
  damageInput.type = "number";
  damageInput.min = "1";
  damageInput.step = "1";
  damageInput.value = String(damageRoll.total);

  damageLabel.append(damageText, damageInput);

  const antiArmorLabel = document.createElement("label");
  antiArmorLabel.classList.add("apply-damage-chat-buttons-check");

  const antiArmorInput = document.createElement("input");
  antiArmorInput.name = "antiArmor";
  antiArmorInput.type = "checkbox";

  const antiArmorText = document.createElement("span");
  antiArmorText.textContent = game.i18n.localize("MoshQoL.Damage.AntiArmor");

  antiArmorLabel.append(antiArmorInput, antiArmorText);

  const applyButton = document.createElement("button");
  applyButton.type = "submit";
  applyButton.textContent = game.i18n.localize("MoshQoL.Damage.ApplyToSelectedTokens");

  buttonRow.append(damageLabel, antiArmorLabel, applyButton);
  panel.append(buttonRow);

  panel.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selected = canvas?.tokens?.controlled ?? [];
    if (!selected.length) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Damage.NoTokensSelected"));
      return;
    }

    const damageInputValue = damageInput.value;
    const antiArmor = antiArmorInput.checked;

    let applied = 0;
    for (const token of selected) {
      const actorLike = token?.actor ?? token;
      if (!actorLike) continue;
      try {
        await applyDamage(actorLike, damageInputValue, antiArmor);
        applied++;
      } catch (err) {
        console.error("applyDamage failed for", token, err);
      }
    }

    ui.notifications.info(game.i18n.format("MoshQoL.Damage.AppliedToTokens", {
      applied,
      total: selected.length,
      tokens: game.i18n.localize(selected.length === 1 ? "MoshQoL.Damage.TokenSingular" : "MoshQoL.Damage.TokenPlural")
    }));
  });

  return panel;
}

export function insertApplyDamageChatButtons(message, html) {
  if (html.querySelector(".apply-damage-chat-buttons")) return;

  const damageRoll = getApplyDamageChatButtonRoll(message);
  if (!damageRoll) return;

  const content = html.querySelector(".message-content") ?? html;
  content.append(createApplyDamageChatButtons(damageRoll));
}
