/**
 * Berechnet ausschließlich die HP-/Wunden-Auswirkung von bereits reduzierten
 * Schaden (`remaining`). Foundry-Actor-Updates, Rüstung, Chat und Wundwürfe
 * bleiben absichtlich außerhalb dieser Funktion, damit die Regelrechnung isoliert
 * prüfbar bleibt.
 */
export function calculateDamageOutcome({ hp, hpMax, hits, hitsMax, remaining }) {
  let woundsGained = 0;

  // Kein Schaden oder keine verfügbare Wunden-Kapazität: Zustand unverändert lassen.
  // `remaining` wird bewusst zurückgegeben, damit Aufrufer sehen können, ob Schaden
  // wegen maximaler Wunden nicht mehr vollständig verarbeitet werden konnte.
  if (remaining <= 0 || hits >= hitsMax) {
    return { hp, hits, remaining, woundsGained };
  }

  // Sicherheitsfall für Actors ohne sinnvolles HP-Maximum. Ohne diesen Guard würde
  // die Schleife bei hpMax <= 0 nie Restschaden abbauen können. Die alte Apply-
  // Damage-Logik erzeugte in diesem Fall genau eine Wunde und stoppte danach.
  if (hpMax <= 0) {
    return {
      hp,
      hits: hits + 1,
      remaining: 0,
      woundsGained: 1
    };
  }

  // Mothership-Schadensfluss:
  // 1. Schaden wird zuerst auf die aktuellen HP angewendet.
  // 2. Sobald die aktuellen HP aufgebraucht sind, entsteht genau eine Wunde.
  // 3. Nach der Wunde werden die HP auf hpMax zurückgesetzt.
  // 4. Nur tatsächlich verbleibender Schaden läuft danach gegen die neuen HP weiter.
  //
  // Wichtig: Restschaden darf NICHT direkt per Math.ceil(remaining / hpMax) in
  // weitere Wunden umgerechnet werden. Bei 4 HP und 5 Schaden entsteht eine Wunde
  // und 1 Restschaden senkt die zurückgesetzten HP auf 3; es entstehen nicht zwei
  // Wunden.
  while (remaining > 0 && hits < hitsMax) {
    if (hp > 0 && remaining < hp) {
      hp -= remaining;
      remaining = 0;
      break;
    }

    if (hp > 0) {
      remaining -= hp;
    }

    hits += 1;
    woundsGained += 1;
    hp = hpMax;
  }

  return { hp, hits, remaining, woundsGained };
}
