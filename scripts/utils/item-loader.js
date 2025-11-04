// modules/mosh-greybearded-qol/scripts/utils/item-loader.js
// Foundry VTT v12 – Item Loader (MoSh)

const SPECIFIC_MODULE_ID = "fvtt_mosh_1e_psg";

/** Utility: robustes, kleinschreibendes Typ-Matching */
function normType(t) { return String(t ?? "").trim().toLowerCase(); }

/** Utility: dedupe über UUID (Fallback auf zusammengesetzte ID) */
function docKey(d) {
  return d?.uuid ?? (d?.pack ? `${d.pack}.${d.id}` : `World.Item.${d?.id}`);
}

/** Packs in gewünschte Reihenfolge partitionieren */
function partitionItemPacks() {
  // Nur Item-Compendia
  const allItemPacks = game.packs
    .filter(p => p?.documentName === "Item");

  const normal = [];
  const specific = [];
  for (const p of allItemPacks) {
    const pkg = p?.metadata?.package ?? p?.metadata?.module; // safety
    if (pkg === SPECIFIC_MODULE_ID) specific.push(p);
    else normal.push(p);
  }
  return { normal, specific };
}

/** Welt-Items eines Typs holen */
function getWorldItemsByType(type) {
  const t = normType(type);
  return game.items.filter(i => normType(i.type) === t);
}

/** Aus einem Pack alle Items des Typs holen (Index-basiert, dann Dokumente) */
async function getPackItemsByType(pack, type) {
  const t = normType(type);
  // Index holen (performant), dann IDs für den Typ filtern
  const index = await pack.getIndex({ fields: ["name", "type"] });
  const ids = index.filter(e => normType(e.type) === t).map(e => e._id);
  if (!ids.length) return [];
  // Dokumente gezielt laden
  const docs = await pack.getDocuments({ _id: ids });
  return docs.filter(d => normType(d.type) === t);
}

/**
 * Lädt ALLE Items eines Typs in Priorität:
 * 1) Welt, 2) alle Packs außer SPECIFIC_MODULE_ID, 3) SPECIFIC_MODULE_ID
 * @param {string} itemType z.B. "class" oder "skill"
 * @returns {Promise<Item[]>}
 */
export async function loadAllItemsByType(itemType) {
  const out = [];
  const seen = new Set();

  // 1) Welt
  for (const it of getWorldItemsByType(itemType)) {
    const k = docKey(it);
    if (!seen.has(k)) { out.push(it); seen.add(k); }
  }

  const { normal, specific } = partitionItemPacks();

  // 2) Alle "normalen" Packs
  for (const pack of normal) {
    const docs = await getPackItemsByType(pack, itemType);
    for (const d of docs) {
      const k = docKey(d);
      if (!seen.has(k)) { out.push(d); seen.add(k); }
    }
  }

  // 3) Zuletzt die "specific"-Packs (fvtt_mosh_1e_psg)
  for (const pack of specific) {
    const docs = await getPackItemsByType(pack, itemType);
    for (const d of docs) {
      const k = docKey(d);
      if (!seen.has(k)) { out.push(d); seen.add(k); }
    }
  }

  return out;
}

/**
 * Findet EIN spezifisches Item in der Priorität (Welt > normal > specific).
 * Query kann sein:
 *  - { id }      : Foundry-ID
 *  - { uuid }    : vollständige UUID
 *  - { name }    : Name (exact oder fuzzy)
 *  - string      : wird als Name behandelt (exact, dann fuzzy)
 *
 * @param {string} itemType
 * @param {object|string} query
 * @param {object} [opts]
 * @param {boolean} [opts.fuzzy=true]  // nach exact match optional fuzzy (case-insensitive enthält)
 * @returns {Promise<Item|null>}
 */
export async function findItem(itemType, query, { fuzzy = true } = {}) {
  const t = normType(itemType);

  // Query normalisieren
  let q = {};
  if (typeof query === "string") q.name = query;
  else if (query && typeof query === "object") q = query;
  const name = q.name?.toString() ?? null;
  const id   = q.id?.toString() ?? null;
  const uuid = q.uuid?.toString() ?? null;

  // 1) Direkter UUID-Treffer
  if (uuid) {
    try {
      const doc = await fromUuid(uuid);
      if (doc && normType(doc.type) === t) return doc;
    } catch {/* ignore */}
  }

  // Hilfsfinder: in beliebiger Sammlung (Array<Item>) nach Name
  const matchInList = (list) => {
    if (!list?.length) return null;
    // 1) Exact (case-insensitive)
    if (name) {
      const exact = list.find(i => i.name?.toLowerCase() === name.toLowerCase());
      if (exact) return exact;
      // 2) Fuzzy
      if (fuzzy) {
        const fuzzyHit = list.find(i => i.name?.toLowerCase().includes(name.toLowerCase()));
        if (fuzzyHit) return fuzzyHit;
      }
    }
    // ID-Match (falls gewünscht)
    if (id) {
      const byId = list.find(i => i.id === id);
      if (byId) return byId;
    }
    return null;
  };

  // 2) Welt zuerst
  {
    const world = getWorldItemsByType(itemType);
    const hit = matchInList(world);
    if (hit) return hit;
    if (id) {
      const byId = world.find(i => i.id === id);
      if (byId) return byId;
    }
  }

  const { normal, specific } = partitionItemPacks();

  // 3) Normal-Packs
  for (const pack of normal) {
    // UUID-Packspezifisch?
    if (uuid && uuid.startsWith(pack.collection)) {
      try {
        const doc = await fromUuid(uuid);
        if (doc && normType(doc.type) === t) return doc;
      } catch {/* ignore */}
    }

    const index = await pack.getIndex({ fields: ["name", "type"] });
    // Exact
    if (name) {
      const exact = index.find(e => normType(e.type) === t && e.name?.toLowerCase() === name.toLowerCase());
      if (exact) return await pack.getDocument(exact._id);
      if (fuzzy) {
        const fuzzyHit = index.find(e => normType(e.type) === t && e.name?.toLowerCase().includes(name.toLowerCase()));
        if (fuzzyHit) return await pack.getDocument(fuzzyHit._id);
      }
    }
    if (id) {
      const byId = index.find(e => e._id === id && normType(e.type) === t);
      if (byId) return await pack.getDocument(byId._id);
    }
  }

  // 4) Specific-Packs (fvtt_mosh_1e_psg) zuletzt
  for (const pack of specific) {
    if (uuid && uuid.startsWith(pack.collection)) {
      try {
        const doc = await fromUuid(uuid);
        if (doc && normType(doc.type) === t) return doc;
      } catch {/* ignore */}
    }

    const index = await pack.getIndex({ fields: ["name", "type"] });
    if (name) {
      const exact = index.find(e => normType(e.type) === t && e.name?.toLowerCase() === name.toLowerCase());
      if (exact) return await pack.getDocument(exact._id);
      if (fuzzy) {
        const fuzzyHit = index.find(e => normType(e.type) === t && e.name?.toLowerCase().includes(name.toLowerCase()));
        if (fuzzyHit) return await pack.getDocument(fuzzyHit._id);
      }
    }
    if (id) {
      const byId = index.find(e => e._id === id && normType(e.type) === t);
      if (byId) return await pack.getDocument(byId._id);
    }
  }

  return null;
}
