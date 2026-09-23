import { qolClassName } from "../codex/constants.js";
import { AUGMENTATION_DEFINITIONS } from "./config.js";
import { calculateAugmentationState } from "./slots.js";

export const AUGMENTATION_STATUS_CLASS = "qol-augmentation-status";
export const AUGMENTATION_ITEMS_CLASS = "qol-augmentation-items";

export function getAugmentationStatusRows(actor) {
  const state = calculateAugmentationState(actor, { includeItems: true });
  return AUGMENTATION_DEFINITIONS.flatMap(definition => {
    const totals = state[definition.id];
    if (!totals.items.length) return [];
    const selected = totals.overclocking > 0;
    return [{
      className: qolClassName(AUGMENTATION_STATUS_CLASS, `qol-${definition.id}-status`),
      itemsClassName: AUGMENTATION_ITEMS_CLASS,
      items: totals.items.map(item => ({ id: item.id, name: item.name, document: item })),
      selected,
      label: game.i18n.format(selected
        ? `${definition.localization}.Overclocking` : `${definition.localization}.Usage`, {
        ...totals,
        overclocking: state.overclocking
      })
    }];
  });
}
