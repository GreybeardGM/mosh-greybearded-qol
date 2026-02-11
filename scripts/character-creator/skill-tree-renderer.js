import { markSkillTreePerf, measureSkillTreePerf } from "./perf-debug.js";

export function rebuildSkillLineGeometry({
  svg,
  sortedSkills,
  skillCardById,
  toSkillId,
  linePathCache,
  lineKeyBySkill,
  buildLineMeta = () => ({})
}) {
  markSkillTreePerf("skilltree:geometry:start");

  linePathCache.clear();
  lineKeyBySkill.clear();
  svg.innerHTML = "";

  const parentRect = svg.getBoundingClientRect();
  const cardRectById = new Map();
  for (const [skillId, card] of skillCardById.entries()) {
    cardRectById.set(skillId, card.getBoundingClientRect());
  }

  const frag = document.createDocumentFragment();

  for (const skill of sortedSkills) {
    const prereqIds = (skill.system?.prerequisite_ids || []).map(toSkillId);
    for (const prereqId of prereqIds) {
      const rect1 = cardRectById.get(prereqId);
      const rect2 = cardRectById.get(skill.id);
      if (!rect1 || !rect2) continue;

      const relX1 = rect1.left + rect1.width - parentRect.left;
      const relY1 = rect1.top + rect1.height / 2 - parentRect.top;
      const relX2 = rect2.left - parentRect.left;
      const relY2 = rect2.top + rect2.height / 2 - parentRect.top;

      const deltaX = Math.abs(relX2 - relX1) / 2;
      const pathData = `M ${relX1},${relY1} C ${relX1 + deltaX},${relY1} ${relX2 - deltaX},${relY2} ${relX2},${relY2}`;

      const key = `${prereqId}->${skill.id}`;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--color-border)");
      path.setAttribute("stroke-width", "2");
      frag.appendChild(path);

      linePathCache.set(key, {
        path,
        prereqId,
        skillId: skill.id,
        isHighlighted: false,
        ...buildLineMeta(skill, prereqId)
      });

      if (!lineKeyBySkill.has(prereqId)) lineKeyBySkill.set(prereqId, new Set());
      if (!lineKeyBySkill.has(skill.id)) lineKeyBySkill.set(skill.id, new Set());
      lineKeyBySkill.get(prereqId).add(key);
      lineKeyBySkill.get(skill.id).add(key);
    }
  }

  svg.appendChild(frag);

  markSkillTreePerf("skilltree:geometry:end");
  measureSkillTreePerf("skilltree:geometry", "skilltree:geometry:start", "skilltree:geometry:end");
}

export function updateSkillLineHighlights({
  rebuiltGeometry,
  changedSkillIds,
  linePathCache,
  lineKeyBySkill,
  selectedSkillIds,
  isHighlighted
}) {
  markSkillTreePerf("skilltree:highlight:start");

  const keysToUpdate = new Set();
  const updateAll = rebuiltGeometry || !changedSkillIds || changedSkillIds.size === 0;

  if (updateAll) {
    for (const key of linePathCache.keys()) keysToUpdate.add(key);
  } else {
    for (const skillId of changedSkillIds) {
      const keys = lineKeyBySkill.get(skillId);
      if (!keys) continue;
      for (const key of keys) keysToUpdate.add(key);
    }
  }

  for (const key of keysToUpdate) {
    const line = linePathCache.get(key);
    if (!line) continue;

    const highlighted = isHighlighted(line, selectedSkillIds);
    if (highlighted === line.isHighlighted) continue;

    line.path.setAttribute("stroke", highlighted ? "var(--theme-color)" : "var(--color-border)");
    line.path.setAttribute("stroke-width", highlighted ? "3" : "2");
    line.isHighlighted = highlighted;
  }

  markSkillTreePerf("skilltree:highlight:end");
  measureSkillTreePerf("skilltree:highlight", "skilltree:highlight:start", "skilltree:highlight:end");
}
