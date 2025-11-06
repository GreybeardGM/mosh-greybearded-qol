import { getThemeColor } from "../utils/get-theme-color.js";
import { loadAllItemsByType } from "../utils/item-loader.js";

export async function selectSkills(actor, selectedClass) {
  function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
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
  
  // Skills über universellen Loader laden (V13; Homebrew-first; bereits nach SKILL_ORDER sortiert)
  const loadedSkills = await loadAllItemsByType("skill");
  // Rank-Notation vereinheitlichen + direkte Weiterverwendung
  const allSkills = loadedSkills.map(skill => {
    if (skill?.system?.rank) skill.system.rank = String(skill.system.rank).toLowerCase();
    return skill;
  });
  // Für schnelle Lookups (Prereq-Prüfung, UI)
  const skillMap = new Map(allSkills.map(s => [s.id, s]));
  // Abhängigkeiten vorbereiten (nutzt .system.prerequisite_ids)
  const dependencies = getSkillDependencies(allSkills);
  // Loader sortiert Skills bereits per festem Order; hier keine zusätzliche Sortierung nötig
  const sortedSkills = allSkills;

  const baseAnd = selectedClass.system.selected_adjustment?.choose_skill_and ?? {};
  const baseOr = selectedClass.system.selected_adjustment?.choose_skill_or ?? [];
  const granted = new Set((selectedClass.system.base_adjustment?.skills_granted ?? []).map(uuid => uuid.split(".").pop()));

  const fullSetExpert = baseAnd.expert_full_set || 0;
  const fullSetMaster = baseAnd.master_full_set || 0;

  const basePoints = {
    trained: (baseAnd.trained || 0) + fullSetExpert + fullSetMaster,
    expert: (baseAnd.expert || 0) + fullSetExpert + fullSetMaster,
    master: (baseAnd.master || 0) + fullSetMaster
  };

  // Wandelt alles "zahlähnliche" sicher in Number um, sonst 0
  const toNum = (v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Bequemer Summer
  const add = (...vals) => vals.map(toNum).reduce((a, b) => a + b, 0);

  const orOptions = baseOr.flat().map((opt, i) => {
    return {
      id: `or-${i}`,
      name: opt.name ?? `Option ${i + 1}`,
      trained: add(opt.trained, opt.expert_full_set, opt.master_full_set),
      expert:  add(opt.expert,  opt.expert_full_set, opt.master_full_set),
      master:  add(opt.master,  opt.master_full_set),
    };
  });

  const html = await foundry.applications.handlebars.renderTemplate("modules/mosh-greybearded-qol/templates/character-creator/select-skills.html", {
    themeColor: getThemeColor(),
    actor,
    selectedClass,
    sortedSkills,
    granted: [...granted],
    basePoints,
    orOptions
  });

  return new Promise((resolve) => {
    const dlg = new Dialog({
      title: `Select Skills for ${actor.name}`,
      content: html,
      buttons: {},
      close: () => {
        resolve(null);
      },
      render: (html) => {
        const wrapper = html.closest('.app');
        if (wrapper?.length) {
          wrapper.css({ width: '1200px', maxWidth: '95vw', margin: '0 auto' });
        }

        const points = structuredClone(basePoints);

        function drawLines() {
          const svg = html[0].querySelector("#skill-arrows");
          if (!svg) return;
          svg.innerHTML = "";
        
          const selected = new Set(
            html.find(".skill-card.selected").map((_, el) => el.dataset.skillId)
          );
        
          const linesToDraw = [];
        
          for (const skill of sortedSkills) {
            const prereqIds = (skill.system.prerequisite_ids || []).map(p => p.split(".").pop());
        
            for (const prereqId of prereqIds) {
              const fromEl = html[0].querySelector(`.skill-card[data-skill-id="${prereqId}"]`);
              const toEl = html[0].querySelector(`.skill-card[data-skill-id="${skill.id}"]`);
              if (!fromEl || !toEl) continue;
        
              const rect1 = fromEl.getBoundingClientRect();
              const rect2 = toEl.getBoundingClientRect();
              const parentRect = svg.getBoundingClientRect();
        
              const x1 = rect1.left + rect1.width;
              const y1 = rect1.top + rect1.height / 2;
              const x2 = rect2.left;
              const y2 = rect2.top + rect2.height / 2;
        
              const relX1 = x1 - parentRect.left;
              const relY1 = y1 - parentRect.top;
              const relX2 = x2 - parentRect.left;
              const relY2 = y2 - parentRect.top;
        
              const deltaX = Math.abs(relX2 - relX1) / 2;
              const c1x = relX1 + deltaX;
              const c1y = relY1;
              const c2x = relX2 - deltaX;
              const c2y = relY2;
        
              const pathData = `M ${relX1},${relY1} C ${c1x},${c1y} ${c2x},${c2y} ${relX2},${relY2}`;
              const isHighlighted =
                selected.has(skill.id) &&
                selected.has(prereqId) &&
                (skill.system.rank === "expert" || skill.system.rank === "master");
        
              linesToDraw.push({ d: pathData, highlight: isHighlighted });
            }
          }
        
          // ⬇️ Zuerst: graue Linien
          for (const line of linesToDraw.filter(l => !l.highlight)) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", line.d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "var(--color-border)");
            path.setAttribute("stroke-width", "2");
            svg.appendChild(path);
          }
        
          // ⬆️ Dann: farbige oben drauf
          for (const line of linesToDraw.filter(l => l.highlight)) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", line.d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "var(--theme-color)");
            path.setAttribute("stroke-width", "3");
            svg.appendChild(path);
          }
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
