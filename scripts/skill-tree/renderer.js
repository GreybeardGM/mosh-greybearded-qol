const SVG_NS = "http://www.w3.org/2000/svg";

function getLineKeySet(lineKeyBySkill, skillId) {
  let keys = lineKeyBySkill.get(skillId);
  if (!keys) {
    keys = new Set();
    lineKeyBySkill.set(skillId, keys);
  }
  return keys;
}

function* getChangedLines(changedSkillIds, linePathCache, lineKeyBySkill) {
  const seen = new Set();
  for (const skillId of changedSkillIds) {
    const keys = lineKeyBySkill.get(skillId);
    if (!keys) continue;

    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);

      const line = linePathCache.get(key);
      if (line) yield line;
    }
  }
}

function getPrereqIds(skill, toSkillId) {
  if (skill.prereqIds) return skill.prereqIds;
  const rawPrereqs = skill.system?.prerequisite_ids ?? [];
  return rawPrereqs.map(toSkillId);
}

export function rebuildSkillLineGeometry({
  svg,
  sortedSkills,
  skillCardById,
  toSkillId,
  linePathCache,
  lineKeyBySkill,
  buildLineMeta = () => ({})
}) {

  linePathCache.clear();
  lineKeyBySkill.clear();
  svg.replaceChildren();

  const parentRect = svg.getBoundingClientRect();
  const cardRectById = new Map();
  for (const [skillId, card] of skillCardById.entries()) {
    cardRectById.set(skillId, card.getBoundingClientRect());
  }

  const frag = document.createDocumentFragment();

  for (const skill of sortedSkills) {
    const skillId = skill.id;
    const rect2 = cardRectById.get(skillId);
    if (!rect2) continue;

    const relX2 = rect2.left - parentRect.left;
    const relY2 = rect2.top + rect2.height / 2 - parentRect.top;

    for (const prereqId of getPrereqIds(skill, toSkillId)) {
      const rect1 = cardRectById.get(prereqId);
      if (!rect1) continue;

      const relX1 = rect1.left + rect1.width - parentRect.left;
      const relY1 = rect1.top + rect1.height / 2 - parentRect.top;
      const deltaX = Math.abs(relX2 - relX1) / 2;
      const pathData = `M ${relX1},${relY1} C ${relX1 + deltaX},${relY1} ${relX2 - deltaX},${relY2} ${relX2},${relY2}`;

      const key = `${prereqId}->${skillId}`;
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--color-border)");
      path.setAttribute("stroke-width", "2");
      frag.appendChild(path);

      linePathCache.set(key, {
        path,
        prereqId,
        skillId,
        isHighlighted: false,
        ...buildLineMeta(skill, prereqId)
      });

      getLineKeySet(lineKeyBySkill, prereqId).add(key);
      getLineKeySet(lineKeyBySkill, skillId).add(key);
    }
  }

  svg.appendChild(frag);

}

export function updateSkillLineHighlights({
  rebuiltGeometry,
  changedSkillIds,
  linePathCache,
  lineKeyBySkill,
  selectedSkillIds,
  isHighlighted
}) {

  const updateAll = rebuiltGeometry || !changedSkillIds || changedSkillIds.size === 0;
  const linesToUpdate = updateAll
    ? linePathCache.values()
    : getChangedLines(changedSkillIds, linePathCache, lineKeyBySkill);

  for (const line of linesToUpdate) {

    const highlighted = isHighlighted(line, selectedSkillIds);
    if (highlighted === line.isHighlighted) continue;

    line.path.setAttribute("stroke", highlighted ? "var(--theme-color)" : "var(--color-border)");
    line.path.setAttribute("stroke-width", highlighted ? "3" : "2");
    line.isHighlighted = highlighted;
  }

}
