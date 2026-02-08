import { SHIP_CRITS } from "./config/default-ship-crits-0e.js";
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
    roll = await (new Roll("1dH + 1dT")).evaluate();
    crit = findCrit(roll.total);
  }

  if (!crit) return ui.notifications.warn(`Kein Treffer für: ${setCrit ?? roll?.total}`);
  const next = findEscalation(crit);
  const actor = actorUUID ? await fromUuid(actorUUID) : null;
  const enrichedContent = await foundry.applications.ux.TextEditor.implementation.enrichHTML(crit.content || "", {
    async: true,
    rollData: actor?.getRollData?.() || {}
  });

  
  await chatOutput({
    title: crit.title,
    subtitle: actor ? `${actor.name} critically hit` : "Ship critically hit",
    content: enrichedContent,
    icon: crit.icon,
    image: actor?.img,
    roll,
    buttons: next ? [
      {
        label: "Escalate Crit",
        icon: "fa-arrow-up-right-dots",
        action: "triggerShipCrit",
        args: [next.min, actor?.uuid ?? null]
      }
    ] : []
  });
}
