import { QoLContractorSheet } from "./sheets/contractor-sheet-class.js";
import { defineStashSheet } from "./sheets/stash-sheet-class.js";
import { convertStress } from "./shore-leave/convert-stress.js";
import { ShoreLeaveTierEditor } from "./shore-leave/edit-shore-leave-tiers.js";
import { SimpleShoreLeave } from "./shore-leave/simple-shore-leave.js";
import { SHORE_LEAVE_TIERS } from "./shore-leave/default-shore-leave-tiers.js";
import { triggerShipCrit } from "./ship-crits-0e.js";
import { upsertToolband, removeToolband } from "./toolband.js";
import { applyDamage } from "./utils/apply-damage.js";
import { startCharacterCreation } from "./character-creator/character-creator.js";
import { registerDiceTerms } from "./dice.js";
import { setReady } from "./character-creator/progress.js";
import "./patches/creature-skillfix.js";

// Needs to be here to check for
let StashSheet;

/** Ermittelt einen stabilen Sheet-„Kind“-Identifier für die Toolbar-Logik */
function getSheetKind(sheet) {
  const actor = sheet?.actor;
  // Konkrete Klassen zuerst prüfen
  if (sheet instanceof QoLContractorSheet) return "contractor";
  if (StashSheet && sheet instanceof StashSheet) return "stash";
  // Generisch über Actor-Typ
  if (actor?.type === "ship") return "ship";
  if (actor?.type === "character") return "character";
  if (actor?.type === "creature") return "creature";
  return "unknown";
}

// Register all the stuff
Hooks.once("ready", () => {
  
  Handlebars.registerHelper("eq", (a, b) => a === b);  
  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("capitalize", str => str.charAt(0).toUpperCase() + str.slice(1));
  Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));
  Handlebars.registerHelper("includes", function (collection, value) {
    if (Array.isArray(collection)) return collection.includes(value);
    if (collection instanceof Set) return collection.has(value);
    return false;
  });
  Handlebars.registerHelper("stripHtml", (text) => {
    return typeof text === "string" ? text.replace(/<[^>]*>/g, "").trim() : "";
  });
  
  // Global registry for use in macros
  game.moshGreybeardQol = game.moshGreybeardQol || {};
  game.moshGreybeardQol.convertStress = convertStress;
  game.moshGreybeardQol.SimpleShoreLeave = SimpleShoreLeave;
  game.moshGreybeardQol.triggerShipCrit = triggerShipCrit;
  game.moshGreybeardQol.startCharacterCreation = startCharacterCreation;
  game.moshGreybeardQol.applyDamage = applyDamage;

  // Register Stash Sheet
  const BaseSheet = CONFIG.Actor.sheetClasses.character["mosh.MothershipActorSheet"].cls;
  StashSheet = defineStashSheet(BaseSheet);

  // V13 Actors
  const ActorsCollection = foundry.documents.collections.Actors;
  
  ActorsCollection.registerSheet("mosh-greybearded-qol", StashSheet, {
    types: ["character"],
    label: "MoshQoL.Sheets.Stash",
    makeDefault: false
  });

  ActorsCollection.registerSheet("mosh-greybearded-qol", QoLContractorSheet, {
    types: ["creature"],
    label: "MoshQoL.Sheets.Contractor",
    makeDefault: false
  });

  // Armor Broken Status Effect
  const customStatus = {
    id: "qol-broken-armor",
    name: "MoshQoL.Status.BrokenArmor",
    img: "modules/mosh-greybearded-qol/assets/icons/status/armor-broken.svg"
  };
  if (!CONFIG.statusEffects.some(e => e.id === customStatus.id)) {
    CONFIG.statusEffects.push(customStatus);
  }
  
  // Debug Check
  console.log("✅ MoSh Greybearded QoL loaded");  
});

// Settings
Hooks.once("init", () => {
  registerDiceTerms();

  // Theme Colors
  game.settings.register("mosh-greybearded-qol", "themeColor", {
    name: "MoshQoL.Settings.ThemeColor.Name",
    hint: "MoshQoL.Settings.ThemeColor.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "#f50"
  });

  game.settings.register("mosh-greybearded-qol", "themeColorOverride", {
    name: "MoshQoL.Settings.ThemeColorOverride.Name",
    hint: "MoshQoL.Settings.ThemeColorOverride.Hint",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });

  // Config Stress Conversion
  game.settings.register("mosh-greybearded-qol", "convertStress.noSanitySave", {
    name: "MoshQoL.Settings.ConvertStress.NoSanitySave.Name",
    hint: "MoshQoL.Settings.ConvertStress.NoSanitySave.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.noStressRelieve", {
    name: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Name",
    hint: "MoshQoL.Settings.ConvertStress.NoStressRelieve.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.minStressConversion", {
    name: "MoshQoL.Settings.ConvertStress.MinStressConversion.Name",
    hint: "MoshQoL.Settings.ConvertStress.MinStressConversion.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "convertStress.formula", {
    name: "MoshQoL.Settings.ConvertStress.Formula.Name",
    hint: "MoshQoL.Settings.ConvertStress.Formula.Hint",
    scope: "world",
    config: true,
    default: "1d5",
    type: String
  });

  // Config simple shore leave
  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.randomFlavor", {
    name: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Name",
    hint: "MoshQoL.Settings.SimpleShoreLeave.RandomFlavor.Hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register("mosh-greybearded-qol", "simpleShoreLeave.disableFlavor", {
    name: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Name",
    hint: "MoshQoL.Settings.SimpleShoreLeave.DisableFlavor.Hint",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  });
  
  // Config Shore Leave Tiers
  game.settings.register("mosh-greybearded-qol", "shoreLeaveTiers", {
    name: "MoshQoL.Settings.ShoreLeaveTiers.Name",
    scope: "world",
    config: false,
    type: Object,
    default: SHORE_LEAVE_TIERS
  });

  game.settings.registerMenu("mosh-greybearded-qol", "shoreLeaveEditor", {
    name: "MoshQoL.Settings.ShoreLeaveEditor.Name",
    label: "MoshQoL.Settings.ShoreLeaveEditor.Label",
    hint: "MoshQoL.Settings.ShoreLeaveEditor.Hint",
    icon: "fas fa-edit",
    type: ShoreLeaveTierEditor,
    restricted: true
  });

  // ✅ Enable MoSh QoL Character Creator
  game.settings.register("mosh-greybearded-qol", "enableCharacterCreator", {
    name: "MoshQoL.Settings.EnableCharacterCreator.Name",
    hint: "MoshQoL.Settings.EnableCharacterCreator.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  
  // ✅ Enable Ship Crits (default: false)
  game.settings.register("mosh-greybearded-qol", "enableShipCrits", {
    name: "MoshQoL.Settings.EnableShipCrits.Name",
    hint: "MoshQoL.Settings.EnableShipCrits.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.on("renderChatMessageHTML", (message, html /* HTMLElement */, data) => {
  const buttons = html.querySelectorAll(".greybeardqol .chat-action");
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      let args = [];
      if (button.dataset.args) {
        try {
          args = JSON.parse(button.dataset.args);
        } catch (error) {
          console.warn("[MoSh QoL] Failed to parse chat action args", error);
          args = [];
        }
      }
      if (!action) return;

      const actor = game.user.character;
      if (!actor) { ui.notifications.warn("No character assigned."); return; }

      switch (action) {
        case "convertStress":
          await game.moshGreybeardQol.convertStress(actor, ...args);
          break;
        case "simpleShoreLeave":
          await game.moshGreybeardQol.SimpleShoreLeave.wait({ actor, randomFlavor: args[0] });
          break;
        case "triggerShipCrit":
          await game.moshGreybeardQol.triggerShipCrit(...args);
          break;
        default:
          ui.notifications.warn(`Unknown action: ${action}`);
      }
    }, { once: true });
  }
});

// Sheet Header Buttons
Hooks.on("renderActorSheet", (sheet, html) => {
  const actor = sheet.actor;
  const isGM = game.user.isGM;
  const isOwner = actor?.testUserPermission?.(game.user, "OWNER") ?? false;
  if ( !isGM && !isOwner ) return;
  // Nur Sheet-Typ ermitteln und an die Helfer-Funktion durchreichen.
  const kind = getSheetKind(sheet);
  // upsert immer aufrufen; die Entscheidung über Sichtbarkeit/Buttons trifft später die Helfer-Funktion
  try {
    upsertToolband(sheet, html, { kind, isGM });
  } catch (e) {
    console.error(e);
  }
});

// Prepare fresh characters for Character Creation
Hooks.on("createActor", async (actor, options, userId) => {
  // Nur für Charaktere
  if (actor.type !== "character") return;

  // Flag setzen
  await setReady(actor);
  console.log(`[MoSh QoL] setReady() gesetzt für neuen Charakter: ${actor.name}`);
});

// Toolband aufräumen
Hooks.on("closeActorSheet", (sheet) => {
  try { removeToolband(sheet); } catch (e) { console.error(e); }
});

// register token damage tool
Hooks.on("getSceneControlButtons", (controls) => {
  // Normalize: get the Token controls whether `controls` is Array or Object
  const tokenControls = Array.isArray(controls)
    ? controls.find(c => c?.name === "token")
    : (controls?.token ?? controls?.tokens ?? null);
  if (!tokenControls) return;

  const toolDef = {
    name: "applyDamage",
    title: "Apply Damage to Selected Tokens",
    icon: "fa-solid fa-heart-broken",
    visible: game.user.isGM || game.user.isTrusted,
    button: true,
    onClick: async () => {
      const selected = canvas.tokens.controlled;
      if (!selected.length) {
        ui.notifications.warn("No tokens selected.");
        return;
      }

      // Ask once, apply to all
      const data = await foundry.applications.api.DialogV2.input({
        window: { title: "Apply Damage to Selected Tokens" },
        content: `
          <p>Enter the amount of damage to apply to
          <strong>${selected.length}</strong> selected
          ${selected.length === 1 ? "token" : "tokens"}:</p>
          <input name="damage" type="number" min="1" step="1" autofocus style="width:100%">
        `,
        ok: { label: "Apply", icon: "fa-solid fa-check" },
        cancel: { label: "Cancel", icon: "fa-solid fa-xmark" }
      });

      if (!data) return;
      const damage = Math.trunc(Number(data.damage));
      if (!Number.isFinite(damage) || damage <= 0) {
        ui.notifications.warn("Please enter a positive damage value.");
        return;
      }

      let applied = 0;
      for (const t of selected) {
        const actorLike = t?.actor ?? t;
        if (!actorLike) continue;
        try {
          await game.moshGreybeardQol.applyDamage(actorLike, damage);
          applied++;
        } catch (err) {
          console.error("applyDamage failed for", t, err);
        }
      }
      ui.notifications.info(`Applied ${damage} damage to ${applied}/${selected.length} ${selected.length === 1 ? "token" : "tokens"}.`);
    }
  };

  // Insert tool whether `tools` is an Array or an Object
  if (Array.isArray(tokenControls.tools)) {
    tokenControls.tools.push(toolDef);
  } else {
    // Object-shaped tools (older or customized setups)
    tokenControls.tools = tokenControls.tools ?? {};
    const order = Object.keys(tokenControls.tools).length;
    tokenControls.tools.applyDamage = { ...toolDef, order };
  }
});
