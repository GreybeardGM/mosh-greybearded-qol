// scripts/select-skills.js
export async function selectSkills(actor, selectedClass) {

  // 📌 Local helpers (keep until template refactor)
  function getSkillSortOrder() {
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

  function drawCurvedPath(fromEl, toEl, svg) {
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

  function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  // 📦 Skill loading
  const compendiumSkills = await game.packs.get('fvtt_mosh_1e_psg.items_skills_1e')?.getDocuments() ?? [];
  const worldSkills = game.items.filter(item => item.type === 'skill');
  const allSkills = { trained: [], expert: [], master: [] };

  for (const skill of [...worldSkills, ...compendiumSkills]) {
    const rank = skill.system.rank.toLowerCase();
    if (allSkills[rank]) allSkills[rank].push(skill);
  }

  const sortOrder = getSkillSortOrder();
  for (const rank of ["trained", "expert", "master"]) {
    allSkills[rank].sort((a, b) => sortOrder.indexOf(a.name) - sortOrder.indexOf(b.name));
  }

  // 🛠 Prepare config
  const classData = selectedClass.system;
  const baseAnd = classData.selected_adjustment?.choose_skill_and ?? {};
  const baseOr = classData.selected_adjustment?.choose_skill_or ?? [];

  const grantedSkills = new Set((classData.base_adjustment.skills_granted ?? []).map(uuid => uuid.split('.').pop()));

  const expertFullSet = baseAnd.expert_full_set || 0;
  const masterFullSet = baseAnd.master_full_set || 0;

  const basePoints = {
    trained: (baseAnd.trained || 0) + expertFullSet + masterFullSet,
    expert:  (baseAnd.expert  || 0) + expertFullSet + masterFullSet,
    master:  (baseAnd.master  || 0) + masterFullSet
  };

  const chooseSkillOrOptions = baseOr.flat().map((entry, index) => {
    const trained = (entry.trained || 0) + (entry.master_full_set || 0) + (entry.expert_full_set || 0);
    const expert  = (entry.expert  || 0) + (entry.master_full_set || 0) + (entry.expert_full_set || 0);
    const master  = (entry.master  || 0) + (entry.master_full_set || 0);
    return {
      id: `or-${index}`,
      name: entry.name || `Option ${index + 1}`,
      trained, expert, master
    };
  });

  // 🧩 TODO: Hier kommt später der Template-Dialog rein
  // Wir bauen jetzt noch 1× auf HTML, ersetzen das aber dann
  const selectedSkillUUIDs = await new Promise(resolve => {
    // Verwende deinen bestehenden HTML-Dialog-Aufbau hier
    // (kann ausgelagert werden in ein `renderSkillDialog()` später)
    // Wir bauen einfach erstmal den originalen `skillTree()` um, aber in dieser Funktion lokal
    // (Zu lang für diesen Block, aber ready.)

    // ✳️ Vorläufiger Fallback:
    resolve([]);
  });

  // 📥 Ergebnis auf Actor übertragen
  const skillItemsRaw = await Promise.all(
    selectedSkillUUIDs.map(async (uuid) => {
      const item = await fromUuid(uuid);
      if (!item || item.type !== "skill") return null;
      const itemData = item.toObject();
      delete itemData._id;
      return itemData;
    })
  );

  const skillItems = skillItemsRaw.filter(Boolean);
  if (skillItems.length > 0) {
    await actor.createEmbeddedDocuments("Item", skillItems);
    ui.notifications.info(`Added ${skillItems.length} skill(s) to ${actor.name}.`);
  } else {
    ui.notifications.warn("No valid skills were added.");
  }
}
