import { toSkillId } from "./utils.js";
import { rebuildSkillLineGeometry, updateSkillLineHighlights } from "./skill-tree-renderer.js";

const EMPTY_LINE_META = () => ({});

/**
 * Caches stable DOM references for the skill tree once per render pass.
 *
 * @param {HTMLElement} root
 * @returns {{
 *   root: HTMLElement,
 *   svg: SVGElement | null,
 *   confirm: HTMLButtonElement | null,
 *   skillCards: HTMLElement[],
 *   skillCardById: Map<string, HTMLElement>,
 *   orOptions: HTMLElement[],
 *   pointCounts: HTMLElement[],
 *   skillCardsByRank: Map<string, HTMLElement[]>
 * }}
 */
export function cacheSkillTreeDom(root) {
  const skillCards = Array.from(root.querySelectorAll(".skill-card"));
  const skillCardById = new Map(skillCards.map(el => [el.dataset.skillId, el]));
  const orOptions = Array.from(root.querySelectorAll(".or-option"));
  const pointCounts = Array.from(root.querySelectorAll(".point-count"));
  const skillCardsByRank = new Map();

  for (const el of skillCards) {
    const rank = el.dataset.rank;
    if (!skillCardsByRank.has(rank)) skillCardsByRank.set(rank, []);
    skillCardsByRank.get(rank).push(el);
  }

  return {
    root,
    svg: root.querySelector("#skill-arrows"),
    confirm: root.querySelector("#confirm-button"),
    skillCards,
    skillCardById,
    orOptions,
    pointCounts,
    skillCardsByRank
  };
}

export function selectedSkillIdsFromDom(cards = []) {
  const selected = new Set();
  for (const el of cards) {
    if (el.classList.contains("selected")) selected.add(el.dataset.skillId);
  }
  return selected;
}

export function applyInitialAvailabilityLock({ cards = [], skillById, selectedSkillIds }) {
  for (const card of cards) {
    if (card.classList.contains("default-skill")) continue;

    const skill = skillById.get(card.dataset.skillId);
    const prereqIds = skill?.prereqIds ?? (skill?.system?.prerequisite_ids || []).map(toSkillId);
    const isUnlocked = prereqIds.length === 0 || prereqIds.some(id => selectedSkillIds.has(id));

    if (!isUnlocked) card.classList.add("locked");
  }
}

export function scheduleSkillLineDraw(app, { changedSkillIds = null } = {}) {
  if (!app?._dom) return;
  if (changedSkillIds?.size) {
    if (!app._pendingChangedSkillIds) app._pendingChangedSkillIds = new Set();
    for (const skillId of changedSkillIds) app._pendingChangedSkillIds.add(skillId);
  }

  if (app._lineDrawFrame) return;
  app._lineDrawFrame = requestAnimationFrame(() => {
    app._lineDrawFrame = null;
    app._drawLines(app._pendingChangedSkillIds);
    app._pendingChangedSkillIds = null;

  });
}

export function drawSkillLines(app, changedSkillIds = null, { buildLineMeta = null, isHighlighted } = {}) {
  const svg = app._dom?.svg;
  if (!svg) return;

  let rebuiltGeometry = false;
  if (app._linePathCache.size === 0) {
    rebuildSkillLineGeometry({
      svg,
      sortedSkills: app.sortedSkills,
      skillCardById: app._dom.skillCardById,
      toSkillId,
      linePathCache: app._linePathCache,
      lineKeyBySkill: app._lineKeyBySkill,
      buildLineMeta: buildLineMeta ?? EMPTY_LINE_META
    });

    rebuiltGeometry = true;
  }

  updateSkillLineHighlights({
    rebuiltGeometry,
    changedSkillIds,
    linePathCache: app._linePathCache,
    lineKeyBySkill: app._lineKeyBySkill,
    selectedSkillIds: app._selectedSkillIds,
    isHighlighted
  });

}



export function scheduleInitialSkillTreeDraw(app) {
  // Einmalig nach dem ersten Layout-Pass zeichnen, damit Geometrie stabil ist.
  requestAnimationFrame(() => {
    if (!app?._dom) return;
    scheduleSkillLineDraw(app);
  });
}

export function cleanupSkillTreeApp(app, { clearCollections = [] } = {}) {
  if (app._lineDrawFrame) {
    cancelAnimationFrame(app._lineDrawFrame);
    app._lineDrawFrame = null;
  }

  app._dom = null;
  app._linePathCache?.clear?.();
  app._lineKeyBySkill?.clear?.();
  app._pendingChangedSkillIds = null;

  for (const collectionName of clearCollections) {
    app[collectionName]?.clear?.();
  }
}
