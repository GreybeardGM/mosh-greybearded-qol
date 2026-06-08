import { FLAG_CHARACTER_CREATION, MODULE_ID } from "../codex/constants.js";

// progress.js – Fortschrittsverwaltung für den Charaktergenerator

/**
 * Setzt alle Fortschrittsinformationen zurück.
 */
export async function reset(actor) {
  return actor.unsetFlag(MODULE_ID, FLAG_CHARACTER_CREATION);
}

/**
 * Markiert einen Schritt als abgeschlossen, inklusive Zeitstempel.
 */
export async function completeStep(actor, key, extra = {}) {
  const path = `${FLAG_CHARACTER_CREATION}.${key}`;
  const data = {
    completed: true,
    timestamp: new Date().toISOString(),
    ...extra
  };
  return actor.setFlag(MODULE_ID, path, data);
}

/**
 * Prüft, ob ein bestimmter Schritt bereits abgeschlossen ist.
 */
export function checkStep(actor, key) {
  return actor.getFlag(MODULE_ID, `${FLAG_CHARACTER_CREATION}.${key}`)?.completed === true;
}

/**
 * Prüft, ob der Charakter bereit für den Generator ist.
 */
export function checkReady(actor) {
  return actor.getFlag(MODULE_ID, `${FLAG_CHARACTER_CREATION}.ready`) === true;
}

/**
 * Setzt den Charakter auf bereit oder nicht bereit.
 */
export async function setReady(actor, state = true) {
  return actor.setFlag(MODULE_ID, `${FLAG_CHARACTER_CREATION}.ready`, state);
}

/**
 * Prüft, ob der gesamte Ersteller abgeschlossen ist.
 */
export function checkCompleted(actor) {
  return actor.getFlag(MODULE_ID, `${FLAG_CHARACTER_CREATION}.completed`) === true;
}

/**
 * Markiert den gesamten Ersteller als abgeschlossen.
 */
export async function setCompleted(actor, state = true) {
  return actor.setFlag(MODULE_ID, `${FLAG_CHARACTER_CREATION}.completed`, state);
}
