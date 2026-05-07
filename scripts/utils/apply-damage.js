import { normalizeNumber } from "./normalization.js";

// apply-damage-with-hits.js
import { chatOutput } from "./chat-output.js";

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
 */
export async function applyDamage(actorLike, damageInput) {
  const actor = await resolveActorLike(actorLike);
  if (!actor) throw new Error("applyDamageWithHits: Actor nicht gefunden.");

  let damageRaw = damageInput;

  // Falls kein Wert angegeben: über DialogV2.input abfragen
  if (damageRaw === null || damageRaw === undefined) {
    const data = await foundry.applications.api.DialogV2.input({
      window: { title: "Apply Damage" },
      content: `
        <p>Enter the amount of damage to apply to <strong>${actor.name}</strong>:</p>
        <input name="damage" type="number" min="1" step="1" autofocus style="width:100%">
      `,
      ok: { label: "Apply", icon: "fa-solid fa-check" },
      // In v13 ist rejectClose standardmäßig false → X liefert null statt Exception.
      // rejectClose: false 
    });
  
    // Abbruch per X liefert null → nichts tun
    if (!data) return;
    damageRaw = data?.damage;
  }

  const damage = parseDamageInput(damageRaw);
  if (damage === null) {
    ui.notifications?.warn?.("Please enter a positive damage value.");
    return;
  }

  const sys     = actor.system ?? {};
  const hpMax   = normalizeNumber(sys.health?.max, { fallback: 0 });
  let   hp      = normalizeNumber(sys.health?.value, { fallback: 0 });
  let   hits    = normalizeNumber(sys.hits?.value, { fallback: 0 });
  const hitsMax = normalizeNumber(sys.hits?.max, { fallback: Number.MAX_SAFE_INTEGER });

  if (hpMax <= 0) throw new Error("applyDamageWithHits: hpMax <= 0 – Actor-Daten prüfen.");

  let remaining     = damage;
  let woundsGained  = 0;

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

  if (woundsGained > 0) {
    if (hits === hitsMax) {
      await chatOutput({
        actor,
        title: "Maximum Wounds Reached",
        subtitle: actor.name ?? "",
        icon: "fa-skull",
        content: `${actor.name} has reached their maximum number of wounds!<br>@Macro[Death Save]`
      });
    } else {
      const plural = woundsGained !== 1;
      await chatOutput({
        actor,
        title: plural ? "Wounds Taken" : "Wound Taken",
        subtitle: actor.name ?? "",
        icon: "fa-heart-broken",
        content: `${woundsGained} ${plural ? "wounds" : "wound"} suffered.<br>@Macro[Wound Check]`
      });
    }
  }
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
