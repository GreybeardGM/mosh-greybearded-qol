import {
  LEGACY_SHORE_LEAVE_TIERS_SETTING,
  SHORE_LEAVE_CONFIG_MIGRATION_SETTING
} from "./shore-leave.js";
import {
  LEGACY_SHIP_CRITS_SETTING,
  SHIP_CRITS_MIGRATION_SETTING
} from "./toolband.js";

export const MIGRATION_SETTING_DEFINITIONS = [
  {
    key: "convertStress.noSanitySave",
    options: {
      name: "Legacy: Convert Stress - No Sanity Save",
      type: Boolean,
      default: false
    }
  },
  {
    key: "convertStress.noStressRelieve",
    options: {
      name: "Legacy: Convert Stress - No Stress Relieve",
      type: Boolean,
      default: false
    }
  },
  {
    key: "convertStress.minStressConversion",
    options: {
      name: "Legacy: Convert Stress - Min Stress Conversion",
      type: Boolean,
      default: false
    }
  },
  {
    key: "convertStress.formula",
    options: {
      name: "Legacy: Convert Stress - Formula",
      type: String,
      default: "1d5"
    }
  },
  {
    key: "simpleShoreLeave.randomFlavor",
    options: {
      name: "Legacy: Simple Shore Leave - Random Flavor",
      type: Boolean,
      default: true
    }
  },
  {
    key: LEGACY_SHORE_LEAVE_TIERS_SETTING,
    options: {
      name: "Legacy: Shore Leave Tiers",
      type: Object,
      default: []
    }
  },
  {
    key: LEGACY_SHIP_CRITS_SETTING,
    options: {
      name: "Legacy: Enable Ship Crits",
      type: Boolean,
      default: false
    }
  },
  {
    key: SHIP_CRITS_MIGRATION_SETTING,
    options: {
      type: Boolean,
      default: false
    }
  },
  {
    key: SHORE_LEAVE_CONFIG_MIGRATION_SETTING,
    options: {
      type: Boolean,
      default: false
    }
  }
];
