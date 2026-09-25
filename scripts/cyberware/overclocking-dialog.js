import { MODULE_ID, templatePath } from "../codex/constants.js";
import { appendQolThemeContext, createQolAppDefaultOptions } from "../utils/application-options.js";
import { calculateAugmentationState } from "./slots.js";
import { getOverclockingLevelStates } from "./status.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class OverclockingDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = createQolAppDefaultOptions({
    id: "qol-overclocking-dialog",
    title: "MoshQoL.Cyberware.OverclockDialog.Title",
    windowClasses: "qol-overclocking-dialog",
    position: { width: 560 }
  });

  static PARTS = { form: { template: templatePath("cyberware/overclocking-dialog.html") } };

  constructor(actor, options = {}) {
    super({ ...options, id: `${MODULE_ID}-overclocking-${actor.id}` });
    this.actor = actor;
  }

  async _prepareContext() {
    const state = calculateAugmentationState(this.actor);
    return appendQolThemeContext({
      summary: game.i18n.format("MoshQoL.Cyberware.OverclockDialog.Summary", {
        total: state.overclocking,
        cyberware: state.cyberware.overclocking,
        slickware: state.slickware.overclocking
      }),
      levels: getOverclockingLevelStates(state.overclocking).map(({ level, active }) => ({
        level, active,
        effect: game.i18n.localize(`MoshQoL.Cyberware.OverclockDialog.Levels.${level}`)
      }))
    });
  }
}

export function openOverclockingDialog(actor) {
  if (calculateAugmentationState(actor).overclocking <= 0) return;
  const id = `${MODULE_ID}-overclocking-${actor.id}`;
  const open = Object.values(ui.windows).find(app => app.id === id);
  if (open) open.render(true);
  else new OverclockingDialog(actor).render(true);
}
