# Changelog

## [0.6.6] - 2025-xx-xx
### Added
- Armor Broken Status Effect
  Includes minimalistic SVG for armor-broken status and toolband toggle button.

### Improvements
- Better toolband styling
  Toolband buttons are made smaller not to block other sheet components.
  Bottons grow when hovered.
- Better item loading handler
  Items (like classes and skills) are now handled with a new item loader.
  The loader will load from all compendiums and the world's item collection.
  Items with the same name are filtered out with the priority on custom items:
    1. World items
    2. Custom compendium items
    3. PSG compendium items
  
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
