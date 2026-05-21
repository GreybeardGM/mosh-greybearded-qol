import { insertApplyDamageChatButtons } from "./apply-damage/chat-buttons.js";
import { applyDamageToSelectedTokens } from "./apply-damage/scene-control.js";

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

export function registerChatActions() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    insertApplyDamageChatButtons(message, html);

    if (html.dataset.moshQolChatActionsBound) return;
    html.dataset.moshQolChatActionsBound = "true";

    html.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest(".greybeardqol .chat-action");
      if (!button || !html.contains(button)) return;

      event.preventDefault();

      const action = button.dataset.action;
      if (!action) return;

      const args = getChatActionArgs(button);

      switch (action) {
        case "applyDamageSelected":
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
        case "triggerShipCrit":
          await game.moshGreybeardQol.triggerShipCrit(...args);
          break;
        default:
          ui.notifications.warn(game.i18n.format("MoshQoL.Errors.UnknownAction", { action }));
      }
    });
  });
}
