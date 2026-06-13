# MoSh Greybearded QoL

**MoSh Greybearded QoL** is a modular quality-of-life extension for **Foundry VTT** focused on the **Mothership 1e** ruleset.  
It streamlines repetitive workflows for both players and game masters while preserving compatibility with homebrew-heavy tables.

## Highlights

- Structured, guided character generation with integrated compendium support
- Practical table tools for common Mothership workflows
- Lightweight, purpose-built sheet extensions for stash and contractor management
- Independent feature modules that can be enabled as needed

## Feature Overview

### 🧬 QoL Character Generator
- Guided character creation flow: attributes → class → skills → gear → credits
- Homebrew-friendly dialogs and option handling
- Automatic progress persistence during creation
- UUID-safe compendium item integration with fallback behavior
- Interactive skill tree selection

### ⚔️ Apply Damage
- Dedicated helper workflow for applying incoming damage quickly and consistently
- Designed to reduce manual calculation overhead during combat resolution
- Integrates with the module’s UI helpers for faster at-table handling

### 🌴 Shore Leave Manager
- Runs Shore Leave directly from the character sheet
- Supports custom port classes and common house rules
- Includes randomized flavor text for improved session pacing

### 👷 Contractor Sheet
- Extended creature-style sheet for contractor management
- Supports generic setup and progressive upgrades
- Allows loadout rolls from available classes
- Includes a patch for improved creature/contractor skill roll stat selection

### 🎁 Stash Sheet
- Minimal actor sheet type for items and credits
- Suitable for lockers, banks, and shared party storage
- Intentionally excludes stats and rolling logic

### 📋 Ship Crew Roster
- Adds a roster interface to ship sheets
- Tracks active player characters, contractors, and auxiliary craft
- Additional roster capabilities are under active iteration

### 🚀 0e Ship Crits
- Provides a one-click trigger for ship critical damage
- Supports escalation to higher crit levels when required

### 🛡️ Armor Broken Status Effect
- Adds a dedicated status marker for damaged armor state visibility

### ⚙️ Utility Tools
- Theme color customization via CSS variables
- Stress conversion helper
- Skill Training tool (opens the QoL skill tree to add new character skills)
- Zero-max `z` roll modifier support (for example `1d10z`, `1d100z`)

## Version & Compatibility

- **Current module version**: `0.8.1`
- **Verified Foundry version**: `13.351`
- **System**: Mothership 1e (`mosh`)
- **Recommended companion compendium**: `fvtt_mosh_1e_psg`

## Installation

- GitHub repository: <https://github.com/GreybeardGM/mosh-greybearded-qol>  
- Manifest URL: <https://raw.githubusercontent.com/GreybeardGM/mosh-greybearded-qol/refs/tags/0.8.1/module.json>

## Maintainer Notes

Developed and maintained by **GreybeardGM**. The project emphasizes modular design and practical usability for long-running campaigns.

Feedback and feature requests are welcome — but I'm working solo, so no guarantees.

---

**License**: MIT  
**Author**: [GreybeardGM](https://github.com/GreybeardGM)
