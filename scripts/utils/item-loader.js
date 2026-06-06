// scripts/utils/item-loader.js
// Foundry VTT v13 — Item-Aggregation (Homebrew-first) + Sortierung

import { compareSkillNames } from "../codex/skill-sort.js";
import { normalizeText } from "./normalization.js";

const SPECIFIC_MODULE_ID = "fvtt_mosh_1e_psg";
const PACK_INDEX_FIELDS = [
  "name",
  "type",
  "img",
  "system.rank",
  "system.prerequisite_ids",
  "system.description",
  "system.trauma_response",
  "system.base_adjustment",
  "system.selected_adjustment",
  "uuid"
];
const PACK_LOAD_CONCURRENCY = 4;
const INDEX_ONLY_TYPES = new Set(["skill", "class"]);

/* ---------- Helpers ---------- */
const normType = normalizeText;
const normName = normalizeText;
const keyOf = (type, name) => `${normType(type)}::${normName(name)}`;

function getOrCreateResolutionGroup(map, type, name) {
  const key = keyOf(type, name);
  let group = map.get(key);
  if (!group) {
    group = { world: null, normal: null, psg: null };
    map.set(key, group);
  }
  return group;
}

/* ---------- Cache (defensiv begrenzt) ---------- */
const HOT_CACHE_TYPES = new Set(["skill", "class"]);
const MAX_CACHED_TYPES = 4;
const MAX_ITEMS_PER_CACHED_TYPE = 250;

const packIndexCache = new Map(); // pack.collection -> index
const itemsByTypeCache = new Map(); // normType -> sorted winners
const cacheTypeLru = []; // keys in access order (oldest -> newest)
let cacheInvalidationHooksRegistered = false;

export function clearItemLoaderCache() {
  packIndexCache.clear();
  itemsByTypeCache.clear();
  cacheTypeLru.length = 0;
}

function ensureCacheInvalidationHooks() {
  if (cacheInvalidationHooksRegistered || typeof Hooks === "undefined") return;
  cacheInvalidationHooksRegistered = true;

  const invalidate = () => clearItemLoaderCache();
  Hooks.on("createItem", invalidate);
  Hooks.on("updateItem", invalidate);
  Hooks.on("deleteItem", invalidate);
  Hooks.on("createCompendium", invalidate);
  Hooks.on("deleteCompendium", invalidate);
}

function touchTypeLru(typeKey) {
  const idx = cacheTypeLru.indexOf(typeKey);
  if (idx >= 0) cacheTypeLru.splice(idx, 1);
  cacheTypeLru.push(typeKey);

  while (cacheTypeLru.length > MAX_CACHED_TYPES) {
    const evict = cacheTypeLru.shift();
    if (!evict) break;
    itemsByTypeCache.delete(evict);
  }
}

function shouldCacheType(typeKey, items) {
  if (!HOT_CACHE_TYPES.has(typeKey)) return false;
  return items.length <= MAX_ITEMS_PER_CACHED_TYPE;
}

function cacheTypeData(typeKey, items) {
  if (!shouldCacheType(typeKey, items)) {
    itemsByTypeCache.delete(typeKey);
    const idx = cacheTypeLru.indexOf(typeKey);
    if (idx >= 0) cacheTypeLru.splice(idx, 1);
    return;
  }

  itemsByTypeCache.set(typeKey, items);
  touchTypeLru(typeKey);
}

/* Packs partitionieren (V13: pack.collection ist stabil) */
function partitionItemPacks() {
  const packs = Array.from(game.packs).filter(p => p?.documentName === "Item");
  const normalPacks = [];
  const psgPacks = [];
  for (const p of packs) {
    const isPSG = String(p.collection || "").startsWith(`${SPECIFIC_MODULE_ID}.`);
    (isPSG ? psgPacks : normalPacks).push(p);
  }
  return { normalPacks, psgPacks };
}

/* World sammeln */
function collectWorldByTypeToMap(itemType, map) {
  const t = normType(itemType);
  for (const it of game.items) {
    if (!it || normType(it.type) !== t) continue;
    const nm = it.name ?? "";
    if (!nm) continue;
    const group = getOrCreateResolutionGroup(map, it.type, nm);
    if (!group.world) group.world = it;
  }
}

async function getPackIndexCached(pack) {
  const key = String(pack?.collection ?? "");
  if (!key) return pack.getIndex({ fields: PACK_INDEX_FIELDS });
  if (packIndexCache.has(key)) return packIndexCache.get(key);
  const index = await pack.getIndex({ fields: PACK_INDEX_FIELDS });
  packIndexCache.set(key, index);
  return index;
}

function shouldUsePackIndexOnly(itemType) {
  return INDEX_ONLY_TYPES.has(normType(itemType));
}

function packIndexEntryToItem(entry, pack) {
  const id = entry?._id ?? entry?.id;
  return {
    ...entry,
    id,
    _id: id,
    uuid: entry?.uuid ?? (id && pack?.collection ? `Compendium.${pack.collection}.${id}` : undefined),
    img: entry?.img
  };
}

async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index], index);
    }
  }));

  return out;
}

async function getPackDocumentsBulk(pack, ids) {
  const out = [];
  const CHUNK_SIZE = 200;
  const filteredIds = [...new Set(ids.filter(Boolean))];

  for (let i = 0; i < filteredIds.length; i += CHUNK_SIZE) {
    const chunk = filteredIds.slice(i, i + CHUNK_SIZE);
    if (!chunk.length) continue;

    let docs = [];
    try {
      // Foundry unterstützt _id__in-Queries für Bulk-Laden über getDocuments.
      docs = await pack.getDocuments({ _id__in: chunk });
    } catch (_e) {
      // Fallback: weiterhin gebündelt statt 1 riesiger Promise-All-Welle.
      docs = await Promise.all(chunk.map(id => pack.getDocument(id)));
    }

    if (Array.isArray(docs) && docs.length) out.push(...docs.filter(Boolean));
  }

  return out;
}

async function getPackDocumentsByType(pack, itemType) {
  const t = normType(itemType);

  if (shouldUsePackIndexOnly(itemType)) {
    const index = await getPackIndexCached(pack);
    return index
      .filter(e => e?.name && e.name.trim().length && normType(e.type) === t)
      .map(e => packIndexEntryToItem(e, pack));
  }

  try {
    // Primär: echter Bulk-Abruf (ohne vorgelagerten Index-Fetch).
    return await pack.getDocuments({ type: itemType });
  } catch (_e) {
    // Fallback: über schlanken Index nur passende IDs holen, dann gebündelt laden.
    const index = await getPackIndexCached(pack);
    const ids = index
      .filter(e => e?.name && e.name.trim().length && normType(e.type) === t)
      .map(e => e._id);
    if (!ids.length) return [];
    return getPackDocumentsBulk(pack, ids);
  }
}

function collectDocumentsToMap(docs, slot, itemType, map) {
  const t = normType(itemType);
  for (const d of docs) {
    if (!d || normType(d.type) !== t) continue;
    const nm = d.name ?? "";
    if (!nm) continue;
    const group = getOrCreateResolutionGroup(map, d.type, nm);
    if (!group[slot]) group[slot] = d;
  }
}

/* Packs sammeln (Index tolerant, Typ final am Dokument prüfen) */
async function collectPackByTypeToMap(packs, slot, itemType, map) {
  const packDocs = await mapLimited(
    packs,
    PACK_LOAD_CONCURRENCY,
    pack => getPackDocumentsByType(pack, itemType)
  );

  // Merge bleibt in Pack-Reihenfolge, damit vorhandene Priorität innerhalb eines Slots stabil bleibt.
  for (const docs of packDocs) collectDocumentsToMap(docs, slot, itemType, map);
}

/* Gewinner extrahieren */
function winnersFromMap(map) {
  const out = [];
  for (const g of map.values()) {
    const winner = g.world ?? g.normal ?? g.psg ?? null;
    if (winner) out.push(winner);
  }
  return out;
}

/* Sortierung */
function sortItems(itemType, items) {
  const t = normType(itemType);
  if (t === "skill") return items.sort((a, b) => compareSkillNames(a.name, b.name));
  return items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function buildResolvedItemsByType(itemType) {
  const map = new Map();
  collectWorldByTypeToMap(itemType, map);
  const { normalPacks, psgPacks } = partitionItemPacks();
  await Promise.all([
    collectPackByTypeToMap(normalPacks, "normal", itemType, map),
    collectPackByTypeToMap(psgPacks, "psg", itemType, map)
  ]);

  const winners = winnersFromMap(map);
  return sortItems(itemType, winners);
}

/* ---------- Öffentliche API ---------- */
export async function loadAllItemsByType(itemType) {
  ensureCacheInvalidationHooks();

  const typeKey = normType(itemType);
  const cached = itemsByTypeCache.get(typeKey);
  if (cached) {
    touchTypeLru(typeKey);
    return [...cached];
  }

  const sorted = await buildResolvedItemsByType(itemType);
  cacheTypeData(typeKey, sorted);

  if (sorted.length === 0) {
    const msg = game.i18n.format("MoshQoL.Items.NoItemsFound.Content", {
      itemType: foundry.utils.escapeHTML(String(itemType))
    });

    try {
      await DialogV2.prompt({
        window: { title: game.i18n.localize("MoshQoL.Items.NoItemsFound.Title") },
        content: msg
      });
    } catch (e) {
      ui.notifications?.warn(game.i18n.localize("MoshQoL.Items.NoItemsFound.Warning"));
      console.warn("[MoSh Greybearded QoL] loadAllItemsByType: No items found for type:", itemType, e);
    }
  }

  return [...sorted];
}
