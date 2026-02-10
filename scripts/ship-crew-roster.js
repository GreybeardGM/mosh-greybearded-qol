const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "mosh-greybearded-qol";
const FLAG_KEY = "crewRoster";
const TABS = ["character", "creature", "misc"];

function normalizeRoster(roster = {}) {
  return {
    character: Array.isArray(roster.character) ? roster.character : [],
    creature: Array.isArray(roster.creature) ? roster.creature : [],
    misc: Array.isArray(roster.misc) ? roster.misc : []
  };
}

function getBucketByType(type) {
  if (type === "character") return "character";
  if (type === "creature") return "creature";
  return "misc";
}

export class ShipCrewRosterApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this._activeTab = "character";
    this._boundDrop = this._onDrop.bind(this);
  }

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "ship-crew-roster",
    classes: ["greybeardqol", "crew-roster"],
    tag: "section",
    window: {
      resizable: true,
      title: "Crew Roster"
    },
    position: {
      width: 560,
      height: 640
    },
    actions: {
      setTab: this._onSetTab,
      removeEntry: this._onRemoveEntry
    }
  });

  static PARTS = {
    body: {
      template: "modules/mosh-greybearded-qol/templates/ship/crew-roster.html"
    }
  };

  async _prepareContext() {
    const roster = normalizeRoster(this.actor?.getFlag(MODULE_ID, FLAG_KEY));
    const entries = { character: [], creature: [], misc: [] };

    for (const tab of TABS) {
      for (const uuid of roster[tab]) {
        const actor = await fromUuid(uuid);
        if (!actor || actor.documentName !== "Actor") continue;
        entries[tab].push({
          uuid,
          name: actor.name,
          img: actor.img
        });
      }
    }

    return {
      actorName: this.actor?.name ?? "Ship",
      activeTab: this._activeTab,
      tabs: [
        { id: "character", label: "Player Characters" },
        { id: "creature", label: "Contractors" },
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
      roster[tab] = roster[tab].filter((uuid) => uuid !== droppedActor.uuid);
    }

    roster[bucket].push(droppedActor.uuid);
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
    roster[tab] = roster[tab].filter((entryUuid) => entryUuid !== uuid);
    await this.actor.setFlag(MODULE_ID, FLAG_KEY, roster);
    this.render(true);
  }
}
