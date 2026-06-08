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

import { chatOutput, rawChatHTML } from "../utils/chat-output.js";
import { resolveApplyDamageTargets } from "./policy.js";
import { ApplyDamageInputApp } from "./damage-input-app.js";
import { calculateDamageOutcome } from "./damage-outcome.js";
import { syncArmorBrokenToolbandButton } from "../toolband.js";
import { STATUS_ARMOR_BROKEN } from "../codex/constants.js";
import { MOSH_ROLLTABLE_PACK_ID } from "../codex/mosh-system.js";

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

  const actorList = filterActorsBySelectedIndexes(targets, normalizedPayload.selectedTargetIndexes);
  if (!actorList.length) return false;

  // 3) Eigentliche Actor-Verarbeitung
  const applied = await applyDamageToActors(actorList, normalizedPayload, { applyDamageConfig });
  return applied > 0;
}

export async function applyDamageToActors(actors, payload, options = {}) {
  const actorList = getUniqueActorsFromTargets(actors);
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

export function getUniqueActorsFromTargets(targets) {
  const rawList = Array.isArray(targets) ? targets : [targets];
  const seen = new Set();
  const uniqueActors = [];

  for (const target of rawList) {
    const actor = target?.actor ?? target;
    if (!actor) continue;

    const key = actor.uuid ?? actor.id ?? actor;
    if (seen.has(key)) continue;

    seen.add(key);
    uniqueActors.push(actor);
  }

  return uniqueActors;
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
  let selectedTargetIndexes = targets.map((_actor, index) => index);

  if (damageRaw === null || damageRaw === undefined) {
    const data = await promptDamageInput({
      title: game.i18n.localize("MoshQoL.Damage.ApplyDamage"),
      message: game.i18n.format("MoshQoL.Damage.EnterAmountForActor", { actorName: targets[0]?.name ?? "" }),
      targets
    });

    if (!data) return null;
    damageRaw = data.damage;
    antiArmorRaw = data.antiArmor;
    selectedTargetIndexes = normalizeSelectedTargetIndexes(data.selectedTargetIndexes, targets.length);
  }

  const damage = parseDamageInput(damageRaw);
  if (damage === null) {
    ui.notifications?.warn?.(game.i18n.localize("MoshQoL.Damage.PositiveValueRequired"));
    return null;
  }

  return {
    damage,
    antiArmorHit: parseAntiArmorInput(antiArmorRaw),
    woundMetadata: normalizeWoundMetadata(woundType, woundRollModifier),
    selectedTargetIndexes
  };
}

function normalizeSelectedTargetIndexes(indexes, maxLength) {
  if (!Array.isArray(indexes)) return Array.from({ length: maxLength }, (_v, index) => index);

  const seen = new Set();
  const normalized = [];
  for (const rawIndex of indexes) {
    const index = Number.parseInt(rawIndex, 10);
    if (!Number.isInteger(index) || index < 0 || index >= maxLength || seen.has(index)) continue;
    seen.add(index);
    normalized.push(index);
  }

  return normalized;
}

function filterActorsBySelectedIndexes(targets, selectedTargetIndexes) {
  const normalized = normalizeSelectedTargetIndexes(selectedTargetIndexes, targets.length);
  const selectedTargets = [];
  for (const index of normalized) selectedTargets.push(targets[index]);
  return getUniqueActorsFromTargets(selectedTargets);
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
    await emitWoundChatMessage({
      actor,
      woundsGained,
      maximumWoundsReached: hits === hitsMax,
      automatedWoundResults
    });
  }

  return true;
}

async function enrichChatReference(content) {
  const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(content || "", {
    async: true
  });
  return rawChatHTML(enriched);
}

async function emitWoundChatMessage({ actor, woundsGained, maximumWoundsReached, automatedWoundResults }) {
  const automatedWoundBlocks = await getAutomatedWoundChatBlocks(automatedWoundResults);

  if (maximumWoundsReached) {
    const deathSaveMacro = await enrichChatReference(game.i18n.localize("MoshQoL.Damage.DeathSaveMacro"));

    return chatOutput({
      actor,
      title: game.i18n.localize("MoshQoL.Damage.MaximumWoundsReached"),
      subtitle: actor.name ?? "",
      icon: "fa-skull",
      blocks: [
        { type: "text", text: game.i18n.format("MoshQoL.Damage.MaximumWoundsContent", { actorName: actor.name }) },
        { type: "html", html: deathSaveMacro },
        ...automatedWoundBlocks
      ]
    });
  }

  const plural = woundsGained !== 1;
  const woundsLabel = game.i18n.localize(plural ? "MoshQoL.Damage.WoundPlural" : "MoshQoL.Damage.WoundSingular");
  const woundCheckMacro = await enrichChatReference(game.i18n.localize("MoshQoL.Damage.WoundCheckMacro"));

  return chatOutput({
    actor,
    title: game.i18n.localize(plural ? "MoshQoL.Damage.WoundsTaken" : "MoshQoL.Damage.WoundTaken"),
    subtitle: actor.name ?? "",
    icon: "fa-heart-broken",
    blocks: [
      {
        type: "counter",
        value: woundsGained,
        label: game.i18n.format("MoshQoL.Damage.WoundsSuffered", { wounds: woundsLabel }),
        suffix: woundCheckMacro
      },
      ...automatedWoundBlocks
    ]
  });
}

async function getAutomatedWoundChatBlocks(automatedWoundResults) {
  const automatedWoundEntries = await buildAutomatedWoundRollEntries(automatedWoundResults);
  return automatedWoundEntries.length
    ? [{ type: "separator" }, { type: "automatedWounds", entries: automatedWoundEntries }]
    : [];
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

  const resolvedTable = reference.startsWith("RollTable.") || reference.startsWith("Compendium.")
    ? await resolveTableFromUuid(reference)
    : await resolveNamedOrIdTableReference(reference);

  automatedWoundRollTableCache.set(reference, resolvedTable ?? null);
  return resolvedTable ?? null;
}

async function resolveNamedOrIdTableReference(reference) {
  const moshTable = await resolveTableFromMoshCompendium(reference);
  return moshTable
    ?? game.tables?.get(reference)
    ?? game.tables?.getName?.(reference)
    ?? findWorldTableByNormalizedName(reference);
}

function findWorldTableByNormalizedName(reference) {
  const normalizedReference = reference.toLowerCase();
  return game.tables?.find?.((table) => table?.name?.toLowerCase?.() === normalizedReference) ?? null;
}

async function resolveTableFromMoshCompendium(documentId) {
  const pack = game.packs?.get?.(MOSH_ROLLTABLE_PACK_ID) ?? null;
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

async function buildAutomatedWoundRollEntries(wounds) {
  if (!wounds.length) return [];

  const entries = [];

  for (const wound of wounds) {
    entries.push({
      rollLabel: getWoundRollLabel(wound),
      rolls: wound.rolls.map((roll) => renderRollInline(roll)),
      results: await renderTableResults(wound.tableResults)
    });
  }

  return entries;
}

function getWoundRollLabel(wound) {
  if (!wound.modifier) return "";

  return game.i18n.localize(wound.modifier === "advantage"
    ? "MoshQoL.Damage.Advantage"
    : "MoshQoL.Damage.Disadvantage");
}

function renderRollInline(roll) {
  const anchor = typeof roll.toAnchor === "function" ? roll.toAnchor() : null;
  if (anchor?.outerHTML) return rawChatHTML(anchor.outerHTML);

  return roll.total;
}

async function renderTableResults(results) {
  if (!results.length) return [game.i18n.localize("MoshQoL.Damage.NoWoundResult")];

  const resultText = [];
  for (const result of results) {
    resultText.push(await renderTableResult(result));
  }

  return resultText;
}

async function renderTableResult(result) {
  if (typeof result.getHTML === "function") return rawChatHTML(await result.getHTML());
  const text = result.description ?? result.name ?? "";
  return String(text);
}

function parseAntiArmorInput(antiArmor) {
  if (typeof antiArmor === "object" && antiArmor !== null) return parseAntiArmorInput(antiArmor.antiArmor);
  return normalizeBoolean(antiArmor, { fallback: false });
}

/** Prüft, ob der Armor-Broken-Status bereits aktiv ist. */
function hasArmorBrokenStatus(actor) {
  return actor?.statuses?.has(STATUS_ARMOR_BROKEN) === true;
}

/** Aktiviert den Armor-Broken-Status, sofern die Actor-API verfügbar ist. */
async function setArmorBrokenStatus(actor) {
  if (typeof actor?.toggleStatusEffect === "function") {
    await actor.toggleStatusEffect(STATUS_ARMOR_BROKEN, { active: true });
    syncArmorBrokenToolbandButton(actor);
  }
}
