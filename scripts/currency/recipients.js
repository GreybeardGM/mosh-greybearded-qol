import { getSheetKind } from "../register/sheets.js";

/** Role and access only: malformed balances remain selectable for correction. */
export function isCreditRecipient(source, candidate) {
  return Boolean(candidate?.type === "character" && candidate.isOwner
    && candidate !== source && candidate.id !== source?.id
    && game.actors?.get(candidate.id) === candidate
    && (candidate.hasPlayerOwner || getSheetKind(candidate.sheet) === "stash"));
}

export function getCreditRecipients(source) {
  // Preserve the world's Actor order: the first eligible entry is preselected.
  return (game.actors?.contents ?? []).filter(candidate => isCreditRecipient(source, candidate))
    .map(candidate => ({ id: candidate.id, name: candidate.name }));
}
