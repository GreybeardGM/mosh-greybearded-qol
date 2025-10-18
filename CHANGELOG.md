# Changelog

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
