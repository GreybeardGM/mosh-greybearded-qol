import { getArmorCoverValues } from "../codex/armor-cover.js";
import { getWoundTypeById, getWoundTypeByLabel, getWoundTypeBySettingKey, getWoundTypeByTableSettingKey } from "../codex/wound-types.js";
import { normalizeBoolean, normalizeNumber } from "../utils/normalization.js";
import {
  appliesArmorBrokenFromConfig,
  automatesWoundRollFromConfig,
  getNormalizedApplyDamageConfig,
  usesTougherArmorFromConfig
} from "../settings/apply-damage-config.js";
import { QoLContractorSheet } from "../sheets/contractor-sheet-class.js";

import { chatOutput } from "../utils/chat-output.js";
import { resolveApplyDamageTargets } from "./policy.js";
import { ApplyDamageInputApp } from "./damage-input-app.js";

const MOSH_ROLLTABLE_PACK = "mosh.rolltables_1e";
const automatedWoundRollTableCache = new Map();
// Cache-Invalidierung: Ein Foundry-Reload ist ausreichend, da das Modul neu geladen wird.
// Optional kann bei Settings-/Pack-Änderungen explizit `automatedWoundRollTableCache.clear()` aufgerufen werden.

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
  const applyDamageConfig = getNormalizedApplyDamageConfig();

  // 1) Target-Auflösung
  const targets = await resolveApplyDamageTargets(actorLike);
  if (!targets.length) return false;

  // 2) Input-Normalisierung
  const normalizedPayload = await normalizeApplyDamagePayload({
    damageInput,
    antiArmor,
    woundType,
    woundRollModifier,
    targets
  });
  if (!normalizedPayload) return false;

  // 3) Eigentliche Actor-Verarbeitung
  const applied = await applyDamageToActors(targets, normalizedPayload, { applyDamageConfig });
  return applied > 0;
}

export async function applyDamageToActors(actors, payload, options = {}) {
  const actorList = Array.isArray(actors) ? actors.filter(Boolean) : [];
  if (!actorList.length || !payload) return false;

  const normalizedPayload = normalizeActorApplyDamagePayload(payload);
  if (!normalizedPayload) return false;

  const applyDamageConfig = options.applyDamageConfig ?? getNormalizedApplyDamageConfig();

  let applied = 0;
  for (const actor of actorList) {
    const didApply = await applyDamageToActor(actor, normalizedPayload, applyDamageConfig);
    if (didApply) applied += 1;
  }

  return applied;
}


function normalizeActorApplyDamagePayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const damage = parseDamageInput(payload.damage);
  if (damage === null) return null;

  const woundMetadataInput = payload.woundMetadata ?? {};

  return {
    damage,
    antiArmorHit: parseAntiArmorInput(payload.antiArmorHit),
    woundMetadata: normalizeWoundMetadata(woundMetadataInput.woundType, woundMetadataInput.woundRollModifier)
  };
}

async function normalizeApplyDamagePayload({ damageInput, antiArmor = false, woundType = null, woundRollModifier = null, targets = [] } = {}) {
  let damageRaw = damageInput;
  let antiArmorRaw = antiArmor;

  if (damageRaw === null || damageRaw === undefined) {
    const data = await promptDamageInput({
      title: game.i18n.localize("MoshQoL.Damage.ApplyDamage"),
      message: game.i18n.format("MoshQoL.Damage.EnterAmountForActor", { actorName: targets[0]?.name ?? "" }),
      targets
    });

    if (!data) return null;
    damageRaw = data.damage;
    antiArmorRaw = data.antiArmor;
  }

  const damage = parseDamageInput(damageRaw);
  if (damage === null) {
    ui.notifications?.warn?.(game.i18n.localize("MoshQoL.Damage.PositiveValueRequired"));
    return null;
  }

  return {
    damage,
    antiArmorHit: parseAntiArmorInput(antiArmorRaw),
    woundMetadata: normalizeWoundMetadata(woundType, woundRollModifier)
  };
}

async function applyDamageToActor(actor, normalizedPayload, applyDamageConfig = null) {
  if (actor.type === "ship") return false;

  const { damage, antiArmorHit, woundMetadata } = normalizedPayload;
  const automatedWoundRoll = getAutomatedWoundRoll(woundMetadata, getApplyDamageActorScope(actor), applyDamageConfig);
  const sys     = actor.system ?? {};
  const hpMax   = normalizeNumber(sys.health?.max, { fallback: 0 });
  let   hp      = normalizeNumber(sys.health?.value, { fallback: 0 });
  let   hits    = normalizeNumber(sys.hits?.value, { fallback: 0 });
  const hitsMax = normalizeNumber(sys.hits?.max, { fallback: Number.MAX_SAFE_INTEGER });
  if (hitsMax <= 0) return false;

  const armorBroken = hasArmorBrokenStatus(actor);
  const coverValues = getArmorCoverValues(sys.stats?.armor?.cover);
  const baseDamageReduction = normalizeNumber(sys.stats?.armor?.damageReduction, { fallback: 0, min: 0 });
  const baseArmorValue = normalizeNumber(sys.stats?.armor?.mod, { fallback: 0, min: 0 });
  const damageReduction = baseDamageReduction + coverValues.damageReduction;
  const armorValue = baseArmorValue + coverValues.armor;
  const hasArmorValue = armorValue > 0;
  const armorReductionLimit = antiArmorHit || armorBroken
    ? damageReduction
    : Math.max(damageReduction, armorValue);

  const remaining = Math.max(0, damage - armorReductionLimit);
  const armorBrokenThresholdReached = usesTougherArmorFromConfig(applyDamageConfig)
    ? remaining > 0
    : damage >= armorReductionLimit;
  const canApplyArmorBroken = appliesArmorBrokenFromConfig(applyDamageConfig);
  const canEverBreakArmor = hasArmorValue;
  const shouldBreakArmor = canEverBreakArmor
    && canApplyArmorBroken
    && !antiArmorHit
    && !armorBroken
    && armorBrokenThresholdReached;

  const originalHp = hp;
  const originalHits = hits;
  const damageOutcome = calculateDamageOutcome({ hp, hpMax, hits, hitsMax, remaining });
  hp = damageOutcome.hp;
  hits = damageOutcome.hits;
  const woundsGained = damageOutcome.woundsGained;
  const automatedWoundsGained = automatedWoundRoll ? woundsGained : 0;

  if (hp !== originalHp || hits !== originalHits) {
    await actor.update({
      "system.health.value": hp,
      "system.hits.value": hits
    });
  }

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


function calculateDamageOutcome({ hp, hpMax, hits, hitsMax, remaining }) {
  let woundsGained = 0;
  const availableWounds = Math.max(0, hitsMax - hits);

  if (remaining <= 0 || availableWounds <= 0) {
    return { hp, hits, remaining, woundsGained };
  }

  if (hpMax <= 0) {
    return { hp, hits: hits + 1, remaining: 0, woundsGained: 1 };
  }

  if (hp > 0) {
    if (remaining < hp) {
      return { hp: hp - remaining, hits, remaining: 0, woundsGained };
    }

    remaining -= hp;
    woundsGained += 1;
    hits += 1;
    hp = hpMax;
  }

  const remainingWoundCapacity = Math.max(0, hitsMax - hits);
  const extraWounds = Math.min(remainingWoundCapacity, Math.ceil(remaining / hpMax));

  if (extraWounds > 0) {
    woundsGained += extraWounds;
    hits += extraWounds;
    remaining = Math.max(0, remaining - (extraWounds * hpMax));
    hp = hpMax;
  }

  return { hp, hits, remaining, woundsGained };
}

/**
 * Öffnet den gemeinsamen Apply-Damage-Dialog und liefert rohe Dialogwerte zurück.
 * Die eigentliche Validierung/Normalisierung bleibt in applyDamage.
 */
export async function promptDamageInput({ title, message, targets = [], cancel = null } = {}) {
  return ApplyDamageInputApp.waitForInput({ title, message, targets, cancel });
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

function getApplyDamageActorScope(actor) {
  if (actor?.type === "character") return "character";
  if (actor?.type === "creature") {
    return isContractorActor(actor) ? "contractor" : "creature";
  }
  return null;
}

function isContractorActor(actor) {
  const sheet = actor?.sheet ?? null;
  if (sheet instanceof QoLContractorSheet) return true;

  const sheetClass = actor?.getFlag?.("core", "sheetClass");
  return typeof sheetClass === "string" && sheetClass.includes("QoLContractorSheet");
}

function getAutomatedWoundRoll(woundMetadata, actorScope, applyDamageConfig = null) {
  const automate = automatesWoundRollFromConfig(applyDamageConfig, actorScope);
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

  if (automatedWoundRollTableCache.has(reference)) {
    return automatedWoundRollTableCache.get(reference) ?? null;
  }

  let resolvedTable = null;
  if (reference.startsWith("RollTable.") || reference.startsWith("Compendium.")) {
    resolvedTable = await resolveTableFromUuid(reference);
  } else {
    const tableByMoshDocumentId = await resolveTableFromMoshCompendium(reference);
    if (tableByMoshDocumentId) {
      resolvedTable = tableByMoshDocumentId;
    } else {
      const tableByWorldId = game.tables?.get(reference) ?? null;
      if (tableByWorldId) {
        resolvedTable = tableByWorldId;
      } else {
        const tableByName = game.tables?.getName?.(reference) ?? null;
        if (tableByName) {
          resolvedTable = tableByName;
        } else {
          const normalizedReference = reference.toLowerCase();
          resolvedTable = game.tables?.find?.((table) => table?.name?.toLowerCase?.() === normalizedReference) ?? null;
        }
      }
    }
  }

  automatedWoundRollTableCache.set(reference, resolvedTable ?? null);
  return resolvedTable ?? null;
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
  return normalizeBoolean(antiArmor, { fallback: false });
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
