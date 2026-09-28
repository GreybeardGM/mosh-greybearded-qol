/**
 * Builds an executable Foundry content link to a bundled Mothership macro.
 * Only the visible label is localized; translating the document reference caused the original regression.
 */
export function buildMoshMacroReference(uuid, label) {
  return `@UUID[${uuid}]{${label}}`;
}
