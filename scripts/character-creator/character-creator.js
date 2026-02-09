import { chatOutput } from "../utils/chat-output.js";
import { checkReady, setReady, checkStep, completeStep, checkCompleted, setCompleted, reset } from "./progress.js";
import { ClassSelectorApp } from "./select-class.js";
import { AttributeSelectorApp } from "./select-attributes.js";
import { SkillSelectorApp } from "./select-skills.js";
import { rollLoadout } from "./roll-loadout.js";

export async function startCharacterCreation(actor) {
  if (!actor) {
    ui.notifications.error(game.i18n.localize("MoshQoL.Errors.NoActorProvided"));
    return;
  }
  // ✅ Check if character is already completed
  if (checkCompleted(actor)) {
    if (game.user.isGM) {
      const resetConfirm = await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize("MoshQoL.CharacterCreator.Dialog.AlreadyCompleted.Title") },
        content: `<p>${game.i18n.format("MoshQoL.CharacterCreator.Dialog.AlreadyCompleted.Content", { actorName: actor.name })}</p>`,
        buttons: [
          { label: game.i18n.localize("MoshQoL.Common.Reset"), icon: "fa-solid fa-rotate-left", action: "reset" },
          { label: game.i18n.localize("MoshQoL.Common.Cancel"), icon: "fa-solid fa-xmark", action: "cancel" }
        ],
        default: "cancel"
      });
      if (resetConfirm === "reset") {
        await reset(actor);
        ui.notifications.info(game.i18n.format("MoshQoL.CharacterCreator.Notifications.Reset", { actorName: actor.name }));
      } else {
        ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.Cancelled"));
        return;
      }
    } else {
      ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.AlreadyCompleted"));
      return;
    }
  }

  // ✅ Step 1: Check if actor is marked "ready"
  if (!checkReady(actor)) {
    const content = `
      <p>${game.i18n.format("MoshQoL.CharacterCreator.Dialog.Warning.NoValidData", { actorName: actor.name })}</p>
      <p>${game.i18n.localize("MoshQoL.CharacterCreator.Dialog.Warning.OverwriteRisk")}</p>
      <p>${game.i18n.localize("MoshQoL.CharacterCreator.Dialog.Warning.ChooseAction")}</p>
    `;
  
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MoshQoL.CharacterCreator.Dialog.Warning.Title") },
      content,
      buttons: [
        {
          label: game.i18n.localize("MoshQoL.CharacterCreator.Dialog.Warning.Overwrite"),
          icon: "fa-solid fa-triangle-exclamation",
          action: "overwrite"
        },
        {
          label: game.i18n.localize("MoshQoL.CharacterCreator.Dialog.Warning.MarkCompleted"),
          icon: "fa-solid fa-check-circle",
          action: "complete"
        },
        {
          label: game.i18n.localize("MoshQoL.Common.Cancel"),
          icon: "fa-solid fa-xmark",
          action: "cancel"
        }
      ],
      default: "cancel"
    });
  
    if (choice === "cancel") {
      ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.Cancelled"));
      return;
    } else if (choice === "complete") {
      await setCompleted(actor, true);
      ui.notifications.info(game.i18n.format("MoshQoL.CharacterCreator.Notifications.MarkedCompleted", { actorName: actor.name }));
      return;
    } else if (choice === "overwrite") {
      await setReady(actor, true); // mark as ready and proceed
    }
  }

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
        ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.ClassUuidInvalid"));
      }
    } else {
      ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.NoClassUuid"));
    }
  }
  // If nothing was loaded -> selection dialog
  if (!selectedClass) {
    console.log("📚 Selecting class...");
    selectedClass = await ClassSelectorApp.wait({ actor });
    if (!selectedClass) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.ClassSelectionCancelled"));
      return;
    }
    await chatOutput({
      title: game.i18n.localize("MoshQoL.CharacterCreator.Chat.ClassSelected.Title"),
      subtitle: actor.name,
      content: game.i18n.format("MoshQoL.CharacterCreator.Chat.ClassSelected.Content", { actorName: actor.name, className: selectedClass.name }),
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
        const adjustments = await AttributeSelectorApp.wait({ actor, attributeChoices: choices });
        if (!adjustments) return ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.AttributeSelectionCancelled"));
      } catch (err) {
        console.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.AttributeSelectionAborted"), err);
        return ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.AttributeSelectionCancelled"));
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
      title: game.i18n.localize("MoshQoL.CharacterCreator.Chat.HealthRolled.Title"),
      subtitle: actor.name,
      icon: "fa-heart-pulse",
      content: `<span class="counter">${total}</span> HP`
    });
  
    await completeStep(actor, "rolledHealth");
  }

  // ✅ Step 7: Skill selection
  if (!checkStep(actor, "selectedSkills")) {
    const adjustments = await SkillSelectorApp.wait({ actor, selectedClass });
    if (!adjustments || adjustments.length === 0) {
      return ui.notifications.warn(game.i18n.localize("MoshQoL.CharacterCreator.Notifications.SkillSelectionCancelled"));
    }

    await chatOutput({
      actor,
      title: game.i18n.localize("MoshQoL.CharacterCreator.Chat.SkillsSelected.Title"),
      subtitle: actor.name,
      icon: "fa-sitemap",
      content: `
          ${adjustments
            .map(i => `
              <div style="display:flex; align-items:center; gap:0.5em; margin:0.2em 0;">
                <img src="${i.img}" style="height:2.5em; flex:0 0 auto;">
                <span style="flex:1; white-space:nowrap;">${i.name}</span>
              </div>
            `)
            .join("")}
        `
    });
        
    await completeStep(actor, "selectedSkills");
  }

  // ✅ Step 8: Roll Loadout + Patches + Trinkets + Credits
  if (!checkStep(actor, "rolledLoadout")) {
    const loadoutSuccess = await rollLoadout(actor, selectedClass, {
      rollCredits: true,
      clearItems: false
    });
    if (loadoutSuccess) {
      await completeStep(actor, "rolledLoadout");
    }
  }
     
  // ✅ Final Step: Mark character creation as completed
  await setCompleted(actor, true);
  ui.notifications.info(game.i18n.format("MoshQoL.CharacterCreator.Notifications.Completed", { actorName: actor.name }));

}
