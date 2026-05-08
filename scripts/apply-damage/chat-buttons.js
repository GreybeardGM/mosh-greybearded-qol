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
  title.textContent = game.i18n.format("MoshQoL.Damage.ApplyRolledDamage", { damage: damageRoll.total });
  panel.append(title);

  const buttonRow = document.createElement("div");
  buttonRow.classList.add("apply-damage-chat-buttons-row");

  const applyRegularButton = createApplyDamageButton({
    damage: damageRoll.total,
    antiArmor: false,
    icon: "fas fa-heart-broken",
    label: game.i18n.localize("MoshQoL.Damage.ApplyToSelectedTokens")
  });

  const applyAntiArmorButton = createApplyDamageButton({
    damage: damageRoll.total,
    antiArmor: true,
    icon: "fas fa-shield-halved",
    label: game.i18n.localize("MoshQoL.Damage.ApplyToSelectedTokensAntiArmor")
  });

  buttonRow.append(applyRegularButton, applyAntiArmorButton);
  panel.append(buttonRow);

  return panel;
}

function createApplyDamageButton({ damage, antiArmor, icon, label }) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("pill", "chat-action", "interactive");
  button.dataset.action = "applyDamageSelected";
  button.dataset.args = JSON.stringify([damage, antiArmor]);

  const iconElement = document.createElement("i");
  iconElement.className = icon;
  button.append(iconElement, ` ${label}`);

  return button;
}

export function insertApplyDamageChatButtons(message, html) {
  if (html.querySelector(".apply-damage-chat-buttons")) return;

  const damageRoll = getApplyDamageChatButtonRoll(message);
  if (!damageRoll) return;

  const content = html.querySelector(".message-content") ?? html;
  content.append(createApplyDamageChatButtons(damageRoll));
}
