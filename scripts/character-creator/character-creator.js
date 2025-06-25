import { selectClass } from "./select-class.js";
import { selectAttribute } from "./select-attribute.js";
import { selectSkills } from "./select-skills.js";

export async function startCharacterCreation(actor) {
  if (!actor) {
    ui.notifications.error("No actor provided.");
    return;
  }

  console.log("\u{1F4D6} Starting character creation for:", actor.name);

  // ✅ Step 1: Confirm overwrite
  const confirm = await Dialog.confirm({
    title: `\u26A0\uFE0F Overwrite "${actor.name}"?`,
    content: `
      <div style="color: #ff4444; font-size: 1.2em; font-weight: bold; padding: 1em; text-align: center; border: 2px solid #ff4444; border-radius: 8px;">
        This process will <u>permanently overwrite</u><br><br>
        <h3><strong>"${actor.name}"</strong></h3><br>
        All existing items, stats, class, and skills will be erased and rebuilt from scratch.
      </div>
    `
  });

  if (!confirm) {
    ui.notifications.warn("Character creation canceled.");
    return;
  }

  // ✅ Step 2: Clean slate – delete items
  await actor.deleteEmbeddedDocuments("Item", actor.items.map(i => i.id));

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
