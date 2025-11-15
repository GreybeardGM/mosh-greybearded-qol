import { getThemeColor } from "../utils/get-theme-color.js";
import { calculateDialogWidth } from "../utils/calculate-dialog-width.js";
import { loadAllItemsByType } from "../utils/item-loader.js";

function normalizeCaps(text) {
  const lowered = text.toLowerCase().trim();
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

export async function selectClass(actor, applyStats = true) {
  // little helpers
  const stripHtml = html => html.replace(/<[^>]*>/g, '').trim();
  const formatAttribute = (value, label) => {
    if (!Number.isFinite(value) || value === 0) return null;
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${Math.abs(value) < 10 ? "\u00A0" : ''}${value}  ${label}`;
  };
  const stats = ['strength', 'speed', 'intellect', 'combat'];
  const saves = ['sanity', 'fear', 'body'];

  // Load all the classes (World > other packs > fvtt_mosh_1e_psg, alphabetisch sortiert)
  const sortedClasses = await loadAllItemsByType("class");

  // Load all skills for reference in OR choice processing
  const sortedSkills = await loadAllItemsByType("skill");

  // Compile processed class data
  const processedClasses = sortedClasses.map(cls => {
    const description = stripHtml(cls.system.description || "No description available.");
    const trauma = normalizeCaps(stripHtml(cls.system.trauma_response || "No trauma specified."));
    const base = cls.system.base_adjustment || {};
    const selected = cls.system.selected_adjustment || {};
    const attr = [];
  
    for (const group of [stats, saves]) {
      const values = group.map(stat => base[stat] || 0);
      const allEqual = values.every(v => v === values[0]);
      if (allEqual && values[0] !== 0) {
        attr.push(formatAttribute(values[0], group === stats ? "All Stats" : "All Saves"));
      } else {
        for (const stat of group) {
          const value = base[stat] || 0;
          const formatted = formatAttribute(value, stat.charAt(0).toUpperCase() + stat.slice(1));
          if (formatted) attr.push(formatted);
        }
      }
    }
  
    const wounds = (base.max_wounds || 0) + (selected.max_wounds || 0);
    if (wounds) attr.push(formatAttribute(wounds, "Wounds"));
  
    if (Array.isArray(selected.choose_stat)) {
      for (const choice of selected.choose_stat) {
        const isAllStats = stats.every(stat => choice.stats.includes(stat));
        const isAllSaves = saves.every(save => choice.stats.includes(save));
        const label = isAllStats ? "Any Stat" : isAllSaves ? "Any Save" :
          choice.stats.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
        const mod = parseInt(choice.modification, 10) || 0;
        attr.push(formatAttribute(mod, `Choose 1: ${label}`));
      }
    }

    // Format skill choices for display
    let skillsInfo = '';
    const andChoices = selected.choose_skill_and || {};
    let orChoices = selected.choose_skill_or || [];

    // Flatten orChoices in case it's nested (array of arrays)
    orChoices = orChoices.flat();

    // AND choices (base skill points)
    const skillPoints = [];
    if (andChoices.trained) skillPoints.push(`${andChoices.trained} Trained`);
    if (andChoices.expert) skillPoints.push(`${andChoices.expert} Expert`);
    if (andChoices.master) skillPoints.push(`${andChoices.master} Master`);
    if (andChoices.expert_full_set) skillPoints.push(`${andChoices.expert_full_set} Expert Sets`);
    if (andChoices.master_full_set) skillPoints.push(`${andChoices.master_full_set} Master Sets`);

    if (skillPoints.length > 0) {
      skillsInfo += `Skills: ${skillPoints.join(', ')}<br>`;
    }

    // OR choices (named skill packages)
    if (Array.isArray(orChoices) && orChoices.length > 0) {
      skillsInfo += `<strong>OR Choose One:</strong><br>`;
      for (const orChoice of orChoices) {
        // Skip entries that aren't objects (empty arrays, etc.)
        if (!orChoice || typeof orChoice !== 'object') continue;

        const optName = orChoice.name || 'Unnamed';
        skillsInfo += `• <strong>${optName}</strong><br>`;

        // Display point allocations
        const orPoints = [];
        if (orChoice.trained) orPoints.push(`${orChoice.trained} Trained`);
        if (orChoice.expert) orPoints.push(`${orChoice.expert} Expert`);
        if (orChoice.master) orPoints.push(`${orChoice.master} Master`);
        if (orChoice.expert_full_set) orPoints.push(`${orChoice.expert_full_set} Expert Set${orChoice.expert_full_set > 1 ? 's' : ''}`);
        if (orChoice.master_full_set) orPoints.push(`${orChoice.master_full_set} Master Set${orChoice.master_full_set > 1 ? 's' : ''}`);

        if (orPoints.length > 0) {
          skillsInfo += `&nbsp;&nbsp;Points: ${orPoints.join(', ')}<br>`;
        }

        // Display included skills if available
        if (orChoice.from_list && Array.isArray(orChoice.from_list) && orChoice.from_list.length > 0) {
          skillsInfo += `&nbsp;&nbsp;Skills:<br>`;
          for (const skillRef of orChoice.from_list) {
            // Extract UUID part if it's a full UUID
            const skillIdToMatch = skillRef.split(".").pop();
            // Try to find the skill
            const skill = sortedSkills.find(s =>
              s.name === skillRef ||
              s.id === skillRef ||
              s.id === skillIdToMatch ||
              s.uuid === skillRef
            );
            if (skill) {
              skillsInfo += `&nbsp;&nbsp;&nbsp;&nbsp;- ${skill.name}<br>`;
            }
          }
        }
      }
    }

    if (skillsInfo) {
      attr.push(skillsInfo);
    }

    return {
      id: cls.id,
      name: cls.name,
      img: cls.img || "icons/svg/mystery-man.svg",
      trauma,
      description,
      attributes: attr.join('<br>') || "No attributes.",
      uuid: cls.uuid
    };
  });
  
  // Calculate dialog width
  const classCount = sortedClasses.length;
  let gridColumns = 5;
  if ([3, 6].includes(classCount)) {
    gridColumns = 3;
  }
  else if ([4, 7, 8, 11, 12].includes(classCount)) {
    gridColumns = 4;
  }
  const dialogWidth = calculateDialogWidth(gridColumns, 250, true);

  //Finish Template data and render
  const templateData = {
    themeColor: getThemeColor(),
    gridColumns,
    classes: processedClasses
  };
  const content = await foundry.applications.handlebars.renderTemplate("modules/mosh-greybearded-qol/templates/character-creator/select-class.html", templateData);

  return new Promise(resolve => {
    const dlg = new Dialog({
      title: "Select Your Class",
      content,
      buttons: {},
      close: () => resolve(null),
      render: html => {
        // Dialog Resizing
        const dialogElement = html.closest('.app');
        dialogElement.css({ width: `${dialogWidth}px`, maxWidth: '95vw', margin: '0 auto' });
        setTimeout(() => {
          dialogElement[0].style.height = 'auto';
        }, 0);
        // Click
        html.find('.card').on('click', async function () {
          const id = $(this).data('class');
          const selected = templateData.classes.find(c => c.id === id);
          if (!selected) return resolve(null);

          const classItem = await fromUuid(selected.uuid);
          if (!classItem) return ui.notifications.error("Failed to load class data.");

          const updates = {
            "system.class.value": classItem.name,
            "system.class.uuid": classItem.uuid,
            "system.other.stressdesc.value": classItem.system.trauma_response
              ? normalizeCaps(classItem.system.trauma_response)
              : ""
          };
          
          if (applyStats) {
            const base = classItem.system.base_adjustment || {};
            const allStats = ["strength", "speed", "intellect", "combat", "sanity", "fear", "body"];
            for (const stat of allStats) {
              const val = parseInt(base[stat], 10);
              if (!isNaN(val) && val !== 0) {
                updates[`system.stats.${stat}.value`] = (foundry.utils.getProperty(actor.system, `stats.${stat}.value`) || 0) + val;
              }
            }
            if (!isNaN(base.max_wounds)) {
              updates["system.hits.max"] = (foundry.utils.getProperty(actor.system, `hits.max`) || 2) + base.max_wounds;
              updates["system.hits.value"] = 0; // optional: reset current hits
            }
          }
          
          await actor.update(updates);

          resolve(classItem);
          dlg.close();
        });
      }
    });
    dlg.render(true);
  });
}
