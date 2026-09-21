import { MODULE_ID, SETTING_ENABLE_CYBERWARE, qolClassName } from "../codex/constants.js";
import { getSheetKind } from "../register/sheets.js";
import { escapeHTML } from "../utils/html-safety.js";
import { getThemeColor } from "../utils/get-theme-color.js";
import { AUGMENTATION_DEFINITIONS } from "./config.js";
import { calculateAugmentationState, getAugmentation, getAugmentationItems } from "./slots.js";

const ROW_CLASS = "qol-augmentation-row";
const STATUS_CLASS = "qol-augmentation-status";
const ITEMS_CLASS = "qol-augmentation-items";
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
  root?.querySelectorAll(`.${ROW_CLASS}, .qol-cyberware-row`).forEach(row => row.remove());
  if (!root || !game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
  const tabs = root.querySelector(".sheet-tabs");
  if (!tabs) return;

  for (const definition of AUGMENTATION_DEFINITIONS) {
    if (definition.itemTypes.includes(sheet.item?.type)) tabs.before(createItemRow(sheet, definition));
  }
}

function createStatus(definition, state, augmentationItems) {
  const totals = state[definition.id];
  const status = document.createElement("div");
  status.className = qolClassName(STATUS_CLASS, `qol-${definition.id}-status`);
  status.style.setProperty("--theme-color", getThemeColor());
  const items = document.createElement("div");
  items.className = ITEMS_CLASS;
  for (const item of augmentationItems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pill interactive";
    button.textContent = item.name;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      item.sheet.render({ force: true });
    });
    items.append(button);
  }
  const label = document.createElement("span");
  label.setAttribute("role", "status");
  label.className = "pill";
  label.classList.toggle("selected", totals.overclocking > 0);
  label.textContent = game.i18n.format(totals.overclocking > 0
    ? `${definition.localization}.Overclocking` : `${definition.localization}.Usage`, {
    ...totals,
    overclocking: state.overclocking
  });
  status.replaceChildren(items, label);
  return status;
}

function renderAugmentationStatus(sheet, html) {
  const root = html?.[0] ?? html;
  if (!root) return;
  root.querySelectorAll(`.${STATUS_CLASS}, .qol-cyberware-status`).forEach(status => status.remove());
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE) || getSheetKind(sheet) !== "character") return;
  const tabs = root.querySelector(".sheet-tabs");
  if (!tabs) return;
  const state = calculateAugmentationState(sheet.actor);
  for (const definition of AUGMENTATION_DEFINITIONS) {
    const items = getAugmentationItems(sheet.actor, definition);
    if (items.length > 0) tabs.before(createStatus(definition, state, items));
  }
}

function refreshAugmentationStatus(actor) {
  if (actor?.type !== "character") return;
  for (const sheet of Object.values(actor.apps ?? {})) {
    if (sheet.rendered) renderAugmentationStatus(sheet, sheet.element);
  }
}

export function refreshOpenCyberwareSheets() {
  for (const sheet of Object.values(ui.windows)) {
    if (!sheet.rendered) continue;
    if (sheet.item) renderAugmentationItems(sheet, sheet.element);
    else if (sheet.actor) renderAugmentationStatus(sheet, sheet.element);
  }
}

export function registerCyberwareHooks() {
  if (registered) return;
  registered = true;
  Hooks.on("renderMothershipItemSheet", renderAugmentationItems);
  Hooks.on("renderMothershipSkillSheet", renderAugmentationItems);
  Hooks.on("renderActorSheet", renderAugmentationStatus);
  Hooks.on("updateActor", refreshAugmentationStatus);
  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, item => refreshAugmentationStatus(item.parent));
  }
}
