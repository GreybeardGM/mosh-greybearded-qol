/**
 * Extracts the first valid damage roll embedded in a chat message's HTML content.
 *
 * Damage rolls are expected in Foundry inline roll elements with a percent-encoded
 * JSON roll payload in their `data-roll` attribute. If a Mothership wound effect is
 * present in the same message, it is attached as metadata for later application.
 *
 * @param {object} message Foundry chat message-like object.
 * @returns {{ total: number, formula: string|undefined, rollData: object, woundType?: string, woundRollModifier?: "advantage"|"disadvantage" } | null}
 */
export function extractDamageRollFromMessageContent(message) {
  const content = message?.content;
  if (typeof content !== "string" || content.length === 0) return null;

  for (const encodedRoll of findEncodedRolls(content)) {
    const rollData = parseEncodedRollData(encodedRoll);
    if (!rollData || !isDamageRoll(rollData)) continue;

    const total = rollData.total;
    if (!Number.isInteger(total) || total <= 0) continue;

    return {
      total,
      formula: rollData.formula,
      rollData,
      ...extractWoundEffectFromMessageContent(message)
    };
  }

  return null;
}

function findEncodedRolls(content) {
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = content;
    return [...wrapper.querySelectorAll(".inline-roll[data-roll], .inline-result[data-roll]")]
      .map((element) => element.dataset.roll);
  }

  return findEncodedRollsWithRegex(content);
}

function findEncodedRollsWithRegex(content) {
  const rolls = [];
  const elementPattern = /<[^>]*(?:inline-roll|inline-result)[^>]*>/gi;
  let match;

  while ((match = elementPattern.exec(content)) !== null) {
    const dataRoll = match[0].match(/\sdata-roll\s*=\s*(["'])(.*?)\1/i);
    if (dataRoll) rolls.push(decodeHtmlAttribute(dataRoll[2]));
  }

  return rolls;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#x22;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function parseEncodedRollData(encodedRoll) {
  if (typeof encodedRoll !== "string" || encodedRoll.length === 0) return null;

  try {
    return JSON.parse(decodeURIComponent(encodedRoll));
  } catch (error) {
    return null;
  }
}

function isDamageRoll(rollData) {
  if (typeof rollData?.formula === "string" && rollData.formula.includes("[damage]")) return true;

  return Array.isArray(rollData?.terms)
    && rollData.terms.some((term) => term?.options?.flavor === "damage");
}


/**
 * Extracts the Mothership wound effect linked in a chat message.
 *
 * Supported examples:
 * - Gunshot [+] -> { woundType: "Gunshot", woundRollModifier: "advantage" }
 * - Gunshot [-] -> { woundType: "Gunshot", woundRollModifier: "disadvantage" }
 * - Gunshot     -> { woundType: "Gunshot" }
 *
 * @param {object} message Foundry chat message-like object.
 * @returns {{ woundType?: string, woundRollModifier?: "advantage"|"disadvantage" }}
 */
export function extractWoundEffectFromMessageContent(message) {
  const content = message?.content;
  if (typeof content !== "string" || content.length === 0) return {};

  const woundText = findWoundEffectText(content);
  if (!woundText) return {};

  return parseWoundEffectText(woundText);
}

function findWoundEffectText(content) {
  const uuidWoundEffectText = findWoundEffectTextFromUuidMarkup(content);
  if (uuidWoundEffectText) return uuidWoundEffectText;

  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = content;

    const woundHeader = [...wrapper.querySelectorAll("strong")]
      .find((element) => element.textContent?.trim().toLowerCase() === "wound effect");
    const woundContainer = woundHeader?.parentElement ?? wrapper;
    const woundLink = woundContainer.querySelector(".content-link");
    if (woundLink?.textContent) return woundLink.textContent.trim();

    const fallbackLink = wrapper.querySelector(".content-link");
    return fallbackLink?.textContent?.trim() ?? null;
  }

  return findWoundEffectTextWithRegex(content);
}

/**
 * ChatMessage.content can still contain Foundry's raw rich-text references when
 * this parser runs. In that state, a wound effect looks like
 * `@UUID[...]{Gunshot [+]}` instead of the rendered `.content-link` anchor.
 *
 * If this ever needs to become more defensive, keep this raw-content parser as
 * the first pass and add a later fallback that accepts the rendered chat HTML
 * from the render hook. That fallback should inspect the already enriched DOM for
 * `.content-link` anchors near the Wound Effect header, then pass the anchor text
 * through parseWoundEffectText just like this raw UUID path does.
 */
function findWoundEffectTextFromUuidMarkup(content) {
  const woundEffectIndex = content.search(/<strong[^>]*>\s*Wound Effect\s*<\/strong>/i);
  const searchContent = woundEffectIndex >= 0 ? content.slice(woundEffectIndex) : content;
  const uuidMatch = searchContent.match(/@UUID\[[^\]]+\]\{([^}]+)\}/i);
  if (!uuidMatch) return null;

  return decodeHtmlAttribute(stripHtml(uuidMatch[1])).trim();
}

function findWoundEffectTextWithRegex(content) {
  const woundEffectIndex = content.search(/<strong[^>]*>\s*Wound Effect\s*<\/strong>/i);
  const searchContent = woundEffectIndex >= 0 ? content.slice(woundEffectIndex) : content;
  const linkMatch = searchContent.match(/<a\b[^>]*class=(?:["'][^"']*content-link[^"']*["'])[^>]*>([\s\S]*?)<\/a>/i)
    ?? searchContent.match(/<a\b[^>]*class=(?:[^\s>]*\s)?content-link(?:\s[^>]*)?[^>]*>([\s\S]*?)<\/a>/i);
  if (!linkMatch) return null;

  return stripHtml(decodeHtmlAttribute(linkMatch[1])).trim();
}

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, "");
}

function parseWoundEffectText(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return {};

  const modifierMatch = cleaned.match(/\[\s*([+-])\s*\]\s*$/);
  const woundType = cleaned.replace(/\s*\[\s*[+-]\s*\]\s*$/, "").trim();
  if (!woundType) return {};

  const result = { woundType };
  if (modifierMatch?.[1] === "+") result.woundRollModifier = "advantage";
  if (modifierMatch?.[1] === "-") result.woundRollModifier = "disadvantage";

  return result;
}
