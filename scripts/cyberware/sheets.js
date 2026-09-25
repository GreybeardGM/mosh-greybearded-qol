import { MODULE_ID, SETTING_ENABLE_CYBERWARE, qolClassName } from "../codex/constants.js";
import { getSheetKind } from "../register/sheets.js";
import { escapeHTML } from "../utils/html-safety.js";
import { getThemeColor } from "../utils/get-theme-color.js";
import { AUGMENTATION_DEFINITIONS, getSlotRule, getSlotRules } from "./config.js";
import { getAugmentation } from "./slots.js";
import { AUGMENTATION_STATUS_CLASS, getAugmentationStatusRows } from "./status.js";

const ROW_CLASS = "qol-augmentation-row";
let registered = false;

function createItemRow(sheet, definition) {
  const augmentation = getAugmentation(sheet.item, definition);
  const notesLabel = escapeHTML(game.i18n.localize(`${definition.localization}.Notes`));
  const row = document.createElement("div");
  row.className = qolClassName(ROW_CLASS, `qol-${definition.id}-row`);
  row.style.setProperty("--theme-color", getThemeColor());
  // No form field names: only this row's change handler writes Item flags.
  row.innerHTML = `
    <div class="pill">
    <label><input type="checkbox" data-field="enabled"> ${escapeHTML(game.i18n.localize(`${definition.localization}.Label`))}</label>
    <label>${escapeHTML(game.i18n.localize(`${definition.localization}.Slots`))} <input type="number" data-field="slots" min="0" max="9" step="1" inputmode="numeric"></label>
    <input type="text" data-field="notes" aria-label="${notesLabel}" placeholder="${notesLabel}">
    </div>`;
  for (const input of row.querySelectorAll("input")) {
    if (input.type === "checkbox") input.checked = augmentation.enabled;
    else input.value = augmentation[input.dataset.field];
    input.disabled = !sheet.isEditable;
  }
  row.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.matches("input:not([type=checkbox])")) {
      event.preventDefault();
      event.target.blur();
    }
  });
  row.addEventListener("change", async event => {
    event.stopPropagation();
    const input = event.target;
    if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)
      || !sheet.isEditable || !input.matches("input[data-field]")) return;
    if (!input.reportValidity()) return;
    const field = input.dataset.field;
    const value = input.type === "checkbox" ? input.checked
      : input.type === "number" ? (input.valueAsNumber || 0) : input.value;
    try {
      await sheet.item.update({ [`flags.${MODULE_ID}.${definition.id}.${field}`]: value });
    } catch (error) {
      console.error(`${MODULE_ID} | ${definition.id} update failed`, error);
      ui.notifications.error(game.i18n.localize(`${definition.localization}.SaveError`));
      sheet.render(false);
    }
  });
  return row;
}

function renderAugmentationItems(sheet, html) {
  const root = html?.[0] ?? html;
  root?.querySelectorAll(`.${ROW_CLASS}`).forEach(row => row.remove());
  if (!root || !game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
  const tabs = root.querySelector(".sheet-tabs");
  if (!tabs) return;

  for (const definition of AUGMENTATION_DEFINITIONS) {
    if (definition.itemTypes.includes(sheet.item?.type)) tabs.before(createItemRow(sheet, definition));
  }
}

function createStatus(row) {
  const status = document.createElement("div");
  status.className = row.className;
  status.style.setProperty("--theme-color", getThemeColor());
  const items = document.createElement("div");
  items.className = row.itemsClassName;
  for (const item of row.items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pill interactive";
    button.textContent = item.name;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      item.document.sheet.render(true);
    });
    items.append(button);
  }
  const label = document.createElement("span");
  label.setAttribute("role", "status");
  label.className = "pill";
  label.classList.toggle("selected", row.selected);
  label.textContent = row.label;
  status.replaceChildren(items, label);
  return status;
}

function renderAugmentationStatus(sheet, html) {
  if (getSheetKind(sheet) !== "character") return;
  const root = html?.[0] ?? html;
  if (!root) return;
  root.querySelectorAll(`.${AUGMENTATION_STATUS_CLASS}`).forEach(status => status.remove());
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
  const tabs = root.querySelector(".sheet-tabs");
  if (!tabs) return;
  for (const row of getAugmentationStatusRows(sheet.actor)) tabs.before(createStatus(row));
}

function refreshAugmentationStatus(actor) {
  if (!["character", "creature"].includes(actor?.type)
    || !game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
  for (const sheet of Object.values(actor.apps ?? {})) {
    if (!sheet.rendered || sheet.actor !== actor) continue;
    if (getSheetKind(sheet) === "contractor") sheet.render(false);
    else if (actor.type === "character") renderAugmentationStatus(sheet, sheet.element);
  }
}

function hasChangeAtPath(changes, path) {
  if (!changes || typeof changes !== "object") return false;
  const parts = path.split(".");
  let current = changes;
  for (let index = 0; index < parts.length; index++) {
    if (!current || typeof current !== "object") return true;
    if (Object.hasOwn(current, parts.slice(index).join("."))) return true;
    if (!Object.hasOwn(current, parts[index])) return false;
    current = current[parts[index]];
  }
  return true;
}

function refreshChangedAugmentationItem(item, changes) {
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
  if (hasChangeAtPath(changes, "type")) return refreshAugmentationStatus(item.parent);
  const definitions = AUGMENTATION_DEFINITIONS.filter(definition => definition.itemTypes.includes(item.type));
  if (!definitions.length) return;
  if (definitions.some(definition => {
    const flagPath = `flags.${MODULE_ID}.${definition.id}`;
    return ["enabled", "slots", "-=enabled", "-=slots"].some(field => hasChangeAtPath(changes, `${flagPath}.${field}`))
      || hasChangeAtPath(changes, `flags.${MODULE_ID}.-=${definition.id}`);
  }) || (hasChangeAtPath(changes, "name") && definitions.some(definition => getAugmentation(item, definition).enabled))) {
    refreshAugmentationStatus(item.parent);
  }
}

export function refreshOpenCyberwareSheets() {
  for (const sheet of Object.values(ui.windows)) {
    if (!sheet.rendered) continue;
    if (sheet.item) renderAugmentationItems(sheet, sheet.element);
    else if (getSheetKind(sheet) === "contractor") sheet.render(false);
    else if (sheet.actor) renderAugmentationStatus(sheet, sheet.element);
  }
}

export function registerCyberwareHooks() {
  if (registered) return;
  registered = true;
  Hooks.on("renderMothershipItemSheet", renderAugmentationItems);
  Hooks.on("renderMothershipSkillSheet", renderAugmentationItems);
  Hooks.on("renderActorSheet", renderAugmentationStatus);
  Hooks.on("updateActor", (actor, changes) => {
    if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
    const rules = getSlotRules();
    const stats = AUGMENTATION_DEFINITIONS.map(definition => getSlotRule(actor, definition, rules).attribute);
    if (stats.some(stat => stat !== "none" && hasChangeAtPath(changes, `system.stats.${stat}.value`))) {
      refreshAugmentationStatus(actor);
    }
  });
  for (const hook of ["createItem", "deleteItem"]) {
    Hooks.on(hook, item => {
      if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
      if (AUGMENTATION_DEFINITIONS.some(definition => definition.itemTypes.includes(item.type)
        && getAugmentation(item, definition).enabled)) refreshAugmentationStatus(item.parent);
    });
  }
  Hooks.on("updateItem", refreshChangedAugmentationItem);
}
