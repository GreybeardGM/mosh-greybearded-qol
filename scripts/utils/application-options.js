import { qolWindowClasses } from "../codex/constants.js";
import { getThemeColor } from "./get-theme-color.js";

function normalizeClassList(classes) {
  if (Array.isArray(classes)) return classes;
  return classes ? [classes] : [];
}

export function createQolAppDefaultOptions({
  id,
  title,
  windowClasses = [],
  window = {},
  position = {},
  form = null,
  actions = null
}) {
  const options = {
    id,
    tag: "form",
    window: {
      title,
      contentClasses: qolWindowClasses(...normalizeClassList(windowClasses)),
      resizable: false,
      ...window
    },
    position: {
      width: "auto",
      height: "auto",
      ...position
    }
  };

  if (form) {
    options.form = {
      submitOnChange: false,
      closeOnSubmit: true,
      ...form
    };
  }

  if (actions) options.actions = actions;

  return options;
}

export function appendQolThemeContext(context) {
  return {
    ...context,
    themeColor: getThemeColor()
  };
}
