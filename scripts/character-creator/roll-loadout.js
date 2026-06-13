import {
  MOSH_LOADOUT_CLEAR_ITEM_TYPES,
  MOSH_LOADOUT_ROLLTABLE_IMAGES,
  MOSH_STARTING_CREDITS_FORMULA
} from "../codex/mosh-system.js";
import { chatOutput } from "../utils/chat-output.js";
import { formatCurrency } from "../utils/normalization.js";
import { toEmbeddedItemData } from "./utils.js";

export async function rollLoadout(actor, selectedClass, { rollCredits = false, clearItems = false } = {}) {
  if (!actor || !selectedClass) return false;

  const classData = selectedClass.system ?? selectedClass; // Support for Item or raw data
  const tableUUIDs = [
    classData.roll_tables?.loadout,
    classData.roll_tables?.patch,
    classData.roll_tables?.trinket
  ].filter(Boolean);

  const allItems = { Weapons: [], Armor: [], Items: [] };
  const itemsToCreate = [];

  if (clearItems) {
    const idsToDelete = actor.items
      .filter(i => MOSH_LOADOUT_CLEAR_ITEM_TYPES.includes(i.type))
      .map(i => i.id);
    if (idsToDelete.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", idsToDelete);
    }
  }

  for (const uuid of tableUUIDs) {
    const table = await fromUuid(uuid);
    if (!table) continue;
    const results = (await table.roll()).results;

    for (const result of results) {
      let fullItem = null;
      let uuid = result.documentUuid;
      
      if (!uuid && result.documentCollection && result.documentId) {
        uuid = `Compendium.${result.documentCollection}.${result.documentId}`;
      }
      
      if (uuid) {
        try {
          fullItem = await fromUuid(uuid);
        } catch (error) {
          console.warn(`Failed to load item from UUID: ${uuid}`, error);
        }
      }

      if (fullItem) {
        const itemData = toEmbeddedItemData(fullItem, false);
        itemsToCreate.push(itemData);
        if (itemData.type === "weapon") allItems.Weapons.push({ name: itemData.name, img: itemData.img });
        else if (itemData.type === "armor") allItems.Armor.push({ name: itemData.name, img: itemData.img });
        else allItems.Items.push({ name: itemData.name, img: itemData.img });
        continue;
      }

      // fallback for text-only results
      const cleanText = result.text?.replace(/<br\s*\/?>/gi, " ").replace(/@UUID\[[^\]]+\]/g, "").trim();
      if (cleanText) {
        itemsToCreate.push({ name: cleanText, type: "item", img: MOSH_LOADOUT_ROLLTABLE_IMAGES.Loadout, system: {}, effects: [], flags: {} });
        allItems.Items.push({ name: cleanText, img: MOSH_LOADOUT_ROLLTABLE_IMAGES.Loadout });
      }
    }
  }

  if (itemsToCreate.length > 0) {
    await actor.createEmbeddedDocuments("Item", itemsToCreate);
  }
  
  // 💬 Chat output
  const categoryLabels = {
    Weapons: game.i18n.localize("MoshQoL.CharacterCreator.Loadout.Categories.Weapons"),
    Armor: game.i18n.localize("MoshQoL.CharacterCreator.Loadout.Categories.Armor"),
    Items: game.i18n.localize("MoshQoL.CharacterCreator.Loadout.Categories.Items")
  };
  const blocks = Object.entries(allItems)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => ({
      type: "itemList",
      title: categoryLabels[category] ?? category,
      items
    }));

  // Roll for Starting Credits
  if (rollCredits) {
    const creditRoll = new Roll(MOSH_STARTING_CREDITS_FORMULA);
    await creditRoll.evaluate();
    const startingCredits = creditRoll.total;
    await actor.update({ system: { credits: { value: startingCredits } } });
    blocks.push({
      type: "counter",
      label: game.i18n.localize("MoshQoL.CharacterCreator.Loadout.StartingCredits"),
      value: formatCurrency(startingCredits)
    });
  }
  
  await chatOutput({
    actor,
    title: game.i18n.localize("MoshQoL.CharacterCreator.Loadout.Title"),
    subtitle: actor.name,
    icon: "fa-dice",
    image: MOSH_LOADOUT_ROLLTABLE_IMAGES.Loadout,
    blocks
  });

  return true;
}
