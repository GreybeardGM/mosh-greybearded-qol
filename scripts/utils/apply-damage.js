// apply-damage-with-hits.js
import { chatOutput } from "./chat-output.js";

/**
 * Wendet Schaden an und verrechnet HP-Reset & HITS-Zuwachs ohne Rekursion.
 * Nutzt Systemfelder:
 *   system.health.value / system.health.max
 *   system.hits.value   / system.hits.max
 * Wenn damage fehlt oder kein gültiger Wert ist, fragt ein Dialog danach.
 */
export async function applyDamageWithHits(actorLike, damage) {
  const actor = await resolveActorLike(actorLike);
  if (!actor) throw new Error("applyDamageWithHits: Actor nicht gefunden.");

  // Wenn kein gültiger Damage angegeben, Dialog öffnen
  if (!Number.isFinite(damage) || damage <= 0) {
    const dlg = await foundry.applications.api.DialogV2.input({
      title: "Apply Damage",
      content: `<p>Enter the amount of damage to apply to <strong>${actor.name}</strong>:</p>`,
      fields: [
        {
          type: "number",
          label: "Damage",
          name: "damage",
          min: 1,
          step: 1,
          required: true
        }
      ],
      ok: { label: "Apply" },
      cancel: { label: "Cancel" }
    });

    if (!dlg || !dlg.damage) return; // Abbrechen → nichts tun
    damage = Number(dlg.damage);
  }

  const sys     = actor.system ?? {};
  const hpMax   = toInt(sys.health?.max, 0);
  let   hp      = toInt(sys.health?.value, 0);
  let   hits    = toInt(sys.hits?.value, 0);
  const hitsMax = toInt(sys.hits?.max, Number.MAX_SAFE_INTEGER);

  if (hpMax <= 0) throw new Error("applyDamageWithHits: hpMax <= 0 – Actor-Daten prüfen.");

  let remaining     = Math.trunc(damage);
  let woundsGained  = 0;

  while (remaining > 0) {
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

  hits = Math.min(hits, hitsMax);

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
        content: `${actor.name} has reached their maximum number of wounds!`
      });
    } else {
      const plural = woundsGained !== 1;
      await chatOutput({
        actor,
        title: plural ? "Wounds Taken" : "Wound Taken",
        subtitle: actor.name ?? "",
        icon: "fa-heart-broken",
        content: `${woundsGained} ${plural ? "wounds" : "wound"} suffered.`
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

function toInt(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fb;
}
