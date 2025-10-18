import { chatOutput } from "../utils/chat-output.js";

export async function rollLoadout(actor, selectedClass, { rollCredits = false, clearItems = false } = {}) {
  if (!actor || !selectedClass) return false;

  const DEFAULT_IMAGES = {
    Loadout: "modules/fvtt_mosh_1e_psg/icons/rolltables/loadouts.png",
    Patches: "modules/fvtt_mosh_1e_psg/icons/rolltables/patch.png",
    Trinkets: "modules/fvtt_mosh_1e_psg/icons/rolltables/trinket.png"
  };

  const classData = selectedClass.system ?? selectedClass; // Support for Item or raw data
  const tableUUIDs = [
    classData.roll_tables?.loadout,
    classData.roll_tables?.patch,
    classData.roll_tables?.trinket
  ].filter(Boolean);

  const allItems = { Weapons: [], Armor: [], Items: [] };
  const itemsToCreate = [];

  if (clearItems) {
    const deletableTypes = ["weapon", "armor", "item"];
    const idsToDelete = actor.items
      .filter(i => deletableTypes.includes(i.type))
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
        const itemData = fullItem.toObject(false);
        itemsToCreate.push(itemData);
        if (itemData.type === "weapon") allItems.Weapons.push({ name: itemData.name, img: itemData.img });
        else if (itemData.type === "armor") allItems.Armor.push({ name: itemData.name, img: itemData.img });
        else allItems.Items.push({ name: itemData.name, img: itemData.img });
        continue;
      }

      // fallback for text-only results
      const cleanText = result.text?.replace(/<br\s*\/?>/gi, " ").replace(/@UUID\[[^\]]+\]/g, "").trim();
      if (cleanText) {
        itemsToCreate.push({ name: cleanText, type: "item", img: DEFAULT_IMAGES.Loadout, system: {}, effects: [], flags: {} });
        allItems.Items.push({ name: cleanText, img: DEFAULT_IMAGES.Loadout });
      }
    }
  }

  if (itemsToCreate.length > 0) {
    await actor.createEmbeddedDocuments("Item", itemsToCreate);
  }
  
  // 💬 Chat output
  let itemSummary = "";
  for (const [category, items] of Object.entries(allItems)) {
    if (items.length > 0) {
      itemSummary += `<h3>${category}</h3>`;
      itemSummary += items.map(i => `
        <div style="
          display: flex;
          align-items: center;
          gap: 0.5em;
          margin: 0.2em 0;
        ">
          <img src="${i.img}" 
               style="height: 2.5em; flex: 0 0 auto;">
          <span style="flex: 1;">${i.name}</span>
        </div>
      `).join("");
    }
  }

  // Roill for Staring Credits
  if (rollCredits) {
    const creditRoll = new Roll("2d10 * 10");
    await creditRoll.evaluate();
    const startingCredits = creditRoll.total;
    await actor.update({ system: { credits: { value: startingCredits } } });
    itemSummary += `<br><strong>Starting Credits:</strong> <label class="counter">${startingCredits}</label> cr`;
  }
  
  await chatOutput({
    actor,
    title: "Loadout Rolled",
    subtitle: actor.name,
    icon: "fa-dice",
    image: DEFAULT_IMAGES.Loadout,
    content: itemSummary
  });

  return true;
}
