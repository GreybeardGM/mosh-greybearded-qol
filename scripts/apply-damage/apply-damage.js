import { getArmorCoverValues } from "../codex/armor-cover.js";
import { getWoundTypeById, getWoundTypeByLabel, getWoundTypeBySettingKey, getWoundTypeByTableSettingKey } from "../codex/wound-types.js";
import { normalizeNumber } from "../utils/normalization.js";
import { automatesWoundRoll, usesTougherArmor } from "../settings/apply-damage-config.js";

import { chatOutput } from "../utils/chat-output.js";

const APPLY_DAMAGE_LOG_PREFIX = "[MoSh QoL Apply Damage]";
const MOSH_ROLLTABLE_PACK = "mosh.rolltables_1e";
const MOSH_WOUND_TABLE_SETTING_KEYS = new Set([
  "table1eWoundBluntForce",
  "table1eWoundBleeding",
  "table1eWoundGunshot",
  "table1eWoundFireExplosives",
  "table1eWoundGoreMassive"
]);
const FOUNDRY_ID_LIKE_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

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
  logApplyDamageDebug("prepared wound automation", {
    actor: getActorLogData(actor),
    damage,
    antiArmor: antiArmorHit,
    woundMetadata,
    automatedWoundRoll
  });

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

  logApplyDamageDebug("damage processing complete", {
    actor: getActorLogData(actor),
    woundsGained,
    automatedWoundsGained,
    hp,
    hits,
    hitsMax,
    automatedWoundRoll
  });

  let automatedWoundResults = [];
  if (automatedWoundsGained > 0) {
    try {
      automatedWoundResults = await rollAutomatedWounds(automatedWoundRoll, automatedWoundsGained, { actor });
    } catch (error) {
      logApplyDamageError("automated wound rolls failed", {
        actor: getActorLogData(actor),
        woundsGained,
        automatedWoundsGained,
        automatedWoundRoll,
        woundMetadata
      }, error);
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
    woundRollFormula: getWoundRollFormula(),
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

function getWoundRollFormula() {
  return "1d10z";
}

function getAutomatedWoundRoll(woundMetadata) {
  const automate = automatesWoundRoll();
  logApplyDamageDebug("checking automated wound roll setting", {
    automate,
    woundMetadata
  });

  if (!automate) return null;
  if (!woundMetadata.tableSettingKey) {
    logApplyDamageWarning("automated wound roll skipped: missing wound table setting key", { woundMetadata });
    return null;
  }

  const tableReference = game.settings.get("mosh", woundMetadata.tableSettingKey);
  logApplyDamageDebug("loaded wound table reference from mosh setting", {
    tableSettingKey: woundMetadata.tableSettingKey,
    tableReference,
    referenceType: typeof tableReference
  });

  if (!tableReference) {
    logApplyDamageWarning("automated wound roll skipped: mosh wound table setting is empty", { woundMetadata });
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

async function rollAutomatedWounds(woundRoll, count, { actor = null } = {}) {
  logApplyDamageDebug("starting automated wound rolls", {
    actor: getActorLogData(actor),
    woundRoll,
    count
  });

  const table = await resolveAutomatedWoundRollTable(woundRoll.tableReference, {
    tableSettingKey: woundRoll.tableSettingKey
  });
  if (!table) {
    logApplyDamageWarning("automated wound roll aborted: rolltable could not be resolved", {
      actor: getActorLogData(actor),
      woundRoll
    });
    return [];
  }

  logApplyDamageDebug("resolved wound rolltable", {
    actor: getActorLogData(actor),
    table: getRollTableLogData(table)
  });

  const results = [];
  for (let i = 0; i < count; i += 1) {
    logApplyDamageDebug("rolling automated wound", {
      actor: getActorLogData(actor),
      woundIndex: i + 1,
      formula: woundRoll.formula,
      modifier: woundRoll.modifier
    });

    const rolls = await rollWoundDice(woundRoll.formula, woundRoll.modifier);
    const selectedRoll = selectWoundRoll(rolls, woundRoll.modifier);
    const tableResults = getTableResultsForRoll(table, selectedRoll.total);

    logApplyDamageDebug("automated wound roll result", {
      actor: getActorLogData(actor),
      woundIndex: i + 1,
      rolls: rolls.map(getRollLogData),
      selectedRoll: getRollLogData(selectedRoll),
      tableResultCount: tableResults.length,
      tableResults: tableResults.map(getRollTableResultLogData)
    });

    results.push({
      rolls,
      selectedRoll,
      modifier: woundRoll.modifier,
      tableResults
    });
  }

  logApplyDamageDebug("finished automated wound rolls", {
    actor: getActorLogData(actor),
    resultCount: results.length
  });

  return results;
}

async function resolveAutomatedWoundRollTable(tableReference, { tableSettingKey = null } = {}) {
  logApplyDamageDebug("resolving automated wound rolltable", {
    tableReference,
    referenceType: typeof tableReference,
    tableSettingKey
  });

  if (!tableReference) {
    logApplyDamageWarning("automated wound rolltable resolve failed: empty table reference", { tableReference });
    return null;
  }

  const reference = String(tableReference).trim();
  if (!reference) {
    logApplyDamageWarning("automated wound rolltable resolve failed: blank table reference", { tableReference });
    return null;
  }

  if (reference.startsWith("RollTable.") || reference.startsWith("Compendium.")) {
    return resolveTableFromUuid(reference, "automated wound uuid");
  }

  const preferMoshPack = shouldPreferMoshWoundTablePack(reference, tableSettingKey);
  if (preferMoshPack) {
    logApplyDamageDebug("automated wound rolltable detected id-like Mosh wound table setting", {
      reference,
      tableSettingKey,
      preferredPack: MOSH_ROLLTABLE_PACK
    });
  }

  const tableByMoshDocumentId = await resolveTableFromMoshCompendium(reference);
  if (tableByMoshDocumentId) return tableByMoshDocumentId;

  const tableByWorldId = game.tables?.get(reference) ?? null;
  logApplyDamageDebug("automated wound rolltable lookup by world table id", {
    reference,
    found: Boolean(tableByWorldId),
    table: getRollTableLogData(tableByWorldId)
  });
  if (tableByWorldId) return tableByWorldId;

  const tableByName = game.tables?.getName?.(reference) ?? null;
  logApplyDamageDebug("automated wound rolltable lookup by world table name", {
    reference,
    delayedForIdLikeMoshSetting: preferMoshPack,
    found: Boolean(tableByName),
    table: getRollTableLogData(tableByName)
  });
  if (tableByName) return tableByName;

  const normalizedReference = reference.toLowerCase();
  const tableByCaseInsensitiveName = game.tables?.find?.((table) => table?.name?.toLowerCase?.() === normalizedReference) ?? null;
  logApplyDamageDebug("automated wound rolltable lookup by case-insensitive world table name", {
    reference,
    delayedForIdLikeMoshSetting: preferMoshPack,
    found: Boolean(tableByCaseInsensitiveName),
    table: getRollTableLogData(tableByCaseInsensitiveName)
  });
  if (tableByCaseInsensitiveName) return tableByCaseInsensitiveName;

  logApplyDamageWarning("automated wound rolltable resolve failed: no lookup matched", { tableReference, tableSettingKey });
  return null;
}

function shouldPreferMoshWoundTablePack(reference, tableSettingKey) {
  return MOSH_WOUND_TABLE_SETTING_KEYS.has(tableSettingKey) && FOUNDRY_ID_LIKE_PATTERN.test(reference);
}

async function resolveTableFromMoshCompendium(documentId) {
  const pack = game.packs?.get?.(MOSH_ROLLTABLE_PACK) ?? null;
  if (!pack || pack.documentName !== "RollTable") {
    logApplyDamageWarning("automated wound rolltable lookup skipped: Mosh rolltable pack unavailable", {
      documentId,
      packCollection: MOSH_ROLLTABLE_PACK,
      foundPack: Boolean(pack),
      documentName: pack?.documentName ?? null
    });
    return null;
  }

  try {
    const index = await pack.getIndex();
    const entry = index?.get?.(documentId) ?? null;
    const entryUuid = entry?.uuid ?? (entry?._id ? `Compendium.${pack.collection}.${entry._id}` : null);

    logApplyDamageDebug("automated wound rolltable lookup by Mosh compendium document id", {
      documentId,
      packCollection: pack.collection,
      found: Boolean(entry),
      entryName: entry?.name ?? null,
      entryUuid
    });

    if (!entry) return null;
    return pack.getDocument(documentId);
  } catch (error) {
    logApplyDamageError("automated wound rolltable lookup by Mosh compendium document id failed", {
      documentId,
      packCollection: pack.collection
    }, error);
    return null;
  }
}

async function resolveTableFromUuid(uuid, source) {
  try {
    const table = await fromUuid(uuid);
    logApplyDamageDebug("rolltable lookup by uuid", {
      source,
      uuid,
      found: Boolean(table),
      table: getRollTableLogData(table)
    });
    return table ?? null;
  } catch (error) {
    logApplyDamageError("rolltable lookup by uuid failed", { source, uuid }, error);
    return null;
  }
}

async function rollWoundDice(formula, modifier) {
  const rollCount = modifier ? 2 : 1;
  const rolls = [];

  for (let i = 0; i < rollCount; i += 1) {
    try {
      const roll = new Roll(formula);
      await roll.evaluate();
      logApplyDamageDebug("wound die evaluated", {
        rollIndex: i + 1,
        formula,
        modifier,
        roll: getRollLogData(roll)
      });
      rolls.push(roll);
    } catch (error) {
      logApplyDamageError("wound die evaluation failed", {
        rollIndex: i + 1,
        formula,
        modifier
      }, error);
      throw error;
    }
  }

  return rolls;
}

function selectWoundRoll(rolls, modifier) {
  if (modifier === "advantage") {
    return rolls.reduce((highest, roll) => roll.total > highest.total ? roll : highest, rolls[0]);
  }

  if (modifier === "disadvantage") {
    return rolls.reduce((lowest, roll) => roll.total < lowest.total ? roll : lowest, rolls[0]);
  }

  return rolls[0];
}

function getTableResultsForRoll(table, rollTotal) {
  logApplyDamageDebug("getting rolltable results", {
    table: getRollTableLogData(table),
    rollTotal,
    hasGetResultsForRoll: typeof table.getResultsForRoll === "function"
  });

  if (typeof table.getResultsForRoll === "function") {
    const results = Array.from(table.getResultsForRoll(rollTotal) ?? []);
    logApplyDamageDebug("rolltable results from getResultsForRoll", {
      rollTotal,
      resultCount: results.length,
      results: results.map(getRollTableResultLogData)
    });
    return results;
  }

  const results = Array.from(table.results ?? []).filter((result) => {
    const [min, max] = result.range ?? [];
    return rollTotal >= min && rollTotal <= max;
  });

  logApplyDamageDebug("rolltable results from manual range lookup", {
    rollTotal,
    resultCount: results.length,
    results: results.map(getRollTableResultLogData)
  });

  return results;
}

async function renderAutomatedWoundResults(wounds) {
  if (!wounds.length) return "";

  const title = foundry.utils.escapeHTML(game.i18n.localize("MoshQoL.Damage.AutomatedWoundRolls"));
  const entries = [];

  for (let index = 0; index < wounds.length; index += 1) {
    const wound = wounds[index];
    const rollHtml = renderWoundRolls(wound);
    const resultHtml = await renderTableResults(wound.tableResults);
    const woundNumber = foundry.utils.escapeHTML(game.i18n.format("MoshQoL.Damage.WoundNumber", { number: index + 1 }));

    entries.push(`<li><strong>${woundNumber}</strong>: ${rollHtml}<br>${resultHtml}</li>`);
  }

  return `<div class="mosh-qol-automated-wounds"><strong>${title}</strong><ol>${entries.join("")}</ol></div>`;
}

function renderWoundRolls(wound) {
  const rollAnchors = wound.rolls.map((roll) => rollToInlineHtml(roll, roll === wound.selectedRoll));
  if (!wound.modifier) return rollAnchors[0] ?? "";

  const modifierLabel = game.i18n.localize(wound.modifier === "advantage"
    ? "MoshQoL.Damage.Advantage"
    : "MoshQoL.Damage.Disadvantage");

  return `${foundry.utils.escapeHTML(modifierLabel)}: ${rollAnchors.join(" / ")}`;
}

function rollToInlineHtml(roll, selected) {
  const selectedClass = selected ? " selected" : "";
  const fallback = `<span class="inline-roll${selectedClass}"><i class="fas fa-dice-d10"></i> ${roll.total}</span>`;
  const anchor = typeof roll.toAnchor === "function" ? roll.toAnchor() : null;
  if (!anchor?.outerHTML) return fallback;

  if (selected) anchor.classList?.add?.("selected");
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

function logApplyDamageDebug(message, data = {}) {
  console.log(`${APPLY_DAMAGE_LOG_PREFIX} ${message}`, data);
}

function logApplyDamageWarning(message, data = {}) {
  console.warn(`${APPLY_DAMAGE_LOG_PREFIX} ${message}`, data);
}

function logApplyDamageError(message, data = {}, error = null) {
  console.error(`${APPLY_DAMAGE_LOG_PREFIX} ${message}`, data, error);
}

function getActorLogData(actor) {
  if (!actor) return null;
  return {
    id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    type: actor.type
  };
}

function getRollTableLogData(table) {
  if (!table) return null;
  return {
    id: table.id,
    uuid: table.uuid,
    name: table.name,
    documentName: table.documentName,
    resultCount: table.results?.size ?? table.results?.length ?? null
  };
}

function getRollLogData(roll) {
  if (!roll) return null;
  return {
    formula: roll.formula,
    total: roll.total,
    result: roll.result,
    dice: roll.dice?.map((die) => ({
      faces: die.faces,
      modifiers: die.modifiers,
      total: die.total,
      results: die.results?.map((result) => ({
        result: result.result,
        active: result.active,
        discarded: result.discarded,
        rerolled: result.rerolled,
        exploded: result.exploded,
        zeroMaxApplied: result._zeroMaxApplied
      }))
    }))
  };
}

function getRollTableResultLogData(result) {
  if (!result) return null;
  return {
    id: result.id,
    type: result.type,
    name: result.name,
    description: result.description,
    range: result.range,
    uuid: result.uuid
  };
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
