# Changelog

## [0.8.1-dev] - 2026-05-22
### Added
- Simple Shore Leave now includes a Pay-Up button to automatically deduct credits.
- Training tool updates: training can now use the Skill Training field on the character sheet, and preliminary auto-training is available when explicitly enabled in the settings.

### Changed
- Removed redundant or excessive UI notifications where visible window, sheet, or highlighted UI changes already provide clear feedback.
- Simple Shore Leave roll output was updated for easier price reading.
- General CSS was cleaned up and styling is now more clearly split into scoped areas.
- Setting forms were polished and unified for a consistent layout.
- Apply Damage dialog was overhauled and now allows deselecting accidentally selected tokens.
- Multiple safeguards were added to prevent creature/player stats from leaking into stash sheets or contractors.

### Fixed
- Adjusted unfavorable viewport sizing for small monitors so the Skill Selector should now remain fully visible for everyone.
- Fixed a bug in Shore Leave tier migration.
- Apply Damage now deduplicates duplicate actor entries so multiple tokens of the same actor are not damaged twice.
- Armor Broken auto-arbitration was reworked and now applies status only to valid actors.

### Notes
- Some users may need to reset Shore Leave tiers to default once so tiers become visible again.
- Sorry for the inconvenience; hopefully no custom tiers were lost.

### Performance
- Automatic wound rolling now runs in bundled batches for much faster execution.
- Various additional small performance upgrades.

## [0.8.0] - 2026-05-22
### Added
- Added German localization for the module.
- New Apply Damage feature added: damage rolls are now detected automatically and can be applied via a chat button; Apply Damage behavior is freely configurable in settings.

### Changed
- The QoL Toolband is now freely configurable.
- Shore Leave settings have been grouped into a new menu for better overview.
- Prepared the next development version; details will be expanded before release.
- Various performance upgrades completed, including a refactor of the item loader for faster loading and a restructuring of settings for better overview.

## [0.7.3] - 2026-05-07
### Improvements
- Contractor promotion now only sets the essential flags (`isNamed`, `loyalty.enabled`), and loyalty rolls also enable the loyalty flag automatically.
- Crew Roster can now also be opened from the shared Stash Sheet, so groups without their own ship still have central roster access.
- Contractor rows in Crew Roster now include an optional Hazard Pay field (0–10) that is stored per roster entry alongside UUID and active status.
- Crew Roster summary now shows Total Hazard Pay (`Salary × Hazard Pay`) across all contractors, displayed in kcr.
- Currency display was updated with an additional overlay to better safeguard values.
- Currency parsing was improved to accept `k`, `m`, and `g` as shorthand for thousand, million, and billion.
- General code improvements and cleanup across the module.

## [0.7.2] - 2026-02-11
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
