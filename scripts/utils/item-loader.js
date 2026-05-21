// scripts/utils/item-loader.js
// Foundry VTT v13 — Item-Aggregation (Homebrew-first) + Sortierung

import { normalizeText } from "./normalization.js";

const SPECIFIC_MODULE_ID = "fvtt_mosh_1e_psg";

/* ---------- Helpers ---------- */
const normType = normalizeText;
const normName = normalizeText;
const keyOf = (type, name) => `${normType(type)}::${normName(name)}`;

/* Skill-Sortierung */
function getSkillSortOrder() {
  return [
    "Linguistics", "Zoology", "Botany", "Geology", "Industrial Equipment", "Jury-Rigging",
    "Chemistry", "Computers", "Zero-G", "Mathematics", "Art", "Archaeology", "Theology",
    "Military Training", "Rimwise", "Athletics", "Psychology", "Pathology", "Field Medicine",
    "Ecology", "Asteroid Mining", "Mechanical Repair", "Explosives", "Pharmacology", "Hacking",
    "Piloting", "Physics", "Mysticism", "Wilderness Survival", "Firearms", "Hand-to-Hand Combat",
    "Sophontology", "Exobiology", "Surgery", "Planetology", "Robotics", "Engineering", "Cybernetics",
    "Artificial Intelligence", "Hyperspace", "Xenoesotericism", "Command"
  ];
}
const SKILL_RANK = new Map(getSkillSortOrder().map((n, i) => [normName(n), i]));

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
    const k = keyOf(it.type, nm);
    let g = map.get(k);
    if (!g) {
      g = { world: null, normal: null, psg: null };
      map.set(k, g);
    }
    if (!g.world) g.world = it;
  }
}

async function getPackIndexCached(pack) {
  const key = String(pack?.collection ?? "");
  if (!key) return pack.getIndex({ fields: ["name"] });
  if (packIndexCache.has(key)) return packIndexCache.get(key);
  const index = await pack.getIndex({ fields: ["name"] });
  packIndexCache.set(key, index);
  return index;
}

async function getPackDocumentsBulk(pack, ids) {
  const out = [];
  const CHUNK_SIZE = 200;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    if (!chunk.length) continue;

    let docs = [];
    try {
      // Foundry unterstützt _id__in-Queries für Bulk-Laden über getDocuments.
      docs = await pack.getDocuments({ _id__in: chunk });
    } catch (_e) {
      // Fallback: weiterhin gebündelt statt 1 riesiger Promise-All-Welle.
      docs = await Promise.all(chunk.map(id => pack.getDocument(id)));
    }

    if (Array.isArray(docs) && docs.length) out.push(...docs);
  }

  return out;
}

/* Packs sammeln (Index tolerant, Typ final am Dokument prüfen) */
async function collectPackByTypeToMap(packs, slot, itemType, map) {
  const t = normType(itemType);
  for (const pack of packs) {
    let docs = [];
    try {
      // Primär: echter Bulk-Abruf (ohne vorgelagerten Index-Fetch).
      docs = await pack.getDocuments({ type: itemType });
    } catch (_e) {
      // Fallback: über schlanken Index nur IDs mit Namen holen, dann gebündelt laden.
      const index = await getPackIndexCached(pack);
      const ids = index
        .filter(e => e?.name && e.name.trim().length)
        .map(e => e._id);
      if (!ids.length) continue;
      docs = await getPackDocumentsBulk(pack, ids);
    }

    for (const d of docs) {
      if (!d || normType(d.type) !== t) continue;
      const nm = d.name ?? "";
      if (!nm) continue;
      const k = keyOf(d.type, nm);
      let g = map.get(k);
      if (!g) {
        g = { world: null, normal: null, psg: null };
        map.set(k, g);
      }
      if (!g[slot]) g[slot] = d;
    }
  }
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
  if (t === "skill") {
    return items.sort((a, b) => {
      const ra = SKILL_RANK.get(normName(a.name)) ?? Number.MAX_SAFE_INTEGER;
      const rb = SKILL_RANK.get(normName(b.name)) ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.name).localeCompare(String(b.name));
    });
  }
  return items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function buildResolvedItemsByType(itemType) {
  const map = new Map();
  collectWorldByTypeToMap(itemType, map);
  const { normalPacks, psgPacks } = partitionItemPacks();
  await collectPackByTypeToMap(normalPacks, "normal", itemType, map);
  await collectPackByTypeToMap(psgPacks, "psg", itemType, map);

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
