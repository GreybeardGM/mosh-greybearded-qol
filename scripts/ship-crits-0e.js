import { SHIP_CRITS } from "./config/default-ship-crits-0e.js";
import { chatOutput } from "./helpers/chat-output.js";

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
    roll = await new Roll("1d100-1").roll({ async: true });
    crit = findCrit(roll.total);
  }

  if (!crit) return ui.notifications.warn(`Kein Treffer für: ${setCrit ?? roll?.total}`);
  const next = findEscalation(crit);
  const actor = actorUUID ? await fromUuid(actorUUID) : null;

  await chatOutput({
    title: crit.title,
    subtitle: actor ? `${actor.name} critically hit` : "Ship critically hit",
    content: crit.content || "",
    icon: crit.icon,
    image: actor?.img,
    roll,
    buttons: next ? [
      {
        label: "Escalate Crit",
        icon: "fa-arrow-up-right-dots",
        action: "triggerCrit",
        args: [next.min, actor?.uuid]
      }
    ] : []
  });
}
