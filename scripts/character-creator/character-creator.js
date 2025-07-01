import { chatOutput } from "../utils/chat-output.js";
import { checkReady, setReady, checkStep, completeStep, checkCompleted, setCompleted, reset } from "./progress.js";

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
        class: { value: "", uuid: "" },
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
    await completeStep(actor, "selectedClass");
  }

  // Placeholder for next steps
  console.log("\u{1F49C} TODO: Choose attributes...");
  console.log("\u{1F4DA} TODO: Choose skills...");
  console.log("\u{1F4B0} TODO: Roll loadout & credits...");

  // ✅ Final Step: Mark character creation as completed
  await setCompleted(actor, true);
  ui.notifications.info(`${actor.name} has completed character creation.`);

}
