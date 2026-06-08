# Repo-Regeln

## Änderungen schlank halten

- Vor neuen Helfern zuerst `scripts/utils/`, `scripts/codex/`, `scripts/settings/settings-app-helpers.js` und feature-lokale Utilities auf bestehende Funktionen prüfen.
- Neue Konstanten zuerst in bestehende Codex- oder Feature-Konstanten einsortieren, statt unnötig neue Ablageorte anzulegen.
- Keine Helfer für Code extrahieren, der nur einmal genutzt wird, außer der Helfer kapselt eine klare Fachregel.
- Refactors sollen Zeilen reduzieren oder Duplikate entfernen. Wenn Zeilen steigen, muss die Begründung im PR stehen.
- Bei UI-Klassen, Setting-Keys, Feature-Actions und Modulpfaden keine String-Literale duplizieren; zentralisieren und wiederverwenden.

## `scripts/codex/`-Projektkonvention

`scripts/codex/` ist für kleine modulweite Registries und Integrationswerte reserviert, die featureübergreifend geteilt werden. Feature-spezifische Tabellen, Defaults und Helfer liegen beim verantwortlichen Feature, auch wenn Settings oder Migrationen sie zusätzlich importieren. Echte wiederverwendbare Implementierungshelfer gehören nach `scripts/utils/`.

Aktuelle `scripts/codex/`-Inventarisierung:

| File | Kategorie | Konvention |
| --- | --- | --- |
| `constants.js` | Zentrale Konstanten | Nur Modul-IDs, Setting-Keys, Flags, gemeinsame CSS-Klassen und Pfad-Builder. |
| `feature-actions.js` | Zentrale Konstanten | Gemeinsame Feature-Action-Metadaten für mehrere UI-Einstiegspunkte. |
| `mosh-system.js` | System-Integrationswerte | Mothership-System-/Modul-IDs, Kompendiumskennungen, Fallback-Bilder und Item-Typ-Listen. |
| `toolband-buttons.js` | Feature-Daten | Toolband-Button-/Scope-Registry plus Lookup-Helfer; bleibt hier, solange Settings und Runtime-Toolband-Code sie gemeinsam nutzen. |

Ablagebeispiele außerhalb von `scripts/codex/`:

- Apply-Damage-eigene Defaults und Lookup-Daten liegen in `scripts/apply-damage/` (`config.js`, `target-logic.js`, `armor-cover.js`, `wound-types.js`).
- Shore-Leave-Tabellen liegen in `scripts/shore-leave/` (`default-activities.js`, `default-tiers.js`).
- Ship-Crit-Tabellen liegen in `scripts/ship-crits/` (`default-crits-0e.js`).
- Reine Contractor-Sheet-Tabellen liegen in `scripts/sheets/` (`contractor-motivation-table.js`).
- Echte wiederverwendbare Helfer, z. B. Skill-Sortierung, liegen in `scripts/utils/` (`skill-sort.js`).

Neue Foundry-`ApplicationV2`-UI-Komponenten müssen die gemeinsamen QoL-Basisklassen aus `QOL_UI_CLASSES` in `scripts/codex/constants.js` nutzen; für `window.contentClasses` bevorzugt `qolWindowClasses(...)` und für zusammengesetzte `className`-Strings `qolClassName(...)` verwenden.

## Entwickler-Checkliste vor neuen Implementierungen

- Bestehende Helfer in `scripts/utils/`, `scripts/codex/`, `scripts/settings/` und feature-lokalen Utilities suchen, bevor neuer Implementierungscode ergänzt wird.
- Keine neue Konstante einführen, wenn ein kanonischer Wert bereits in `scripts/codex/constants.js` oder bestehenden Feature-Konstanten existiert.
- Keinen neuen Helfer ergänzen, wenn er nur einmal genutzt wird und keine klare Fachregel kapselt.
- Kein Inline-HTML für Chat-Ausgaben verwenden, wenn `chatOutput`-Blöcke aus `scripts/utils/chat-output.js` ausreichen.
- Neue Template-Pfade nicht manuell bauen, wenn `templatePath()` aus `scripts/codex/constants.js` ausreicht.
- Bestehende Normalisierungs-, HTML-Sicherheits-, Chat-Output- und Settings-Helfer aus `scripts/utils/normalization.js`, `scripts/utils/html-safety.js`, `scripts/utils/chat-output.js` und `scripts/settings/settings-app-helpers.js` bevorzugen.
- Review-Frage: Hat diese Änderung netto Komplexität entfernt oder nur verschoben?

## PR-Checkliste

- Habe ich bestehende Helfer genutzt?
- Habe ich neue String-Literale zentralisiert?
- Ist ein neuer Helper mindestens zweimal genutzt, außer er kapselt eine klare Fachregel?
- Wenn ein Refactor Zeilen erhöht: Ist die Begründung im PR enthalten?
