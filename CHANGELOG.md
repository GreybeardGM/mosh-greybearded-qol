# Changelog

## [0.7.2] - TBD
### Added
- Ship Sheet Crew Roster for tracking active player characters, active contractors, and active auxiliary craft.
- Skill Training tool that opens the QoL Generator skill tree to add a new skill to a character.

### Improvements
- Crew Roster workflow foundation added; additional functionality is still work in progress.

## [0.7.1] - 2026-02-10
### Improvements
- Upgraded the Contractor sheet with a dedicated Skills tab.
- Patched creature and contractor skill-roll attribute selection (`chooseAttribute`) to use a custom dialog template and list active creature attributes.

## [0.7.0] - 2026-02-09
### Added
- Zero-max `z` die modifier for zero-based results and min/max styling (including support for `1d100z` rolls).

### Improvements
- Localization expanded across Shore Leave and Character Creator (templates, dialogs, notifications, and chat output), with English i18n keys structured for easier maintenance.
- Performance improvements for item loading and lookup flows.
- Better runtime efficiency in theme color resolution and skill selection prep.
- Character Creator: Option groups can now use their contained default skills.

## [0.6.7] - 2025-11-13
### Hotfix
- Fixed issue with the skill selector.

## [0.6.6] - 2025-11-06
### Added
- Armor Broken Status Effect  
  Includes minimalistic SVG for armor-broken status and toolband toggle button.  
  Toggle button in the toolband to switch as well as show status.

### Improvements
- Better toolband styling  
  Toolband buttons are made smaller so they do no longer to block other sheet components.  
  Bottons grow when hovered.
- Better item loading 
  Items (like classes and skills) are now handled with a new item loader.  
  The loader will load from all compendiums and the world's item collection.  
  Items with the same name are filtered out with the priority on custom items:  
  World items > Custom compendium items > PSG compendium items  
  If you want acces to both (e.G. PSG and custom variants) give your items distinct names.

## [0.6.5] - 2025-10-29
### Fixed
- Fixed scene control button
- Some minor fixes

## [0.6.4] - 2025-10-29
### Updated
- Various updates for Foundry VTT v13 compatibility.
- Moved Header Buttons to QoL-Toolband
- Moved Context Menu Extention to QoL Toolbar

### Added
- QoL-Toolband: QoL button selection added to sheets wherever applicable.
- Apply Damage tool, includes
  - QoL-Toolband button
  - Scene control button
  - Helper for macros etc.

## [0.6.2] - 2025-10-18
### Updated
- Various updates for Foundry VTT v13 compatibility.
- MAY NO LONGER RUN ON V12

### Added
- Contractor promotion dailogue

### Fixed
- Formatting of items in the Loadout Roll chat output
  
## [0.6.1] - 2025-08-18
### Fixed
- 🐛 Fixed a bug where skill point values were stored as strings instead of numbers.  
  This caused incorrect calculations (e.g. `"2" + 0` → `200`).  
  All values are now properly cast to `Number` before summing.

## [0.6.0] - 2025-08-13
### Added
- Initial public release of the module
- QoL Character Generator
- Shore Leave Manager
- Stash Sheet
- Contractor Sheet
- 0e Ship Crits
- Utility Tools
