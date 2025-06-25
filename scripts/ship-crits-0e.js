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
 * Post a crit entry to chat with optional escalation button
 */
function postCrit(entry, fullList) {
  const next = findEscalation(entry);
  const buttons = next ? {
    escalate: {
      label: "Eskalieren",
      callback: () => postCrit(next, fullList)
    }
  } : {};

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="ship-crit" style="padding: 0.5em 0.75em; border-left: 4px solid #ff5500; background: #1a1a1a; color: #ccc;">
        <h3 style="margin: 0 0 0.25em; font-size: 1.1em;">
          <i class="fa-solid ${entry.icon}" style="margin-right: 0.5em;"></i>
          ${entry.title}
        </h3>
        <div style="line-height: 1.4;">${entry.content}</div>
      </div>
    `,
    buttons
  });
}

/**
 * Main entry point
 */
export async function triggerShipCrit() {
  const roll = await new Roll("1d100").roll({ async: true });
  await roll.toMessage({ flavor: "Ship Critical Hit Roll" });
  const crit = findCrit(roll.total);
  if (!crit) return ui.notifications.warn(`Kein Treffer für Wurf: ${roll.total}`);
  postCrit(crit, SHIP_CRITS);
}
