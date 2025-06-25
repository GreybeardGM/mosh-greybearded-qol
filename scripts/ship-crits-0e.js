import { SHIP_CRITS } from "./config/default-ship-crits-0e.js";

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
export async function triggerShipCrit(setCrit) {
  if (!setCrit) {
    const roll = await new Roll("1d100-1").roll({ async: true });
    const crit = findCrit(roll.total);
  }
  else {
    const crit = findCrit(setCrit);
  }
  
  if (!crit) return ui.notifications.warn(`Kein Treffer für Wurf: ${roll.total}`);
  const next = findEscalation(entry);

  await chatOutput({
    title: crit.title,
    subtitle: "Ship: Critical Hit",
    content: crit.content || "",
    icon: crit.icon,
    roll,
    buttons: [
      {
        label: "Escalate Crit",
        icon: "fa-arrow-up-right-dots",
        action: "triggerCrit",
        args: [next]
      }
    ]
  });
}
