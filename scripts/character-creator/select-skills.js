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
  const allSkills = [...worldSkills, ...compendiumSkills].map(skill => {
    skill.system.rank = skill.system.rank?.toLowerCase();
    return skill;
  });

  const skillMap = new Map();
  for (const skill of allSkills) {
    skillMap.set(skill.id, skill);
  }

  const sortOrder = getSkillSortOrder();
  const sortedSkills = allSkills.sort((a, b) => sortOrder.indexOf(a.name) - sortOrder.indexOf(b.name));

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

  const orOptions = baseOr.flat().map((opt, i) => {
    return {
      id: `or-${i}`,
      name: opt.name || `Option ${i + 1}`,
      trained: (opt.trained || 0) + (opt.expert_full_set || 0) + (opt.master_full_set || 0),
      expert: (opt.expert || 0) + (opt.expert_full_set || 0) + (opt.master_full_set || 0),
      master: (opt.master || 0) + (opt.master_full_set || 0),
    };
  });

  const html = await renderTemplate("modules/mosh-greybearded-qol/templates/character-creator/select-skills.html", {
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
      buttons: {
        confirm: {
          label: "Confirm",
          callback: async (html) => {
            const selectedUUIDs = html.find(".skill-card.selected[data-uuid]").toArray().map(el => el.dataset.uuid);
            resolve(selectedUUIDs);
          }
        }
      },
      close: () => resolve(null),
      render: (html) => {
        html.closest('.app').css({
          width: '1200px',
          maxWidth: '95vw',
          margin: '0 auto'
        });

        const points = structuredClone(basePoints);

        const updateUI = () => {
          html.find(".point-count").each(function () {
            const rank = this.dataset.rank;
            this.innerText = points[rank];
          });

          const remaining = Object.values(points).reduce((a, b) => a + b, 0);
          html.find("button:contains('Confirm')").prop("disabled", remaining > 0);
        };

        html.find(".skill-card").on("click", function () {
          if (this.classList.contains("default-skill")) return;

          const rank = this.dataset.rank;
          if (this.classList.contains("selected")) {
            this.classList.remove("selected");
            points[rank]++;
          } else {
            if (points[rank] <= 0) return;
            this.classList.add("selected");
            points[rank]--;
          }

          updateUI();
        });

        html.find(".or-option").on("click", function () {
          html.find(".or-option").removeClass("selected");
          this.classList.add("selected");

          const optionId = this.dataset.option;
          const opt = orOptions.find(o => o.id === optionId);
          points.trained = basePoints.trained + (opt?.trained || 0);
          points.expert  = basePoints.expert  + (opt?.expert  || 0);
          points.master  = basePoints.master  + (opt?.master  || 0);

          html.find(".skill-card.selected").removeClass("selected");
          updateUI();
        });

        updateUI();
      }
    });
    dlg.render(true);
  });
}
