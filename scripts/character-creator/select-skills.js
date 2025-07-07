import { getThemeColor } from "../utils/get-theme-color.js";

export async function selectSkills(actor, selectedClass) {
  function getSkillSortOrder() {
    return ["Linguistics", "Zoology", "Botany", "Geology", "Industrial Equipment", "Jury-Rigging", "Chemistry", "Computers", "Zero-G", "Mathematics", "Art", "Archaeology", "Theology", "Military Training", "Rimwise", "Athletics", "Psychology", "Pathology", "Field Medicine", "Ecology", "Asteroid Mining", "Mechanical Repair", "Explosives", "Pharmacology", "Hacking", "Piloting", "Physics", "Mysticism", "Wilderness Survival", "Firearms", "Hand-to-Hand Combat", "Sophontology", "Exobiology", "Surgery", "Planetology", "Robotics", "Engineering", "Cybernetics", "Artificial Intelligence", "Hyperspace", "Xenoesotericism", "Command"];
  }

  function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  function getSkillDependencies(skills) {
    const map = new Map(); // prereqId → Set of dependentIds
    for (const skill of skills) {
      for (const prereq of skill.system.prerequisite_ids || []) {
        const prereqId = prereq.split(".").pop();
        if (!map.has(prereqId)) map.set(prereqId, new Set());
        map.get(prereqId).add(skill.id);
      }
    }
    return map;
  }
  
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
  
  const dependencies = getSkillDependencies(allSkills);

  const sortOrder = getSkillSortOrder();
  const sortedSkills = allSkills.sort((a, b) => sortOrder.indexOf(a.name) - sortOrder.indexOf(b.name));


  const baseAnd = selectedClass.system.selected_adjustment?.choose_skill_and ?? {};
  const baseOr = selectedClass.system.selected_adjustment?.choose_skill_or ?? [];
  const granted = new Set((selectedClass.system.base_adjustment?.skills_granted ?? []).map(uuid => uuid.split(".").pop()));
  console.log(granted);

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

        const updateSkillAvailability = () => {
          const selectedSkills = new Set(
            html.find(".skill-card.selected").map((_, el) => el.dataset.skillId)
          );
        
          html.find(".skill-card").not(".default-skill").each(function () {
            const skillId = this.dataset.skillId;
            const rank = this.dataset.rank;
            const selected = this.classList.contains("selected");
        
            if (points[rank] === 0 && !selected) {
              this.classList.add("locked");
            } else {
              if (rank === "trained") {
                this.classList.remove("locked");
              } else {
                const skill = skillMap.get(skillId);
                const prereqs = (skill?.system?.prerequisite_ids || []).map(p => p.split(".").pop());
                const unlocked = prereqs.length === 0 || prereqs.some(id => selectedSkills.has(id));
                if (unlocked) {
                  this.classList.remove("locked");
                } else {
                  this.classList.add("locked");
                  this.classList.remove("selected");
                }
              }
            }
          });
        };

        const updateUI = () => {
          html.find(".point-count").each(function () {
            const rank = this.dataset.rank;
            this.innerText = points[rank];
          });
        
          const remaining = Object.values(points).reduce((a, b) => a + b, 0);
          const hasOrOptions = orOptions.length > 0;
          const orSelected = !hasOrOptions || html.find(".or-option.selected").length > 0;
        
          const allowConfirm = remaining === 0 && orSelected;
          html.find(".confirm-button").toggleClass("locked", !allowConfirm);

          updateSkillAvailability();
          drawLines();
        };

        html.find(".skill-card").on("click", function () {
          if (this.classList.contains("default-skill") || this.classList.contains("locked")) return;

          const rank = this.dataset.rank;
          if (this.classList.contains("selected")) {
            const skillId = this.dataset.skillId;
            const dependents = dependencies.get(skillId) || new Set();
          
            for (const depId of dependents) {
              const depEl = html[0].querySelector(`[data-skill-id="${depId}"]`);
              if (!depEl?.classList.contains("selected")) continue;
          
              const depSkill = skillMap.get(depId);
              const depPrereqs = (depSkill.system.prerequisite_ids || []).map(p => p.split(".").pop());
          
              const fulfilled = depPrereqs.filter(pid => {
                if (pid === skillId) return false; // gerade ausgewählter Skill fällt weg
                const el = html[0].querySelector(`[data-skill-id="${pid}"]`);
                return el?.classList.contains("selected");
              });
          
              if (fulfilled.length === 0) {
                ui.notifications.warn(`${depSkill.name} needs this skill to remain selected.`);
                return;
              }
            }
          
            this.classList.remove("selected");
            points[rank]++;
            updateUI();
            return;
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

          html.find(".skill-card.selected:not(.default-skill)").removeClass("selected");
          updateUI();
        });

        html.find(".confirm-button").on("click", async function () {
          const selectedUUIDs = Array.from(
            html[0].querySelectorAll(".skill-card.selected[data-uuid]")
          ).map(el => el.dataset.uuid);
          
          const selectedItems = await Promise.all(
            selectedUUIDs.map(async uuid => {
              const item = await fromUuid(uuid);
              if (!item || item.type !== "skill") {
                console.warn("Invalid or missing skill:", uuid);
                return null;
              }
              const itemData = item.toObject();
              delete itemData._id;
              return itemData;
            })
          );
        
          const validItems = selectedItems.filter(i => i);
          if (validItems.length > 0) {
            await actor.createEmbeddedDocuments("Item", validItems);
          }
        
          resolve(validItems.length > 0 ? validItems : null);
          dlg.close();
        });

        updateUI();
      }
    });
    dlg.render(true);
  });
}
