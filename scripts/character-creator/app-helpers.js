export function getAppRoot(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

export function applyAppWrapperLayout(root, { width = null, maxWidth = "95vw", margin = "0 auto" } = {}) {
  if (!root) return;

  const wrapper = root.closest(".app");
  if (!wrapper) return;

  if (width !== null) wrapper.style.width = width;
  if (maxWidth !== null) wrapper.style.maxWidth = maxWidth;
  if (margin !== null) wrapper.style.margin = margin;
}


export function resolveAppOnce(app, value) {
  if (app._resolved) return;
  app._resolved = true;
  app._resolve?.(value);
}
