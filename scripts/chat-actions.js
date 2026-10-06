import { CHAT_ACTION_PAY_SHORE_LEAVE, CHAT_ACTION_SELECTOR } from "./codex/constants.js";
import { insertApplyDamageChatButtons } from "./apply-damage/chat-buttons.js";
import { canShowApplyDamageUI } from "./apply-damage/policy.js";
import { MOSH_CREDITS_PATH } from "./codex/mosh-system.js";
import { readCurrency } from "./utils/currency.js";
import { getCreditConfig, isCreditHandlerEnabled } from "./currency/config.js";

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

const paymentsInFlight = new WeakSet();

export async function payShoreLeave(actor, amount) {
  // Duplicate clicks must not spend the same snapshot while an update is pending.
  if (!isCreditHandlerEnabled() || paymentsInFlight.has(actor)) return;
  const notation = getCreditConfig().notation;
  paymentsInFlight.add(actor);
  try {
    const originalCredits = foundry.utils.getProperty(actor, MOSH_CREDITS_PATH);
    const currentCredits = await readCurrency(originalCredits, { label: actor.name });
    if (currentCredits === null) return;
    const price = await readCurrency(amount, { label: game.i18n.localize("MoshQoL.ShoreLeave.PayablePrice") });
    if (price === null || price <= 0) return;
    // A GM may disable the handler or change notation while a correction dialog is open.
    if (!isCreditHandlerEnabled()) return;
    if (getCreditConfig().notation !== notation) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
      return;
    }

    // A dialog may stay open while another user changes the balance. Never
    // overwrite that newer value with arithmetic based on the previous snapshot.
    if (!Object.is(originalCredits, foundry.utils.getProperty(actor, MOSH_CREDITS_PATH))) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Currency.Changed"));
      return;
    }

    if (currentCredits < price) {
      ui.notifications.warn(game.i18n.format("MoshQoL.ShoreLeave.CannotAfford", { actorName: actor.name }));
      return;
    }

    await actor.update({
      [MOSH_CREDITS_PATH]: currentCredits - price
    });
  } finally {
    paymentsInFlight.delete(actor);
  }
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
        case "applyDamageSelected":
          if (!canShowApplyDamageUI(game.user)) return;
          await game.moshGreybeardQol.applyDamage(null, args[0], args[1] === true, args[2] ?? null, args[3] ?? null);
          break;
        case "convertStress": {
          const actor = getRequiredChatActionActor();
          if (!actor) return;
          await game.moshGreybeardQol.convertStress(actor, ...args);
          break;
        }
        case "simpleShoreLeave": {
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
        case "triggerShipCrit":
          await game.moshGreybeardQol.triggerShipCrit(...args);
          break;
        default:
          ui.notifications.warn(game.i18n.format("MoshQoL.Errors.UnknownAction", { action }));
      }
    });
  });
}
