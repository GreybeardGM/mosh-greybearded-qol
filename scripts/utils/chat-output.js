import { qolClassName, templatePath } from "../codex/constants.js";
import { getThemeColor } from "./get-theme-color.js";
import { escapeHTML, sanitizeClassList, sanitizeDataAction } from "./html-safety.js";

const CHAT_HTML_BRAND = Symbol("mosh-qol-chat-html");

/**
 * Chat output contract:
 * - `blocks` is the API for standard layouts (text, highlights, counters, lists, separators).
 * - `rawChatHTML(html)` is only for HTML already enriched by Foundry or another trusted source.
 * - New call sites should pass data via `blocks` instead of building HTML strings.
 */
export function rawChatHTML(html = "") {
  return {
    [CHAT_HTML_BRAND]: true,
    html: String(html ?? "")
  };
}

function isChatHTML(value) {
  return value?.[CHAT_HTML_BRAND] === true;
}

function normalizeTextBlock(block = {}) {
  return {
    type: "text",
    text: escapeHTML(block.text)
  };
}

function normalizeHtmlBlock(block = {}) {
  return {
    type: "html",
    html: isChatHTML(block.html) ? block.html.html : ""
  };
}

function normalizeSuffix(value) {
  if (value === null || value === undefined) return "";
  return isChatHTML(value) ? value.html : escapeHTML(value);
}

function normalizeHighlightBlock(block = {}) {
  return {
    type: "highlight",
    label: escapeHTML(block.label),
    value: escapeHTML(block.value)
  };
}

function normalizeCounterBlock(block = {}) {
  return {
    type: "counter",
    value: escapeHTML(block.value),
    label: escapeHTML(block.label),
    suffix: normalizeSuffix(block.suffix)
  };
}

function normalizeItem(item = {}) {
  return {
    name: escapeHTML(item.name),
    img: escapeHTML(item.img),
    subtitle: escapeHTML(item.subtitle),
    quantity: item.quantity === null || item.quantity === undefined ? "" : escapeHTML(item.quantity)
  };
}

function normalizeItemListBlock(block = {}) {
  const items = Array.isArray(block.items) ? block.items.map(normalizeItem) : [];

  return {
    type: "itemList",
    title: escapeHTML(block.title),
    items,
    compact: block.compact === true,
    nowrap: block.nowrap === true
  };
}

function normalizeCounterListItem(item = {}) {
  return {
    label: escapeHTML(item.label),
    value: escapeHTML(item.value)
  };
}

function normalizeCounterColumnsBlock(block = {}) {
  const columns = Array.isArray(block.columns)
    ? block.columns.map(column => ({
      title: escapeHTML(column.title),
      items: Array.isArray(column.items) ? column.items.map(normalizeCounterListItem) : []
    }))
    : [];

  return {
    type: "counterColumns",
    columns
  };
}

function normalizeTrustedHtmlOrText(value) {
  if (isChatHTML(value)) {
    return { html: value.html, text: "" };
  }

  return { html: "", text: escapeHTML(value) };
}

function normalizeAutomatedWoundEntry(entry = {}) {
  return {
    rollLabel: escapeHTML(entry.rollLabel),
    rolls: Array.isArray(entry.rolls) ? entry.rolls.map(normalizeTrustedHtmlOrText) : [],
    results: Array.isArray(entry.results) ? entry.results.map(normalizeTrustedHtmlOrText) : []
  };
}

function normalizeAutomatedWoundsBlock(block = {}) {
  return {
    type: "automatedWounds",
    entries: Array.isArray(block.entries) ? block.entries.map(normalizeAutomatedWoundEntry) : []
  };
}

function normalizeBlock(block = {}) {
  switch (block.type) {
    case "html": return normalizeHtmlBlock(block);
    case "highlight": return normalizeHighlightBlock(block);
    case "counter": return normalizeCounterBlock(block);
    case "itemList": return normalizeItemListBlock(block);
    case "counterColumns": return normalizeCounterColumnsBlock(block);
    case "automatedWounds": return normalizeAutomatedWoundsBlock(block);
    case "separator": return { type: "separator" };
    case "text":
    default: return normalizeTextBlock(block);
  }
}

function normalizeBlocks(blocks) {
  return Array.isArray(blocks) ? blocks.map(normalizeBlock) : [];
}

function prepareButton(button = {}) {
  const args = Array.isArray(button.args) ? button.args : [];

  return {
    icon: sanitizeClassList(button.icon || "fa-dice", { fallback: "fa-dice" }),
    action: escapeHTML(sanitizeDataAction(button.action)),
    args: escapeHTML(JSON.stringify(args)),
    label: escapeHTML(button.label)
  };
}

export async function chatOutput({
  actor,
  title = "Untitled",
  subtitle = "",
  blocks = [],
  icon = null,
  image = null,
  roll = null,
  buttons = []
} = {}) {
  // Fallback actor
  actor = actor || game.user.character;
  if (!actor) return ui.notifications.warn(game.i18n.localize("MoshQoL.Chat.NoActor"));

  // Normalize icon: if image is given, drop icon completely
  if (image) {
    icon = null;
  } else if (!icon && title) {
    const normalizedTitle = String(title);
    icon = `fa-${normalizedTitle.charAt(0).toLowerCase()}`;
    title = normalizedTitle.slice(1);
  }

  // Prepare HTML via template. The template intentionally uses triple-stash only
  // for fields escaped or explicitly marked as trusted by this module.
  const html = await foundry.applications.handlebars.renderTemplate(templatePath("ui/chat-output.html"), {
    actor,
    title: escapeHTML(title),
    subtitle: escapeHTML(subtitle),
    blocks: normalizeBlocks(blocks),
    icon: sanitizeClassList(icon),
    image: escapeHTML(image),
    buttons: Array.isArray(buttons) ? buttons.map(prepareButton) : [],
    themeColor: escapeHTML(getThemeColor()),
    classes: escapeHTML(qolClassName())
  });

  if (roll instanceof Roll) {
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: html
    });
  }

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html
  });
}
