import { FLAG_CYBERWARE, MODULE_ID, SETTING_ENABLE_CYBERWARE, qolClassName } from "../codex/constants.js";
import { MOSH_EQUIPMENT_ITEM_TYPES } from "../codex/mosh-system.js";
import { getSheetKind } from "../register/sheets.js";
import { escapeHTML } from "../utils/html-safety.js";
import { getThemeColor } from "../utils/get-theme-color.js";
import { calculateCyberwareSlots, getCyberware, getCyberwareItems } from "./slots.js";

const ROW_CLASS = "qol-cyberware-row";
const STATUS_CLASS = "qol-cyberware-status";
const ITEMS_CLASS = "qol-cyberware-items";
const FLAG_PATH = `flags.${MODULE_ID}.${FLAG_CYBERWARE}`;
let registered = false;

function renderCyberwareItem(sheet, html) {
  const item = sheet.item;
  if (!MOSH_EQUIPMENT_ITEM_TYPES.includes(item?.type)) return;
  const root = html?.[0] ?? html;
  root?.querySelector(`.${ROW_CLASS}`)?.remove();
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE)) return;
  const tabs = root?.querySelector(".sheet-tabs");
  if (!tabs) return;

  const cyberware = getCyberware(item);
  const notesLabel = escapeHTML(game.i18n.localize("MoshQoL.Cyberware.Notes"));
  const row = document.createElement("div");
  row.className = qolClassName(ROW_CLASS);
  row.style.setProperty("--theme-color", getThemeColor());
  // No form field names: only this row's change handler writes Item flags.
  row.innerHTML = `
    <div class="pill">
    <label><input type="checkbox" data-field="enabled"> ${escapeHTML(game.i18n.localize("MoshQoL.Cyberware.Label"))}</label>
    <label>${escapeHTML(game.i18n.localize("MoshQoL.Cyberware.Slots"))} <input type="number" data-field="slots" min="0" max="9" step="1" inputmode="numeric"></label>
    <input type="text" data-field="notes" aria-label="${notesLabel}" placeholder="${notesLabel}">
    </div>`;
  for (const input of row.querySelectorAll("input")) {
    if (input.type === "checkbox") input.checked = cyberware.enabled;
    else input.value = cyberware[input.dataset.field];
    input.disabled = !sheet.isEditable;
  }
  // Persistent item controls belong above the tab navigation.
  tabs.before(row);
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
      await item.update({ [`${FLAG_PATH}.${field}`]: value });
    } catch (error) {
      console.error(`${MODULE_ID} | Cyberware update failed`, error);
      ui.notifications.error(game.i18n.localize("MoshQoL.Cyberware.SaveError"));
      sheet.render(false);
    }
  });
}

function renderCyberwareStatus(sheet, html) {
  const root = html?.[0] ?? html;
  if (!root) return;
  const existing = root.querySelector(`.${STATUS_CLASS}`);
  if (!game.settings.get(MODULE_ID, SETTING_ENABLE_CYBERWARE) || getSheetKind(sheet) !== "character") {
    existing?.remove();
    return;
  }
  const tabs = root.querySelector(".sheet-tabs");
  if (!tabs) return;
  const status = existing ?? document.createElement("div");
  status.className = qolClassName(STATUS_CLASS);
  status.style.setProperty("--theme-color", getThemeColor());
  const totals = calculateCyberwareSlots(sheet.actor);
  const items = document.createElement("div");
  items.className = ITEMS_CLASS;
  for (const item of getCyberwareItems(sheet.actor)) {
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
    ? "MoshQoL.Cyberware.Overclocking" : "MoshQoL.Cyberware.Usage", totals);
  status.replaceChildren(items, label);
  if (!existing) tabs.before(status);
}

function refreshCyberwareStatus(actor) {
  if (actor?.type !== "character") return;
  for (const sheet of Object.values(actor.apps ?? {})) {
    if (sheet.rendered) renderCyberwareStatus(sheet, sheet.element);
  }
}

export function refreshOpenCyberwareSheets() {
  for (const sheet of Object.values(ui.windows)) {
    if (!sheet.rendered) continue;
    if (sheet.item) renderCyberwareItem(sheet, sheet.element);
    else if (sheet.actor) renderCyberwareStatus(sheet, sheet.element);
  }
}

export function registerCyberwareHooks() {
  if (registered) return;
  registered = true;
  Hooks.on("renderMothershipItemSheet", renderCyberwareItem);
  Hooks.on("renderActorSheet", renderCyberwareStatus);
  Hooks.on("updateActor", refreshCyberwareStatus);
  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, item => refreshCyberwareStatus(item.parent));
  }
}
