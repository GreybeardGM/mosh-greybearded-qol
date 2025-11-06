// scripts/utils/item-loader.js
// Foundry VTT v13 — namebasierter Item-Loader (Homebrew-first)

const SPECIFIC_MODULE_ID = "fvtt_mosh_1e_psg";

/* ---------- Helpers ---------- */
const normType = (t) => String(t ?? "").trim().toLowerCase();
const normName = (n) => String(n ?? "").trim().toLowerCase();
const keyOf = (type, name) => `${normType(type)}::${normName(name)}`;

/* Skill-Sortierung */
function getSkillSortOrder() {
  return [
    "Linguistics","Zoology","Botany","Geology","Industrial Equipment","Jury-Rigging",
    "Chemistry","Computers","Zero-G","Mathematics","Art","Archaeology","Theology",
    "Military Training","Rimwise","Athletics","Psychology","Pathology","Field Medicine",
    "Ecology","Asteroid Mining","Mechanical Repair","Explosives","Pharmacology","Hacking",
    "Piloting","Physics","Mysticism","Wilderness Survival","Firearms","Hand-to-Hand Combat",
    "Sophontology","Exobiology","Surgery","Planetology","Robotics","Engineering","Cybernetics",
    "Artificial Intelligence","Hyperspace","Xenoesotericism","Command"
  ];
}
const SKILL_RANK = new Map(getSkillSortOrder().map((n, i) => [normName(n), i]));

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
    if (!g) { g = { world: null, normal: null, psg: null }; map.set(k, g); }
    if (!g.world) g.world = it;
  }
}

/* Packs sammeln (Index tolerant, Typ final am Dokument prüfen) */
async function collectPackByTypeToMap(packs, slot, itemType, map) {
  const t = normType(itemType);
  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["name", "type"] });
    const ids = index
      .filter(e => e?.name && e.name.trim().length)
      .filter(e => !e.type || normType(e.type) === t) // toleriert fehlenden/inkonsistenten type im Index
      .map(e => e._id);

    if (!ids.length) continue;

    // V13: getDocument(id) ist stabil; sequentiell/Promise.all funktioniert
    const docs = await Promise.all(ids.map(id => pack.getDocument(id)));

    for (const d of docs) {
      if (!d || normType(d.type) !== t) continue;
      const nm = d.name ?? "";
      if (!nm) continue;
      const k = keyOf(d.type, nm);
      let g = map.get(k);
      if (!g) { g = { world: null, normal: null, psg: null }; map.set(k, g); }
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

/* ---------- Öffentliche API ---------- */
export async function loadAllItemsByType(itemType) {
  const map = new Map();
  collectWorldByTypeToMap(itemType, map);
  const { normalPacks, psgPacks } = partitionItemPacks();
  await collectPackByTypeToMap(normalPacks, "normal", itemType, map);
  await collectPackByTypeToMap(psgPacks, "psg", itemType, map);

  const winners = winnersFromMap(map);
  const sorted = sortItems(itemType, winners);

  if (sorted.length === 0) {
    const msg = `
      <p><strong>MoSh Greybearded QoL</strong> could not find any valid
      <em>${foundry.utils.escapeHTML(String(itemType))}</em> items in your World
      Items collection or in any loaded compendium.</p>
      <p>To ensure correct functionality, please install a compatible compendium
      pack or create your own items in the World Items collection.</p>
    `.trim();

    try {
      // Foundry V13: DialogV2.prompt — einfacher OK-Bestätigungsdialog
      await DialogV2.prompt({
        window: { title: "No Items Found" },
        content: msg
      });
    } catch (e) {
      // Fallback (sollte in V13 nicht nötig sein)
      ui.notifications?.warn("MoSh Greybearded QoL: No items found. Install a compatible compendium pack or create items in the World.");
      console.warn("[MoSh Greybearded QoL] loadAllItemsByType: No items found for type:", itemType, e);
    }
  }

  return sorted;
}

export async function findItem(itemType, name) {
  const t = normType(itemType);
  const n = normName(name);
  if (!n) return null;

  // 1) World
  for (const it of game.items) {
    if (!it || normType(it.type) !== t) continue;
    if (normName(it.name) === n) return it;
  }

  // 2) Packs: erst alle außer PSG, dann PSG
  const { normalPacks, psgPacks } = partitionItemPacks();

  const findInPacks = async (packs) => {
    for (const pack of packs) {
      const index = await pack.getIndex({ fields: ["name", "type"] });
      const hit = index.find(e => normName(e?.name) === n && (!e.type || normType(e.type) === t));
      if (!hit) continue;
      const doc = await pack.getDocument(hit._id);
      if (doc && normType(doc.type) === t) return doc;
    }
    return null;
  };

  return (await findInPacks(normalPacks)) ?? (await findInPacks(psgPacks));
}
