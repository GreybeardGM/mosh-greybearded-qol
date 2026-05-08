import { normalizeNumber } from "../utils/normalization.js";
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
  const panel = document.createElement("div");
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
  applyButton.type = "button";
  applyButton.classList.add("pill", "chat-action", "interactive");
  applyButton.dataset.action = "applyDamageSelected";
  applyButton.dataset.args = JSON.stringify([damageRoll.total]);
  applyButton.innerHTML = `<i class="fas fa-heart-broken"></i> ${game.i18n.localize("MoshQoL.Damage.ApplyToSelectedTokens")}`;

  buttonRow.append(damageLabel, antiArmorLabel, applyButton);
  panel.append(buttonRow);

  return panel;
}

export function insertApplyDamageChatButtons(message, html) {
  if (html.querySelector(".apply-damage-chat-buttons")) return;

  const damageRoll = getApplyDamageChatButtonRoll(message);
  if (!damageRoll) return;

  const content = html.querySelector(".message-content") ?? html;
  content.append(createApplyDamageChatButtons(damageRoll));
}
