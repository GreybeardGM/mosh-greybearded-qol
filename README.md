# MoSh Greybearded QoL

**MoSh Greybearded QoL** is a Foundry VTT module designed to enhance character creation and gameplay for the Mothership 1e system. It offers a suite of quality-of-life improvements tailored for both GMs and players, with modular components that can be used independently or as part of a complete character generation workflow.

## Features

- 🧬 **QoL Character Generator**
  - Guided creation: attributes → class → skills → gear → credits
  - Smart dialogs with homebrew-friendly functionality
  - Saves creation progress automatically
  - Full compendium integration with UUID-safe item handling
    - Clean fallback for non-compendium results
  - Interactive skill selection tree
  - Full GM control via context menu:
    - Mark actors as "Ready" for creation
    - Automatic activation/deactivation on fresh actors
   
- 🛡️Armor broken status effect
  - Status effect to show the actor's armor is damaged

- 🌴 **Shore Leave Manager**
  - Automate Shore Leave directly from a character sheet
  - Supports custom port classes
  - Adds random flavor text to activities
  - Includes support for common house rules
    - e.g., no Sanity Save, no Stress Relief, etc.

- 🎁 **Stash Sheet**
  - A lightweight actor sheet type for storing items and credits
  - Ideal for banks, lockers, or communal stashes
  - No stats, no rolls – just storage
 
- 👷‍♂️ **Contractor Sheet**
  - Enhanced creature sheet type for managing contractors
  - Setup generic contractors and upgrade them as needed
  - Roll loadout from any class in the game
  - Patched creature/contractor skill rolls to present creature attributes from active stats
 
- 🚀 **0e Ship Crits**
  - Add a button to trigger critical ship damage on demand
  - Escalate crits to the next level if needed

- 📋 **Ship Crew Roster**
  - Adds a crew roster to the Ship Sheet
  - Track active player characters, active contractors, and active auxiliary craft
  - Additional roster functionality is work in progress

- ⚙️ **Utility Tools**
  - Theme color customization via CSS variables
  - Shore Leave helper
  - Stress conversion helper
  - Apply damage helper
  - Skill Training tool (opens the QoL Generator skill tree to add a new skill to a character)
  - Zero-max `z` modifier for zero-based rolls (e.g. `1d10z`, `1d100z`)

## Version

- Current module version: `0.7.1`
- Verified for Foundry VTT: `13.351`

## Compatibility

- 🧠 System: Mothership 1e (`mosh`)
- 🏗️ Foundry VTT Version: 13+
- 📦 Works best with the `fvtt_mosh_1e_psg` compendium pack

## Installation

Download the latest version from [GitHub](https://github.com/GreybeardGM/mosh-greybearded-qol)  
Or install via [manifest URL](https://raw.githubusercontent.com/GreybeardGM/mosh-greybearded-qol/main/module.json)
## Developer Notes

This module was created by **GreybeardGM** for use in long-running Mothership campaigns.  
It is modular, readable, and designed as both a ready-to-use toolkit and a solid foundation for further development.

Feature requests are welcome — but I'm working solo, so no guarantees.

---

**License**: MIT  
**Author**: [GreybeardGM](https://github.com/GreybeardGM)
