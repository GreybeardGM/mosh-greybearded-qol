import { templatePath } from "../codex/constants.js";
import { appendQolThemeContext, createQolAppDefaultOptions } from "../utils/application-options.js";

export function createSettingsAppDefaultOptions({
  id,
  title,
  submitHandler,
  resetDefaultsHandler,
  width = 550,
  height = "auto"
}) {
  return createQolAppDefaultOptions({
    id,
    title,
    windowClasses: "qolsettings-window",
    window: {
      resizable: true
    },
    position: {
      width,
      height
    },
    form: {
      handler: submitHandler
    },
    actions: {
      resetDefaults: resetDefaultsHandler
    }
  });
}

export function createSettingsAppParts(relativeTemplatePath) {
  return {
    form: {
      template: templatePath(relativeTemplatePath)
    }
  };
}

export function appendThemeColor(context) {
  return appendQolThemeContext(context);
}

export function notifyLocalized(type, localizationKey) {
  ui.notifications[type](game.i18n.localize(localizationKey));
}

export async function saveSettingAndClose(app, moduleId, settingKey, value) {
  await game.settings.set(moduleId, settingKey, value);
  app.close();
}

export async function resetSettingToDefaults(app, event, { moduleId, settingKey, defaults }) {
  event.preventDefault();
  await game.settings.set(moduleId, settingKey, defaults());
  app.render();
}
