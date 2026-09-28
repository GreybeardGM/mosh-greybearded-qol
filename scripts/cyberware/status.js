import { qolClassName } from "../codex/constants.js";
import { AUGMENTATION_DEFINITIONS } from "./config.js";
import { calculateAugmentationState } from "./slots.js";

export const AUGMENTATION_STATUS_CLASS = "qol-augmentation-status";
export const AUGMENTATION_ITEMS_CLASS = "qol-augmentation-items";
export const OVERCLOCKING_TRIGGER_CLASS = "qol-overclocking-trigger";

export function getOverclockingLevelStates(total) {
  return [1, 2, 3, 4, 5].map(level => ({ level, active: level <= total }));
}

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
      actionClass: selected ? OVERCLOCKING_TRIGGER_CLASS : "",
      title: selected ? game.i18n.localize("MoshQoL.Cyberware.OverclockDialog.Open") : "",
      label: game.i18n.format(selected
        ? `${definition.localization}.Overclocking` : `${definition.localization}.Usage`, {
        ...totals,
        overclocking: state.overclocking
      })
    }];
  });
}
