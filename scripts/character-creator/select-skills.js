// modules/mosh-greybearded-qol/scripts/item-loader.js
// Foundry VTT v12 — namebasierter Item-Loader (Homebrew-first)

const SPECIFIC_MODULE_ID = "fvtt_mosh_1e_psg";

/* ===== Normalisierer ===== */
const normType = (t) => String(t ?? "").trim().toLowerCase();
const normName = (n) => String(n ?? "").trim().toLowerCase();
const keyOf = (type, name) => `${normType(type)}::${normName(name)}`;

/* ===== Skill-Sortierung (vorgegeben) ===== */
const SKILL_ORDER = [
    "Linguistics","Zoology","Botany","Geology","Industrial Equipment","Jury-Rigging",
    "Chemistry","Computers","Zero-G","Mathematics","Art","Archaeology","Theology",
    "Military Training","Rimwise","Athletics","Psychology","Pathology","Field Medicine",
    "Ecology","Asteroid Mining","Mechanical Repair","Explosives","Pharmacology","Hacking",
    "Piloting","Physics","Mysticism","Wilderness Survival","Firearms","Hand-to-Hand Combat",
    "Sophontology","Exobiology","Surgery","Planetology","Robotics","Engineering","Cybernetics",
    "Artificial Intelligence","Hyperspace","Xenoesotericism","Command"
  ];
const SKILL_RANK = new Map(SKILL_ORDER.map((n, i) => [normName(n), i]));

/* ===== Pack-Partitionierung ===== */
function partitionItemPacks() {
  const packs = Array.from(game.packs).filter(p => p?.documentName === "Item");
  const normalPacks = [];
  const psgPacks = [];
  for (const p of packs) {
    const pkg = p?.metadata?.package ?? p?.metadata?.module ?? "";
    if (pkg === SPECIFIC_MODULE_ID) psgPacks.push(p);
    else normalPacks.push(p);
  }
  return { normalPacks, psgPacks };
}

/* ===== Welt-Items eines Typs (gruppiert) ===== */
function collectWorldByTypeToMap(itemType, map) {
  const t = normType(itemType);
  for (const it of game.items) {
    if (!it || normType(it.type) !== t) continue;
    const nm = it.name ?? "";
    if (!nm) continue;
    const k = keyOf(it.type, nm);
    let g = map.get(k);
    if (!g) { g = { world: null, normal: null, psg: null }; map.set(k, g); }
    if (!g.world) g.world = it; // World gewinnt die Gruppe
  }
}

/* ===== Pack-Items eines Typs (gruppiert) ===== */
async function collectPackByTypeToMap(packs, slot, itemType, map) {
  const t = normType(itemType);
  for (const pack of packs) {
    // indexbasiert filtern
    const index = await pack.getIndex({ fields: ["name", "type"] });
    const wanted = index.filter(e => normType(e.type) === t && e.name && e.name.trim().length);
    if (!wanted.length) continue;

    // IDs in Blöcken laden (schonend)
    const ids = wanted.map(e => e._id);
    if (!ids.length) continue;
    const docs = await pack.getDocuments({ _id: ids });

    for (const d of docs) {
      if (!d || normType(d.type) !== t) continue;
      const nm = d.name ?? "";
      if (!nm) continue;
      const k = keyOf(d.type, nm);
      let g = map.get(k);
      if (!g) { g = { world: null, normal: null, psg: null }; map.set(k, g); }
      if (!g[slot]) g[slot] = d; // nur setzen, wenn Slot leer (stabile Reihenfolge)
    }
  }
}

/* ===== Gewinner pro Gruppe in Priorität bestimmen ===== */
function winnersFromMap(map) {
  const out = [];
  for (const g of map.values()) {
    const winner = g.world ?? g.normal ?? g.psg ?? null;
    if (winner) out.push(winner);
  }
  return out;
}

/* ===== Sortierung ===== */
function sortItems(itemType, items) {
  const t = normType(itemType);
  if (t === "skill") {
    // 1) nach definierter Reihenfolge, 2) unbekannte hinten alphabetisch
    return items.sort((a, b) => {
      const ra = SKILL_RANK.get(normName(a.name)) ?? Number.MAX_SAFE_INTEGER;
      const rb = SKILL_RANK.get(normName(b.name)) ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return String(a.name).localeCompare(String(b.name));
    });
  }
  // Default: alphabetisch
  return items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/* ===== Öffentliche API ===== */

/**
 * Lädt ALLE Items eines Typs, gruppiert ausschließlich über (type, name) und
 * löst je Gruppe den Gewinner nach Priorität:
 *   1) World, 2) alle Packs außer fvtt_mosh_1e_psg, 3) fvtt_mosh_1e_psg
 * Rückgabe: SORTIERTES Array (Skills per fester Reihenfolge, sonst A→Z).
 */
export async function loadAllItemsByType(itemType) {
  const map = new Map();

  // 1) World
  collectWorldByTypeToMap(itemType, map);

  // 2) Packs
  const { normalPacks, psgPacks } = partitionItemPacks();
  await collectPackByTypeToMap(normalPacks, "normal", itemType, map);
  await collectPackByTypeToMap(psgPacks, "psg", itemType, map);

  // 3) Gewinner + Sortierung
  const winners = winnersFromMap(map);
  return sortItems(itemType, winners);
}

/**
 * Sucht EIN Item per (type, name) in Priorität:
 *   1) World, 2) alle Packs außer fvtt_mosh_1e_psg, 3) fvtt_mosh_1e_psg
 * exakter Name (case-insensitive, trim).
 */
export async function findItem(itemType, name) {
  const t = normType(itemType);
  const n = normName(name);
  if (!n) return null;

  // 1) World
  for (const it of game.items) {
    if (!it || normType(it.type) !== t) continue;
    if (normName(it.name) === n) return it;
  }

  // 2) Packs
  const { normalPacks, psgPacks } = partitionItemPacks();

  // Helper: im Pack exakten Namen finden (indexbasiert, dann getDocument)
  const findInPacks = async (packs) => {
    for (const pack of packs) {
      const index = await pack.getIndex({ fields: ["name", "type"] });
      const hit = index.find(e => normType(e.type) === t && normName(e.name) === n);
      if (hit) return await pack.getDocument(hit._id);
    }
    return null;
  };

  // 2a) alle außer fvtt_mosh_1e_psg
  const normalHit = await findInPacks(normalPacks);
  if (normalHit) return normalHit;

  // 3) zuletzt fvtt_mosh_1e_psg
  return await findInPacks(psgPacks);
}

/* ===== Optional: global zum Testen ===== */
// globalThis.GB_ItemLoader = { loadAllItemsByType, findItem };
