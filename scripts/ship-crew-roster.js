import { getThemeColor } from "./utils/get-theme-color.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "mosh-greybearded-qol";
const FLAG_KEY = "crewRoster";
const TABS = ["character", "creature", "ship", "misc"];

function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return { uuid: entry, active: true };
  }

  if (!entry || typeof entry !== "object" || typeof entry.uuid !== "string") {
    return null;
  }

  return {
    uuid: entry.uuid,
    active: entry.active !== false
  };
}

function normalizeRoster(roster = {}) {
  const normalized = {};

  for (const tab of TABS) {
    const sourceEntries = Array.isArray(roster[tab]) ? roster[tab] : [];
    const seen = new Set();

    normalized[tab] = sourceEntries
      .map((entry) => normalizeEntry(entry))
      .filter((entry) => {
        if (!entry) return false;
        if (seen.has(entry.uuid)) return false;
        seen.add(entry.uuid);
        return true;
      });
  }

  return normalized;
}

function getBucketByType(type) {
  if (type === "character") return "character";
  if (type === "creature") return "creature";
  if (type === "ship") return "ship";
  return "misc";
}

function getJobLabel(actor) {
  if (!actor) return "";

  if (actor.type === "character") {
    const classValue = actor.system?.class?.value || "";
    const rankValue = actor.system?.rank?.value || "";
    return [classValue, rankValue].filter(Boolean).join(", ");
  }

  if (actor.type === "creature") {
    return actor.system?.contractor?.role || "";
  }

  if (actor.type === "ship") {
    return actor.system?.type || "";
  }

  return "";
}

function sortEntries(entries) {
  return entries.sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

function addInactiveDivider(entries) {
  let seenActive = false;

  for (const entry of entries) {
    if (entry.active) {
      seenActive = true;
      entry.showInactiveDivider = false;
      continue;
    }

    entry.showInactiveDivider = seenActive;
    seenActive = false;
  }

  return entries;
}

export class ShipCrewRosterApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this._activeTab = "character";
    this._boundDrop = this._onDrop.bind(this);
  }

  static DEFAULT_OPTIONS = {
    id: "ship-crew-roster",
    tag: "section",
    window: {
      resizable: true,
      title: "Crew Roster",
      contentClasses: ["greybeardqol", "crew-roster"]
    },
    position: {
      width: 680,
      height: 640
    },
    actions: {
      setTab: this._onSetTab,
      removeEntry: this._onRemoveEntry,
      toggleActive: this._onToggleActive,
      openEntry: this._onOpenEntry
    }
  };

  static PARTS = {
    body: {
      template: "modules/mosh-greybearded-qol/templates/ship/crew-roster.html"
    }
  };

  async _prepareContext() {
    const roster = normalizeRoster(this.actor?.getFlag(MODULE_ID, FLAG_KEY));
    const entries = { character: [], creature: [], ship: [], misc: [] };

    for (const tab of TABS) {
      for (const rosterEntry of roster[tab]) {
        const actor = await fromUuid(rosterEntry.uuid);
        if (!actor || actor.documentName !== "Actor") continue;

        entries[tab].push({
          uuid: rosterEntry.uuid,
          active: rosterEntry.active,
          name: actor.name,
          job: getJobLabel(actor),
          img: actor.img
        });
      }

      sortEntries(entries[tab]);
      addInactiveDivider(entries[tab]);
    }

    return {
      actorName: this.actor?.name ?? "Ship",
      actorImg: this.actor?.img ?? "icons/svg/mystery-man.svg",
      themeColor: getThemeColor(),
      activeTab: this._activeTab,
      tabs: [
        { id: "character", label: "Player Characters" },
        { id: "creature", label: "Contractors" },
        { id: "ship", label: "Auxiliary Craft" },
        { id: "misc", label: "Misc" }
      ],
      entries
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    root.removeEventListener("dragover", this._onDragOver);
    root.removeEventListener("drop", this._boundDrop);
    root.addEventListener("dragover", this._onDragOver);
    root.addEventListener("drop", this._boundDrop);
  }

  _onClose(options) {
    const root = this.element;
    if (root) {
      root.removeEventListener("dragover", this._onDragOver);
      root.removeEventListener("drop", this._boundDrop);
    }

    return super._onClose(options);
  }

  _onDragOver = (event) => {
    event.preventDefault();
  };

  async _onDrop(event) {
    event.preventDefault();
    if (!this.actor) return;

    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Actor") return;

    const droppedUuid = data.uuid ?? (data.id ? `Actor.${data.id}` : null);
    if (!droppedUuid) return;

    const droppedActor = await fromUuid(droppedUuid);
    if (!droppedActor || droppedActor.documentName !== "Actor") return;

    const bucket = getBucketByType(droppedActor.type);
    const roster = normalizeRoster(this.actor.getFlag(MODULE_ID, FLAG_KEY));

    for (const tab of TABS) {
      roster[tab] = roster[tab].filter((entry) => entry.uuid !== droppedActor.uuid);
    }

    roster[bucket].push({ uuid: droppedActor.uuid, active: true });
    await this.actor.setFlag(MODULE_ID, FLAG_KEY, roster);
    this._activeTab = bucket;
    this.render(true);
  }

  static async _onSetTab(event, target) {
    event?.preventDefault();
    const tab = target?.dataset?.tab;
    if (!tab) return;

    this._activeTab = tab;
    this.render();
  }

  static async _onRemoveEntry(event, target) {
    event?.preventDefault();
    if (!this.actor) return;

    const tab = target?.dataset?.tab;
    const uuid = target?.dataset?.uuid;
    if (!tab || !uuid || !TABS.includes(tab)) return;

    const roster = normalizeRoster(this.actor.getFlag(MODULE_ID, FLAG_KEY));
    roster[tab] = roster[tab].filter((entry) => entry.uuid !== uuid);
    await this.actor.setFlag(MODULE_ID, FLAG_KEY, roster);
    this.render(true);
  }


  static async _onOpenEntry(event, target) {
    event?.preventDefault();

    const uuid = target?.dataset?.uuid;
    if (!uuid) return;

    const actor = await fromUuid(uuid);
    if (!actor || actor.documentName !== "Actor") return;

    actor.sheet?.render(true);
  }

  static async _onToggleActive(event, target) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.actor) return;

    const tab = target?.dataset?.tab;
    const uuid = target?.dataset?.uuid;
    const active = target?.checked === true;
    if (!tab || !uuid || !TABS.includes(tab)) return;

    const roster = normalizeRoster(this.actor.getFlag(MODULE_ID, FLAG_KEY));
    roster[tab] = roster[tab].map((entry) => {
      if (entry.uuid !== uuid) return entry;
      return { ...entry, active };
    });

    await this.actor.setFlag(MODULE_ID, FLAG_KEY, roster);
    this.render(true);
  }
}
