import { SHIP_CRITS } from "./codex/default-ship-crits-0e.js";
import { chatOutput } from "./utils/chat-output.js";

/**
 * Find the matching crit entry for a given roll
 */
function findCrit(roll) {
  return SHIP_CRITS.find(entry => roll >= entry.min && roll <= entry.max);
}

/**
 * Find the next higher crit (for escalation)
 */
function findEscalation(current) {
  return SHIP_CRITS.find(entry => entry.min > current.max);
}

/**
* Main entry point
*/
export async function triggerShipCrit(setCrit = null, actorUUID = null) {
  let crit, roll = null;

  if (typeof setCrit === "number") {
    crit = findCrit(setCrit);
  } else {
    roll = await (new Roll("1d100z")).evaluate();
    crit = findCrit(roll.total);
  }

  if (!crit) return ui.notifications.warn(game.i18n.format("MoshQoL.ShipCrit.NoMatch", { value: setCrit ?? roll?.total }));
  const next = findEscalation(crit);
  const actor = actorUUID ? await fromUuid(actorUUID) : null;
  const enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(crit.content || "", {
    async: true,
    rollData: actor?.getRollData?.() || {}
  });

  
  await chatOutput({
    title: crit.title,
    subtitle: actor ? game.i18n.format("MoshQoL.ShipCrit.ActorSubtitle", { actorName: actor.name }) : game.i18n.localize("MoshQoL.ShipCrit.ShipSubtitle"),
    content: enrichedContent,
    icon: crit.icon,
    image: actor?.img,
    roll,
    buttons: next ? [
      {
        label: game.i18n.localize("MoshQoL.ShipCrit.Escalate"),
        icon: "fa-arrow-up-right-dots",
        action: "triggerShipCrit",
        args: [next.min, actor?.uuid ?? null]
      }
    ] : []
  });
}
