/**
 * Extracts the first valid damage roll embedded in a chat message's HTML content.
 *
 * Damage rolls are expected in Foundry inline roll elements with a percent-encoded
 * JSON roll payload in their `data-roll` attribute.
 *
 * @param {object} message Foundry chat message-like object.
 * @returns {{ total: number, formula: string|undefined, rollData: object } | null}
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
      rollData
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
