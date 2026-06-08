import { templatePath } from "../codex/constants.js";
import { getThemeColor } from "../utils/get-theme-color.js";

const SETTINGS_WINDOW_CLASSES = ["greybeardqol", "qol-ui", "qolsettings-window"];

export function createSettingsAppDefaultOptions({
  id,
  title,
  submitHandler,
  resetDefaultsHandler,
  width = 550,
  height = "auto"
}) {
  return {
    id,
    tag: "form",
    window: {
      title,
      contentClasses: [...SETTINGS_WINDOW_CLASSES],
      resizable: true
    },
    position: {
      width,
      height
    },
    form: {
      handler: submitHandler,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      resetDefaults: resetDefaultsHandler
    }
  };
}

export function createSettingsAppParts(relativeTemplatePath) {
  return {
    form: {
      template: templatePath(relativeTemplatePath)
    }
  };
}

export function appendThemeColor(context) {
  return {
    ...context,
    themeColor: getThemeColor()
  };
}

export function notifyLocalized(type, localizationKey) {
  ui.notifications[type](game.i18n.localize(localizationKey));
}

export async function setSettingAndNotify(moduleId, settingKey, value, notificationKey) {
  await game.settings.set(moduleId, settingKey, value);
  notifyLocalized("info", notificationKey);
}

export async function resetSettingToDefaults(app, event, { moduleId, settingKey, defaults, notificationKey }) {
  event.preventDefault();
  await game.settings.set(moduleId, settingKey, defaults());
  app.render();
  notifyLocalized("info", notificationKey);
}
