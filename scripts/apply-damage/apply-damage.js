import { normalizeNumber } from "../utils/normalization.js";

import { chatOutput } from "../utils/chat-output.js";

/**
 * Wendet Schaden an und verrechnet HP-Reset & HITS-Zuwachs ohne Rekursion.
 *
 * Eingabevertrag für `damageInput`:
 * - akzeptiert eine Zahl (z. B. 7) oder einen rohen Dialogwert (z. B. "7")
 * - normalisiert intern genau einmal über `parseDamageInput`
 * - bei `null`/`undefined` wird ein Dialog geöffnet
 *
 * Nutzt Systemfelder:
 *   system.health.value / system.health.max
 *   system.hits.value   / system.hits.max
 *
 * @returns {Promise<boolean>} true, wenn Schaden verarbeitet wurde; false bei Abbruch/ungültiger Eingabe.
 */
export async function applyDamage(actorLike, damageInput, antiArmor = false) {
  const actor = await resolveActorLike(actorLike);
  if (!actor) throw new Error("applyDamage: Actor nicht gefunden.");
  if (actor.type === "ship") return false;

  let damageRaw = damageInput;

  // Falls kein Wert angegeben: über DialogV2.input abfragen
  if (damageRaw === null || damageRaw === undefined) {
    const data = await promptDamageInput({
      title: game.i18n.localize("MoshQoL.Damage.ApplyDamage"),
      message: game.i18n.format("MoshQoL.Damage.EnterAmountForActor", { actorName: actor.name })
    });

    // Abbruch per X liefert null → nichts tun
    if (!data) return false;
    damageRaw = data.damage;
    antiArmor = data.antiArmor;
  }

  const damage = parseDamageInput(damageRaw);
  if (damage === null) {
    ui.notifications?.warn?.(game.i18n.localize("MoshQoL.Damage.PositiveValueRequired"));
    return false;
  }

  const antiArmorHit = parseAntiArmorInput(antiArmor);

  const sys     = actor.system ?? {};
  const hpMax   = normalizeNumber(sys.health?.max, { fallback: 0 });
  let   hp      = normalizeNumber(sys.health?.value, { fallback: 0 });
  let   hits    = normalizeNumber(sys.hits?.value, { fallback: 0 });
  const hitsMax = normalizeNumber(sys.hits?.max, { fallback: Number.MAX_SAFE_INTEGER });

  const armorBroken = hasArmorBrokenStatus(actor);
  const damageReduction = normalizeNumber(sys.stats?.armor?.damageReduction, { fallback: 0, min: 0 });
  const armorValue = normalizeNumber(sys.stats?.armor?.mod, { fallback: 0, min: 0 });
  const armorReductionLimit = antiArmorHit || armorBroken
    ? damageReduction
    : Math.max(damageReduction, armorValue);

  let remaining = Math.max(0, damage - armorReductionLimit);
  const shouldBreakArmor = !antiArmorHit && !armorBroken && remaining > 0;
  let woundsGained  = 0;

  if ((remaining > 0) && (hpMax <= 0)) {
    hits += 1;
    woundsGained = 1;
    remaining = 0;
  }

  while ((remaining > 0) && (hits < hitsMax)) {
    if (remaining < hp) {
      hp -= remaining;
      remaining = 0;
    } else {
      remaining -= hp;
      hits += 1;
      woundsGained += 1;
      hp = hpMax;
    }
  }

  await actor.update({
    "system.health.value": hp,
    "system.hits.value": hits
  });

  if (shouldBreakArmor) {
    await setArmorBrokenStatus(actor);
  }

  if (woundsGained > 0) {
    if (hits === hitsMax) {
      await chatOutput({
        actor,
        title: game.i18n.localize("MoshQoL.Damage.MaximumWoundsReached"),
        subtitle: actor.name ?? "",
        icon: "fa-skull",
        content: game.i18n.format("MoshQoL.Damage.MaximumWoundsContent", { actorName: actor.name })
      });
    } else {
      const plural = woundsGained !== 1;
      await chatOutput({
        actor,
        title: game.i18n.localize(plural ? "MoshQoL.Damage.WoundsTaken" : "MoshQoL.Damage.WoundTaken"),
        subtitle: actor.name ?? "",
        icon: "fa-heart-broken",
        content: game.i18n.format("MoshQoL.Damage.WoundsSuffered", {
          count: woundsGained,
          wounds: game.i18n.localize(plural ? "MoshQoL.Damage.WoundPlural" : "MoshQoL.Damage.WoundSingular")
        })
      });
    }
  }

  return true;
}

/**
 * Öffnet den gemeinsamen Apply-Damage-Dialog und liefert rohe Dialogwerte zurück.
 * Die eigentliche Validierung/Normalisierung bleibt in applyDamage.
 */
export async function promptDamageInput({ title, message, cancel = null } = {}) {
  return foundry.applications.api.DialogV2.input({
    window: { title: title ?? game.i18n.localize("MoshQoL.Damage.ApplyDamage") },
    content: `
      <p>${message ?? game.i18n.localize("MoshQoL.Damage.EnterAmount")}</p>
      <input name="damage" type="number" min="1" step="1" autofocus style="width:100%">
      <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;">
        <input name="antiArmor" type="checkbox">
        <span>${game.i18n.localize("MoshQoL.Damage.AntiArmor")}</span>
      </label>
    `,
    ok: { label: game.i18n.localize("MoshQoL.Damage.Apply"), icon: "fa-solid fa-check" },
    ...(cancel ? { cancel } : {})
  });
}

/** Actor aus verschiedenen Eingabeformen auflösen */
async function resolveActorLike(actorLike) {
  if (!actorLike) return null;
  if (actorLike instanceof Actor) return actorLike;
  if (actorLike?.actor instanceof Actor) return actorLike.actor;
  if (typeof actorLike === "string") return game.actors?.get(actorLike) ?? null;
  if (actorLike.document?.actor instanceof Actor) return actorLike.document.actor;
  return null;
}

/** Parsen/Validieren der Schaden-Eingabe (einziger Normalisierungspfad). */
function parseDamageInput(damageInput) {
  const parsed = normalizeNumber(damageInput, { fallback: null, min: 1 });
  if (parsed === null) return null;
  return Math.trunc(parsed);
}

/** Normalisiert das optionale Anti-Armor-Argument. */
function parseAntiArmorInput(antiArmor) {
  if (typeof antiArmor === "object" && antiArmor !== null) return parseAntiArmorInput(antiArmor.antiArmor);
  if (typeof antiArmor === "string") {
    const normalized = antiArmor.trim().toLowerCase();
    return ["true", "on", "1", "yes"].includes(normalized);
  }
  return antiArmor === true;
}

/** Prüft, ob der Armor-Broken-Status bereits aktiv ist. */
function hasArmorBrokenStatus(actor) {
  return actor?.statuses?.has("qol-broken-armor") === true;
}

/** Aktiviert den Armor-Broken-Status, sofern die Actor-API verfügbar ist. */
async function setArmorBrokenStatus(actor) {
  if (typeof actor?.toggleStatusEffect === "function") {
    await actor.toggleStatusEffect("qol-broken-armor", { active: true });
  }
}
