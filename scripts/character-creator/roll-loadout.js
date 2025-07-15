import { chatOutput } from "../utils/chat-output.js";

export async function rollLoadout(actor, selectedClass, { rollCredits = false, clearItems = false } = {}) {
  if (!actor || !selectedClass) return;

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
    await actor.deleteEmbeddedDocuments("Item", actor.items.map(i => i.id));
  }

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
        if (itemData.type === "weapon") allItelms.Weapons.push(itemData.name);
        else if (itemData.type === "armor") allItems.Armor.push(itemData.name);
        else allItems.Items.push(itemData.name);
        continue;
      }

      // fallback for text-only results
      const cleanText = result.text?.replace(/<br\s*\/?>/gi, " ").replace(/@UUID\[[^\]]+\]/g, "").trim();
      if (cleanText) {
        itemsToCreate.push({ name: cleanText, type: "item", img: DEFAULT_IMAGES.Loadout, system: {}, effects: [], flags: {} });
        allItems.Items.push(cleanText);
      }
    }
  }

  if (itemsToCreate.length > 0) {
    await actor.createEmbeddedDocuments("Item", itemsToCreate);
  }

  let creditString = "";
  if (rollCredits) {
    const creditRoll = new Roll("2d10 * 10");
    await creditRoll.evaluate();
    const startingCredits = creditRoll.total;
    await actor.update({ system: { credits: { value: startingCredits } } });
    creditString = `<br><strong >Starting Credits:</strong> ${startingCredits} cr`;
  }

  // 💬 Chat output
  let itemSummary = "";
  for (const [category, items] of Object.entries(allItems)) {
    if (items.length > 0) {
      itemSummary += `<h3>${category}</h3>`;
      itemSummary += items.map(i => `
        <p><img src="${i.img}" style="height:2.5em; vertical-align:middle; margin-right:0.4em;"> ${i.name}</p>
      `).join("");
    }
  }
  itemSummary += `<br><strong>Starting Credits:</strong> <label class="counter">${startingCredits}</label> cr`;

  await chatOutput({
    actor,
    title: "Loadout",
    subtitle: actor.name,
    icon: "fa-dice",
    image: DEFAULT_IMAGES.Loadout,
    content: ItemSummary
  });
}
