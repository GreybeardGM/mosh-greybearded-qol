export function getAppRoot(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

export function resolveAppOnce(app, value) {
  if (app._resolved) return;
  app._resolved = true;
  app._resolve?.(value);
}
