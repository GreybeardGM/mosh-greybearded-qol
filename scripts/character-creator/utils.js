export function getSkillSortOrder() {
  return [
    "Linguistics",
    "Zoology",
    "Botany",
    "Geology",
    "Industrial Equipment",
    "Jury-Rigging",
    "Chemistry",
    "Computers",
    "Zero-G",
    "Mathematics",
    "Art",
    "Archaeology",
    "Theology",
    "Military Training",
    "Rimwise",
    "Athletics",
    "Psychology",
    "Pathology",
    "Field Medicine",
    "Ecology",
    "Asteroid Mining",
    "Mechanical Repair",
    "Explosives",
    "Pharmacology",
    "Hacking",
    "Piloting",
    "Physics",
    "Mysticism",
    "Wilderness Survival",
    "Firearms",
    "Hand-to-Hand Combat",
    "Sophontology",
    "Exobiology",
    "Surgery",
    "Planetology",
    "Robotics",
    "Engineering",
    "Cybernetics",
    "Artificial Intelligence",
    "Hyperspace",
    "Xenoesotericism",
    "Command"
  ];
}

export const toSkillId = value => String(value ?? "").split(".").pop();

export const normalizeName = value => String(value ?? "").trim().toLowerCase();

export const stripHtml = html => String(html ?? "").replace(/<[^>]*>/g, "").trim();

export function drawCurvedPath(fromEl, toEl, svg) {
  const rect1 = fromEl.getBoundingClientRect();
  const rect2 = toEl.getBoundingClientRect();
  const parentRect = svg.parentElement.getBoundingClientRect();

  const x1 = rect1.left + rect1.width;
  const y1 = rect1.top + rect1.height / 2;
  const x2 = rect2.left;
  const y2 = rect2.top + rect2.height / 2;

  const relX1 = x1 - parentRect.left;
  const relY1 = y1 - parentRect.top;
  const relX2 = x2 - parentRect.left;
  const relY2 = y2 - parentRect.top;

  // Horizontal S-curve: control points push horizontally outward
  const deltaX = Math.abs(relX2 - relX1) / 2;
  const c1x = relX1 + deltaX;
  const c1y = relY1;
  const c2x = relX2 - deltaX;
  const c2y = relY2;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${relX1},${relY1} C ${c1x},${c1y} ${c2x},${c2y} ${relX2},${relY2}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#333");
  path.setAttribute("stroke-width", "2");

  svg.appendChild(path);
}
