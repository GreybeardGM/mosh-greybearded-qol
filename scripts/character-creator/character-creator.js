import { selectClass } from "./select-class.js";
import { selectAttribute } from "./select-attribute.js";
import { selectSkills } from "./select-skills.js";
import { checkReady, setReady, checkCompleted, reset } from "./progress.js";

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

  // ✅ Step 3: Roll stats + saves (placeholder)
  console.log("\u{1F3B2} Rolling base stats and saves...");
  // TO DO: Roll and apply stats and saves

  // ✅ Step 4: Class selection
  console.log("\u{1F393} TODO: Select Class");

  // Placeholder for next steps
  console.log("\u{1F49C} TODO: Choose attributes...");
  console.log("\u{1F4DA} TODO: Choose skills...");
  console.log("\u{1F4B0} TODO: Roll loadout & credits...");
}
