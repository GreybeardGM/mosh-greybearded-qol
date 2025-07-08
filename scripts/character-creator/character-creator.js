import { chatOutput } from "../utils/chat-output.js";
import { checkReady, setReady, checkStep, completeStep, checkCompleted, setCompleted, reset } from "./progress.js";
import { selectClass } from "./select-class.js";
import { selectAttributes } from "./select-attributes.js";
import { selectSkills } from "./select-skills.js";

export async function startCharacterCreation(actor) {
  if (!actor) {
    ui.notifications.error("No actor provided.");
    return;
  }
  // ✅ Check if character is already completed
  if (checkCompleted(actor)) {
    if (game.user.isGM) {
      const resetConfirm = await Dialog.confirm({
        title: "Character Already Completed",
        content: `<p><strong>${actor.name}</strong> has already completed character creation.<br>Do you want to reset and start over?</p>`
      });
      if (resetConfirm) {
        await reset(actor);
        ui.notifications.info(`Character creation for ${actor.name} has been reset.`);
      } else {
        ui.notifications.warn("Character creation cancelled.");
        return;
      }
    } else {
      ui.notifications.warn("Character creation already completed.");
      return;
    }
  }

  // ✅ Step 1: WIP Check if Character is Ready
  console.log("\u{1F4D6} Starting character creation for:", actor.name);

  // ✅ Step 2: Clean slate – delete items
  if (!checkStep(actor, "preparation")) {
    console.log("🧹 Resetting actor sheet for fresh creation...");
  
    await actor.update({
      system: {
        class: { value: "", uuid: "" },
        other: { stressdesc: { value: "" }, stress: { value: 2, min: 2 } },
        hits: { value: 0, max: 2 },
        health: { value: "", max: "" },
        credits: { value: "" }
      }
    });
  
    const allItems = actor.items.map(i => i.id);
    if (allItems.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", allItems);
    }
  
    await completeStep(actor, "preparation");
  }

  // ✅ Step 3: Roll stats + saves
  if (!checkStep(actor, "rolledAttributes")) {
    console.log("🎲 Rolling base stats and saves...");

    const attributes = ["strength", "speed", "intellect", "combat"];
    const saves = ["sanity", "fear", "body"];

    const rollValue = async (formula) => {
      const roll = new Roll(formula);
      await roll.evaluate();
      return roll.total;
    };

    const rolledAttributes = Object.fromEntries(
      await Promise.all(attributes.map(async attr => [attr, await rollValue("2d10 + 25")]))
    );
    const rolledSaves = Object.fromEntries(
      await Promise.all(saves.map(async save => [save, await rollValue("2d10 + 10")]))
    );

    await actor.update({
      system: {
        stats: {
          ...Object.fromEntries(attributes.map(attr => [attr, { value: rolledAttributes[attr] }])),
          ...Object.fromEntries(saves.map(save => [save, { value: rolledSaves[save] }]))
        }
      }
    });

    const formatBlock = (title, data) => {
      return `
        <div style="display: inline-block; vertical-align: top; min-width: 120px; margin-right: 24px;">
          <u><b>${title}</b></u><br>
          ${Object.entries(data)
            .map(([k, v]) => `<span class="counter">${v}</span> ${k[0].toUpperCase() + k.slice(1)}`)
            .join("<br>")}
        </div>
      `;
    };

    const content = `
      <div style="display: flex; gap: 32px; line-height: 1.5;">
        ${formatBlock("Stats", rolledAttributes)}
        ${formatBlock("Saves", rolledSaves)}
      </div>
    `;

    await chatOutput({
      actor,
      title: "Stats Rolled",
      subtitle: actor.name,
      content,
      icon: "fa-chart-line",
      image: actor.img
    });

    await completeStep(actor, "rolledAttributes");
  }

  // ✅ Step 4: Class selection
  let selectedClass = null;
  if (checkStep(actor, "selectedClass")) {
    console.log("📚 Loading previously selected class...");
    const classUUID = actor.system.class.uuid;
    if (classUUID) {
      selectedClass = await fromUuid(classUUID);
      if (!selectedClass) {
        ui.notifications.warn("Class UUID invalid. Please reselect.");
      }
    } else {
      ui.notifications.warn("No class UUID found. Please select a class.");
    }
  }
  // If nothing was loaded -> selection dialog
  if (!selectedClass) {
    console.log("📚 Selecting class...");
    selectedClass = await selectClass(actor);
    if (!selectedClass) {
      ui.notifications.warn("Class selection cancelled.");
      return;
    }
    await chatOutput({
      title: "Class Selected",
      subtitle: actor.name,
      content: `${actor.name} chose a class: <label class="counter">${selectedClass.name}</label>`,
      image: selectedClass?.img || "",
      icon: "fa-user"
    });
    await completeStep(actor, "selectedClass");
  }

  // ✅ Step 5: Attribute selection
  if (!checkStep(actor, "selectedAttributes")) {
    const choices = selectedClass.system?.selected_adjustment?.choose_stat || [];
    if (choices.length > 0) {
      try {
        const adjustments = await selectAttributes(actor, choices);
        if (!adjustments) return ui.notifications.warn("Attribute selection cancelled.");
      } catch (err) {
        console.warn("Attribute selection aborted:", err);
        return ui.notifications.warn("Attribute selection cancelled.");
      }
    }
    await completeStep(actor, "selectedAttributes");
  }

  // ✅ Step 6: Roll Health
  if (!checkStep(actor, "rolledHealth")) {
    console.log("❤️ Rolling health...");
  
    const formula = `1d10 + 10`;
    const roll = new Roll(formula);
    await roll.evaluate();
  
    const total = roll.total;
    await actor.update({
      "system.health.max": total,
      "system.health.value": total
    });
  
    await chatOutput({
      actor,
      title: "Health Rolled",
      subtitle: actor.name,
      icon: "fa-heart-pulse",
      content: `<span class="counter">${total}</span> HP`
    });
  
    await completeStep(actor, "rolledHealth");
  }

  // ✅ Step 7: Skill selection
  if (!checkStep(actor, "selectedSkills")) {
    const adjustments = await selectSkills(actor, selectedClass);
    if (!adjustments || adjustments.length === 0) {
      return ui.notifications.warn("Skill selection cancelled.");
    }

    await chatOutput({
      actor,
      title: "Skills Selected",
      subtitle: actor.name,
      icon: "fa-sitemap",
      content: `
          ${adjustments
            .map(i => `<p><img src="${i.img}" style="height:2.5em; vertical-align:middle; margin-right:0.4em;"> ${i.name}</p>`)
            .join("")}
        `
    });
        
    await completeStep(actor, "selectedSkills");
  }

  // ✅ Step 8: Roll Loadout + Trinkets + Patches + Credits
  if (!checkStep(actor, "rolledLoadout")) {
    const DEFAULT_IMAGES = {
      Loadout: "modules/fvtt_mosh_1e_psg/icons/rolltables/loadouts.png",
      Patches: "modules/fvtt_mosh_1e_psg/icons/rolltables/patch.png",
      Trinkets: "modules/fvtt_mosh_1e_psg/icons/rolltables/trinkets.png"
    };
  
    const classItem = await fromUuid(actor.system.class?.uuid);
    if (!classItem) return ui.notifications.error("Could not load class item for loadout.");
  
    const tableUUIDs = [
      classItem.system.roll_tables?.loadout,
      classItem.system.roll_tables?.patch,
      classItem.system.roll_tables?.trinket
    ].filter(Boolean);
  
    const allLoot = { Weapons: [], Armor: [], Items: [] };
    const itemsToCreate = [];
  
    for (const uuid of tableUUIDs) {
      const table = await fromUuid(uuid);
      if (!table) continue;
      const results = (await table.roll()).results;
  
      for (const result of results) {
        const ref = result.documentCollection;
        const docId = result.documentId;
        let fullItem = null;
  
        if (ref && docId) {
          const itemUuid = `Compendium.${ref}.${docId}`;
          try {
            fullItem = await fromUuid(itemUuid);
          } catch (error) {
            console.warn(`Failed to load item from UUID: ${itemUuid}`, error);
          }
        }
  
        if (fullItem) {
          const itemData = fullItem.toObject(false);
          itemsToCreate.push(itemData);
          if (itemData.type === "weapon") allLoot.Weapons.push({ name: itemData.name, img: itemData.img });
          else if (itemData.type === "armor") allLoot.Armor.push({ name: itemData.name, img: itemData.img });
          else allLoot.Items.push({ name: itemData.name, img: itemData.img });
          continue;
        }
  
        const cleanText = result.text?.replace(/<br\s*\/?>/gi, " ").replace(/@UUID\[[^\]]+\]/g, "").trim();
        if (cleanText) {
          itemsToCreate.push({
            name: cleanText,
            type: "item",
            img: DEFAULT_IMAGES.Loadout,
            system: {},
            effects: [],
            flags: {}
          });
          allLoot.Items.push(cleanText);
        }
      }
    }
  
    // Add items to actor
    if (itemsToCreate.length > 0) await actor.createEmbeddedDocuments("Item", itemsToCreate);
  
    // 🎲 Starting credits
    const creditRoll = await new Roll("2d10 * 10").evaluate({ async: true });
    const startingCredits = creditRoll.total;
    await actor.update({ "system.credits.value": startingCredits });
  
    // 💬 Chat output
    let lootSummary = "";
    for (const [category, items] of Object.entries(allLoot)) {
      if (items.length > 0) {
        lootSummary += `<u>${category}</u>`;
        lootSummary += items.map(i => `
          <p><img src="${i.img || DEFAULT_IMAGES.Loadout}" style="height:2.5em; vertical-align:middle; margin-right:0.4em;"> ${i.name}</p>
        `).join("");
      }
    }
    lootSummary += `<br><strong>Starting Credits:</strong> ${startingCredits} cr`;
  
    await chatOutput({
      actor,
      title: "Loadout & Gear",
      subtitle: actor.name,
      icon: "fa-dice",
      image: DEFAULT_IMAGES.Loadout,
      content: lootSummary
    });
  
    await completeStep(actor, "rolledLoadout");
  }
     
  // ✅ Final Step: Mark character creation as completed
  await setCompleted(actor, true);
  ui.notifications.info(`${actor.name} has completed character creation.`);

}
