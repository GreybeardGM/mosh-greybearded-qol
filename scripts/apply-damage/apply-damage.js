import { getArmorCoverValues } from "../codex/armor-cover.js";
import { getWoundTypeById, getWoundTypeByLabel, getWoundTypeBySettingKey, getWoundTypeByTableSettingKey } from "../codex/wound-types.js";
import { normalizeNumber } from "../utils/normalization.js";
import { automatesWoundRoll, usesTougherArmor } from "../settings/apply-damage-config.js";

import { chatOutput } from "../utils/chat-output.js";

const MOSH_ROLLTABLE_PACK = "mosh.rolltables_1e";

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
    hits += 1;
    effectiveHits = hits;

    if (automatedWoundRoll) {
      automatedWoundsGained += 1;
    }
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

  let automatedWoundResults = [];
  if (automatedWoundsGained > 0) {
    try {
      automatedWoundResults = await rollAutomatedWounds(automatedWoundRoll, automatedWoundsGained);
    } catch {
      // Ignore automated wound roll failures so damage application can continue.
    }
  }

  if (woundsGained > 0) {
    const automatedWoundContent = await renderAutomatedWoundResults(automatedWoundResults);

    if (hits === hitsMax) {
      await chatOutput({
        actor,
        title: game.i18n.localize("MoshQoL.Damage.MaximumWoundsReached"),
        subtitle: actor.name ?? "",
        icon: "fa-skull",
        content: [
          game.i18n.format("MoshQoL.Damage.MaximumWoundsContent", { actorName: actor.name }),
          automatedWoundContent
        ].filter(Boolean).join("<hr>")
      });
    } else {
      const plural = woundsGained !== 1;
      await chatOutput({
        actor,
        title: game.i18n.localize(plural ? "MoshQoL.Damage.WoundsTaken" : "MoshQoL.Damage.WoundTaken"),
        subtitle: actor.name ?? "",
        icon: "fa-heart-broken",
        content: [
          game.i18n.format("MoshQoL.Damage.WoundsSuffered", {
            count: woundsGained,
            wounds: game.i18n.localize(plural ? "MoshQoL.Damage.WoundPlural" : "MoshQoL.Damage.WoundSingular")
          }),
          automatedWoundContent
        ].filter(Boolean).join("<hr>")
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

function getWoundRollFormula(modifier = null) {
  if (modifier === "advantage") return "{1d10z,1d10z}kh";
  if (modifier === "disadvantage") return "{1d10z,1d10z}kl";
  return "1d10z";
}

function getAutomatedWoundRoll(woundMetadata) {
  const automate = automatesWoundRoll();
  if (!automate) return null;
  if (!woundMetadata.tableSettingKey) {
    return null;
  }

  const tableReference = game.settings.get("mosh", woundMetadata.tableSettingKey);
  if (!tableReference) {
    return null;
  }

  return {
    tableReference,
    formula: woundMetadata.woundRollFormula,
    modifier: woundMetadata.woundRollModifier,
    tableSettingKey: woundMetadata.tableSettingKey,
    woundType: woundMetadata.woundType
  };
}

async function rollAutomatedWounds(woundRoll, count) {
  const table = await resolveAutomatedWoundRollTable(woundRoll.tableReference);
  if (!table) {
    return [];
  }

  const results = [];
  for (let i = 0; i < count; i += 1) {
    const rolls = await rollWoundDice(woundRoll.formula);
    const selectedRoll = rolls[0];
    const tableResults = getTableResultsForRoll(table, selectedRoll.total);

    results.push({
      rolls,
      selectedRoll,
      modifier: woundRoll.modifier,
      tableResults
    });
  }

  return results;
}

async function resolveAutomatedWoundRollTable(tableReference) {
  if (!tableReference) {
    return null;
  }

  const reference = String(tableReference).trim();
  if (!reference) {
    return null;
  }

  if (reference.startsWith("RollTable.") || reference.startsWith("Compendium.")) {
    return resolveTableFromUuid(reference);
  }

  const tableByMoshDocumentId = await resolveTableFromMoshCompendium(reference);
  if (tableByMoshDocumentId) return tableByMoshDocumentId;

  const tableByWorldId = game.tables?.get(reference) ?? null;
  if (tableByWorldId) return tableByWorldId;

  const tableByName = game.tables?.getName?.(reference) ?? null;
  if (tableByName) return tableByName;

  const normalizedReference = reference.toLowerCase();
  const tableByCaseInsensitiveName = game.tables?.find?.((table) => table?.name?.toLowerCase?.() === normalizedReference) ?? null;
  if (tableByCaseInsensitiveName) return tableByCaseInsensitiveName;
  return null;
}


async function resolveTableFromMoshCompendium(documentId) {
  const pack = game.packs?.get?.(MOSH_ROLLTABLE_PACK) ?? null;
  if (!pack || pack.documentName !== "RollTable") {
    return null;
  }

  try {
    const index = await pack.getIndex();
    const entry = index?.get?.(documentId) ?? null;
    if (!entry) return null;
    return pack.getDocument(documentId);
  } catch {
    return null;
  }
}

async function resolveTableFromUuid(uuid) {
  try {
    const table = await fromUuid(uuid);
    return table ?? null;
  } catch {
    return null;
  }
}

async function rollWoundDice(formula) {
  const roll = new Roll(formula);
  await roll.evaluate();
  return [roll];
}

function getTableResultsForRoll(table, rollTotal) {
  if (typeof table.getResultsForRoll !== "function") {
    return [];
  }

  const results = Array.from(table.getResultsForRoll(rollTotal) ?? []);
  return results;
}

async function renderAutomatedWoundResults(wounds) {
  if (!wounds.length) return "";

  const entries = [];

  for (const wound of wounds) {
    const rollHtml = renderWoundRolls(wound);
    const resultHtml = await renderTableResults(wound.tableResults);

    entries.push(`<p>${rollHtml}<br>${resultHtml}</p>`);
  }

  return `<div class="mosh-qol-automated-wounds">${entries.join("<hr>")}</div>`;
}

function renderWoundRolls(wound) {
  const rollAnchors = wound.rolls.map((roll) => rollToInlineHtml(roll));
  if (!wound.modifier) return rollAnchors[0] ?? "";

  const modifierLabel = game.i18n.localize(wound.modifier === "advantage"
    ? "MoshQoL.Damage.Advantage"
    : "MoshQoL.Damage.Disadvantage");

  return `${foundry.utils.escapeHTML(modifierLabel)}: ${rollAnchors.join(" / ")}`;
}

function rollToInlineHtml(roll) {
  const fallback = `<span class="inline-roll"><i class="fas fa-dice-d10"></i> ${roll.total}</span>`;
  const anchor = typeof roll.toAnchor === "function" ? roll.toAnchor() : null;
  if (!anchor?.outerHTML) return fallback;

  return anchor.outerHTML;
}

async function renderTableResults(results) {
  if (!results.length) return foundry.utils.escapeHTML(game.i18n.localize("MoshQoL.Damage.NoWoundResult"));

  const resultText = [];
  for (const result of results) {
    resultText.push(await renderTableResult(result));
  }

  return resultText.join("<br>");
}

async function renderTableResult(result) {
  if (typeof result.getHTML === "function") return await result.getHTML();
  const text = result.description ?? result.name ?? "";
  return foundry.utils.escapeHTML(String(text));
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
