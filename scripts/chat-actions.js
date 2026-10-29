import {
  CHAT_ACTION_APPLY_DAMAGE_SELECTED, CHAT_ACTION_CONVERT_STRESS, CHAT_ACTION_SIMPLE_SHORE_LEAVE,
  CHAT_ACTION_PAY_SHORE_LEAVE, CHAT_ACTION_TRIGGER_SHIP_CRIT
} from "./codex/feature-actions.js";
import { CHAT_ACTION_SELECTOR } from "./codex/constants.js";
import { insertApplyDamageChatButtons } from "./apply-damage/chat-buttons.js";
import { canShowApplyDamageUI } from "./apply-damage/policy.js";
import { CREDIT_PAY, isCreditHandlerEnabled } from "./currency/config.js";
import { changeCredits } from "./currency/credit-transactions.js";

// Applies both to stored cards on render and to currently visible cards after a setting change.
export function refreshCreditPaymentButtons(root = globalThis.document) {
  root?.querySelectorAll(`${CHAT_ACTION_SELECTOR}[data-action="${CHAT_ACTION_PAY_SHORE_LEAVE}"]`)
    .forEach(button => {
      button.hidden = !isCreditHandlerEnabled();
      // Explicit display also wins against the card's styled button display rules.
      button.style.display = button.hidden ? "none" : "";
    });
}

function getChatActionArgs(button) {
  if (!button.dataset.args) return [];

  try {
    return JSON.parse(button.dataset.args);
  } catch (error) {
    console.warn("[MoSh QoL] Failed to parse chat action args", error);
    return [];
  }
}

function getRequiredChatActionActor() {
  const actor = game.user.character;
  if (!actor) {
    ui.notifications.warn(game.i18n.localize("MoshQoL.Errors.NoCharacterAssigned"));
  }
  return actor;
}

export async function payShoreLeave(actor, amount) {
  return changeCredits(actor, amount, { operation: CREDIT_PAY });
}

let chatActionsRegistered = false;

export function registerChatActions() {
  if (chatActionsRegistered) return;
  chatActionsRegistered = true;

  Hooks.on("renderChatMessageHTML", (message, html) => {
    insertApplyDamageChatButtons(message, html);
    refreshCreditPaymentButtons(html);

    if (html.dataset.moshQolChatActionsBound) return;
    html.dataset.moshQolChatActionsBound = "true";

    html.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest(CHAT_ACTION_SELECTOR);
      if (!button || !html.contains(button)) return;

      event.preventDefault();

      const action = button.dataset.action;
      if (!action) return;

      const args = getChatActionArgs(button);

      switch (action) {
        case CHAT_ACTION_APPLY_DAMAGE_SELECTED:
          if (!canShowApplyDamageUI(game.user)) return;
          await game.moshGreybeardQol.applyDamage(null, args[0], args[1] === true, args[2] ?? null, args[3] ?? null);
          break;
        case CHAT_ACTION_CONVERT_STRESS: {
          const actor = getRequiredChatActionActor();
          if (!actor) return;
          await game.moshGreybeardQol.convertStress(actor, ...args);
          break;
        }
        case CHAT_ACTION_SIMPLE_SHORE_LEAVE: {
          const actor = getRequiredChatActionActor();
          if (!actor) return;
          await game.moshGreybeardQol.SimpleShoreLeave.wait({ actor, randomFlavor: args[0] });
          break;
        }
        case CHAT_ACTION_PAY_SHORE_LEAVE: {
          if (!isCreditHandlerEnabled()) return;
          const actor = getRequiredChatActionActor();
          if (!actor) return;
          await payShoreLeave(actor, args[0]);
          break;
        }
        case CHAT_ACTION_TRIGGER_SHIP_CRIT:
          await game.moshGreybeardQol.triggerShipCrit(...args);
          break;
        default:
          ui.notifications.warn(game.i18n.format("MoshQoL.Errors.UnknownAction", { action }));
      }
    });
  });
}
