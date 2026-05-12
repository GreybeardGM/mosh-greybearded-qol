import { getArmorCoverValues } from "../codex/armor-cover.js";
import { getWoundTypeById, getWoundTypeByLabel, getWoundTypeBySettingKey, getWoundTypeByTableSettingKey } from "../codex/wound-types.js";
import { normalizeNumber } from "../utils/normalization.js";
import { automatesWoundRoll, usesTougherArmor } from "../settings/apply-damage-config.js";

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
export async function applyDamage(actorLike, damageInput, antiArmor = false, woundType = null, woundRollModifier = null) {
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
  const woundMetadata = normalizeWoundMetadata(woundType, woundRollModifier);
  const automatedWoundRoll = getAutomatedWoundRoll(woundMetadata);

  const sys     = actor.system ?? {};
  const hpMax   = normalizeNumber(sys.health?.max, { fallback: 0 });
  let   hp      = normalizeNumber(sys.health?.value, { fallback: 0 });
  let   hits    = normalizeNumber(sys.hits?.value, { fallback: 0 });
  const hitsMax = normalizeNumber(sys.hits?.max, { fallback: Number.MAX_SAFE_INTEGER });

  const armorBroken = hasArmorBrokenStatus(actor);
  const coverValues = getArmorCoverValues(sys.stats?.armor?.cover);
  const baseDamageReduction = normalizeNumber(sys.stats?.armor?.damageReduction, { fallback: 0, min: 0 });
  const baseArmorValue = normalizeNumber(sys.stats?.armor?.mod, { fallback: 0, min: 0 });
  const damageReduction = baseDamageReduction + coverValues.damageReduction;
  const armorValue = baseArmorValue + coverValues.armor;
  const armorReductionLimit = antiArmorHit || armorBroken
    ? damageReduction
    : Math.max(damageReduction, armorValue);

  let remaining = Math.max(0, damage - armorReductionLimit);
  const armorBrokenThresholdReached = usesTougherArmor()
    ? remaining > 0
    : damage >= armorReductionLimit;
  const shouldBreakArmor = !antiArmorHit && !armorBroken && armorBrokenThresholdReached;
  let woundsGained = 0;
  let automatedWoundsGained = 0;
  let effectiveHits = hits;

  const recordWound = () => {
    woundsGained += 1;
    if (automatedWoundRoll) {
      automatedWoundsGained += 1;
      effectiveHits += 1;
      return;
    }

    hits += 1;
    effectiveHits = hits;
  };

  if ((remaining > 0) && (hpMax <= 0)) {
    recordWound();
    remaining = 0;
  }

  while ((remaining > 0) && (effectiveHits < hitsMax)) {
    if (hp > 0 && remaining < hp) {
      hp -= remaining;
      remaining = 0;
    } else {
      if (hp > 0) remaining -= hp;
      recordWound();
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

  if (automatedWoundsGained > 0) {
    await rollAutomatedWounds(automatedWoundRoll, automatedWoundsGained);
  }

  if (woundsGained > 0 && !automatedWoundRoll) {
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
function normalizeWoundMetadata(woundType, woundRollModifier) {
  const type = typeof woundType === "string" && woundType.trim().length > 0
    ? woundType.trim()
    : null;
  const woundTypeDefinition = getWoundTypeDefinition(type);
  const modifier = normalizeWoundRollModifier(woundRollModifier);

  return {
    woundType: type,
    woundRollModifier: modifier,
    woundRollFormula: getWoundRollFormula(modifier),
    woundTypeDefinition,
    tableSettingKey: woundTypeDefinition?.tableSettingKey ?? null
  };
}

function getWoundTypeDefinition(woundType) {
  if (!woundType) return null;

  return getWoundTypeById(woundType)
    ?? getWoundTypeBySettingKey(woundType)
    ?? getWoundTypeByTableSettingKey(woundType)
    ?? getWoundTypeByLabel(woundType);
}

function normalizeWoundRollModifier(woundRollModifier) {
  if (["advantage", "+", "[+]"].includes(woundRollModifier)) return "advantage";
  if (["disadvantage", "-", "[-]"].includes(woundRollModifier)) return "disadvantage";
  return null;
}

function getWoundRollFormula(woundRollModifier) {
  if (woundRollModifier === "advantage") return "1d10 [+]";
  if (woundRollModifier === "disadvantage") return "1d10 [-]";
  return "1d10";
}

function getAutomatedWoundRoll(woundMetadata) {
  if (!automatesWoundRoll()) return null;
  if (!woundMetadata.tableSettingKey) return null;
  if (typeof game?.mosh?.initRollTable !== "function") return null;

  const table = game.settings.get("mosh", woundMetadata.tableSettingKey);
  if (!table) return null;

  return {
    table,
    formula: woundMetadata.woundRollFormula
  };
}

async function rollAutomatedWounds(woundRoll, count) {
  for (let i = 0; i < count; i += 1) {
    await game.mosh.initRollTable(woundRoll.table, woundRoll.formula, "low", true, false, null, null);
  }
}

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
