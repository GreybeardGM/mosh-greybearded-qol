import { getSheetKind } from "../register/sheets.js";
import { CREDIT_STASH, CREDIT_TRANSFER } from "./config.js";

/** Role and access only: malformed balances remain selectable for correction. */
export function getCreditRecipientKind(source, candidate) {
  if (!candidate || candidate.type !== "character" || candidate === source || candidate.id === source?.id
    || game.actors?.get(candidate.id) !== candidate) return null;
  if (getSheetKind(candidate.sheet) === CREDIT_STASH) return candidate.isOwner ? CREDIT_STASH : null;
  return candidate.hasPlayerOwner ? CREDIT_TRANSFER : null;
}

export function getCreditRecipients(source) {
  const recipients = { [CREDIT_STASH]: [], [CREDIT_TRANSFER]: [] };
  // Preserve the world's Actor order: the first eligible entry is preselected.
  for (const candidate of game.actors?.contents ?? []) {
    const kind = getCreditRecipientKind(source, candidate);
    if (kind) recipients[kind].push({ id: candidate.id, name: candidate.name });
  }
  return recipients;
}
