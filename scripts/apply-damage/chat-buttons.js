import { normalizeNumber } from "../utils/normalization.js";
import {
  extractDamageRollFromMessageContent,
  extractWoundEffectFromMessageContent
} from "./extract-damage-roll.js";

function getApplyDamageChatButtonRoll(message) {
  const woundEffect = extractWoundEffectFromMessageContent(message);
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
      rollData: roll,
      ...woundEffect
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

  const buttonRow = document.createElement("div");
  buttonRow.classList.add("apply-damage-chat-buttons-row");

  const applyRegularButton = createApplyDamageButton({
    damage: damageRoll.total,
    antiArmor: false,
    icon: "fas fa-heart-broken",
    label: game.i18n.localize("MoshQoL.Damage.ApplyDamageShort"),
    title: game.i18n.format("MoshQoL.Damage.ApplyRolledDamage", { damage: damageRoll.total }),
    flex: 2,
    woundType: damageRoll.woundType,
    woundRollModifier: damageRoll.woundRollModifier
  });

  const applyAntiArmorButton = createApplyDamageButton({
    damage: damageRoll.total,
    antiArmor: true,
    icon: "fas fa-shield-halved",
    label: game.i18n.localize("MoshQoL.Damage.ApplyAntiArmorShort"),
    title: `${game.i18n.format("MoshQoL.Damage.ApplyRolledDamage", { damage: damageRoll.total })} (${game.i18n.localize("MoshQoL.Damage.AntiArmor")})`,
    flex: 1,
    woundType: damageRoll.woundType,
    woundRollModifier: damageRoll.woundRollModifier
  });

  buttonRow.append(applyRegularButton, applyAntiArmorButton);
  panel.append(buttonRow);

  return panel;
}

function createApplyDamageButton({ damage, antiArmor, icon, label, title, flex, woundType, woundRollModifier }) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("apply-damage-chat-button", "chat-action", "interactive");
  button.classList.add(antiArmor ? "anti-armor" : "regular-damage");
  button.dataset.action = "applyDamageSelected";
  button.dataset.args = JSON.stringify(createApplyDamageArgs({ damage, antiArmor, woundType, woundRollModifier }));
  button.style.flexGrow = String(flex);
  button.title = title;
  button.setAttribute("aria-label", title);

  const iconElement = document.createElement("i");
  iconElement.className = icon;
  iconElement.classList.add("apply-damage-chat-button-icon");

  const labelElement = document.createElement("span");
  labelElement.textContent = `${damage} ${label}`;

  button.append(iconElement, labelElement);

  return button;
}

function createApplyDamageArgs({ damage, antiArmor, woundType, woundRollModifier }) {
  const args = [damage, antiArmor];
  if (woundType) args.push(woundType);
  if (woundRollModifier) {
    if (!woundType) args.push(null);
    args.push(woundRollModifier);
  }
  return args;
}

export function insertApplyDamageChatButtons(message, html) {
  if (html.querySelector(".apply-damage-chat-buttons")) return;

  const damageRoll = getApplyDamageChatButtonRoll(message);
  if (!damageRoll) return;

  const content = html.querySelector(".message-content") ?? html;
  content.append(createApplyDamageChatButtons(damageRoll));
}
