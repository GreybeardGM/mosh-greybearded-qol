// progress.js – Fortschrittsverwaltung für den Charaktergenerator

/**
 * Setzt alle Fortschrittsinformationen zurück.
 */
export async function reset(actor) {
  return actor.unsetFlag("world", "greybeardCharacterCreation");
}

/**
 * Markiert einen Schritt als abgeschlossen, inklusive Zeitstempel.
 */
export async function completeStep(actor, key, extra = {}) {
  const path = `greybeardCharacterCreation.${key}`;
  const data = {
    completed: true,
    timestamp: new Date().toISOString(),
    ...extra
  };
  return actor.setFlag("world", path, data);
}

/**
 * Prüft, ob ein bestimmter Schritt bereits abgeschlossen ist.
 */
export function checkStep(actor, key) {
  return actor.getFlag("world", `greybeardCharacterCreation.${key}`)?.completed === true;
}

/**
 * Prüft, ob der Charakter bereit für den Generator ist.
 */
export function checkReady(actor) {
  return actor.getFlag("world", "greybeardCharacterCreation.ready") === true;
}

/**
 * Setzt den Charakter auf bereit oder nicht bereit.
 */
export async function setReady(actor, state = true) {
  return actor.setFlag("world", "greybeardCharacterCreation.ready", state);
}

/**
 * Prüft, ob der gesamte Ersteller abgeschlossen ist.
 */
export function checkCompleted(actor) {
  return actor.getFlag("world", "greybeardCharacterCreation.completed") === true;
}

/**
 * Markiert den gesamten Ersteller als abgeschlossen.
 */
export async function setCompleted(actor, state = true) {
  return actor.setFlag("world", "greybeardCharacterCreation.completed", state);
}
