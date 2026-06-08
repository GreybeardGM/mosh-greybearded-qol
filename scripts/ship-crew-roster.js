import { getThemeColor } from "./utils/get-theme-color.js";
import { formatCurrency } from "./utils/normalization.js";
import { FLAG_CREW_ROSTER, MODULE_ID, templatePath } from "./codex/constants.js";
import { MOSH_FALLBACK_ACTOR_IMAGE } from "./codex/mosh-system.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_KEY = FLAG_CREW_ROSTER;
const TABS = ["character", "creature", "ship"];

function normalizeHazardPayValue(value) {
  const parsedHazardPay = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedHazardPay)) return null;
  return parsedHazardPay;
}

function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return { entry: { uuid: entry, active: true, hazardPay: null }, changed: true };
  }

  if (!entry || typeof entry !== "object" || typeof entry.uuid !== "string") {
    return { entry: null, changed: true };
  }

  const hazardPay = normalizeHazardPayValue(entry.hazardPay);
  const normalizedEntry = {
    uuid: entry.uuid,
    active: entry.active !== false,
    hazardPay
  };

  return {
    entry: normalizedEntry,
    changed: entry.active !== normalizedEntry.active || entry.hazardPay !== hazardPay
  };
}

function normalizeRosterWithChanges(roster = {}) {
  const normalized = {};
  let changed = !roster || typeof roster !== "object" || Array.isArray(roster);

  if (roster && typeof roster === "object") {
    changed ||= Object.keys(roster).some((tab) => (
      !TABS.includes(tab)
      && Array.isArray(roster[tab])
      && roster[tab].length > 0
    ));
  }

  for (const tab of TABS) {
    const sourceEntries = Array.isArray(roster?.[tab]) ? roster[tab] : [];
    const seen = new Set();
    normalized[tab] = [];

    if (roster && typeof roster === "object" && roster[tab] !== undefined && !Array.isArray(roster[tab])) {
      changed = true;
    }

    for (const sourceEntry of sourceEntries) {
      const { entry, changed: entryChanged } = normalizeEntry(sourceEntry);

      if (entryChanged) changed = true;
      if (!entry) continue;

      if (seen.has(entry.uuid)) {
        changed = true;
        continue;
      }

      seen.add(entry.uuid);
      normalized[tab].push(entry);
    }
  }

  return { roster: normalized, changed };
}

function normalizeRoster(roster = {}) {
  return normalizeRosterWithChanges(roster).roster;
}

function getBucketByType(type) {
  if (type === "character") return "character";
  if (type === "creature") return "creature";
  if (type === "ship") return "ship";
  return null;
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

function getSalaryLabel(actor) {
  const numericSalary = getNumericSalary(actor);
  if (!Number.isFinite(numericSalary)) return "";
  return formatCurrency(numericSalary);
}

function getNumericSalary(actor) {
  if (!actor) return null;

  const rawSalary = actor.system?.contractor?.baseSalary;
  if (rawSalary === undefined || rawSalary === null || rawSalary === "") return null;

  const numericSalary = typeof rawSalary === "number"
    ? rawSalary
    : Number.parseInt(String(rawSalary).replace(/[^\d.-]/g, ""), 10);

  if (!Number.isFinite(numericSalary)) return null;
  return numericSalary;
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
    this._boundHazardChange = this._onHazardChange.bind(this);
    this._pendingRosterCommit = null;
    this._commitInFlight = null;
    this._commitScheduled = false;
    this._cleanupInFlight = null;
    this._lastRosterCleanupCandidate = null;
  }

  static DEFAULT_OPTIONS = {
    id: "ship-crew-roster",
    tag: "form",
    window: {
      resizable: true,
      title: "MoshQoL.Common.CrewRoster",
      contentClasses: ["greybeardqol", "qol-ui", "crew-roster"]
    },
    position: {
      width: 680,
      height: 640
    },
    form: {
      handler: this._onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
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
      template: templatePath("dialogs/crew-roster.html")
    }
  };

  async _resolveCleanRoster(sourceRoster = {}) {
    const { roster, changed: normalizationChanged } = normalizeRosterWithChanges(sourceRoster);
    const uniqueUuids = new Set();

    for (const tab of TABS) {
      for (const rosterEntry of roster[tab]) {
        if (rosterEntry.uuid.trim()) uniqueUuids.add(rosterEntry.uuid);
      }
    }

    const resolvedActors = await Promise.all(
      Array.from(uniqueUuids, async (uuid) => [uuid, await fromUuid(uuid)])
    );
    const actorsByUuid = new Map(resolvedActors);
    const cleanedRoster = { character: [], creature: [], ship: [] };
    let rosterChanged = normalizationChanged;

    for (const tab of TABS) {
      for (const rosterEntry of roster[tab]) {
        const actor = actorsByUuid.get(rosterEntry.uuid);
        const mappedTab = actor?.documentName === "Actor" ? getBucketByType(actor.type) : null;

        if (mappedTab !== tab) {
          rosterChanged = true;
          continue;
        }

        cleanedRoster[tab].push(rosterEntry);
      }
    }

    return { actorsByUuid, cleanedRoster, rosterChanged };
  }

  async _buildRosterContext(sourceRoster = {}) {
    const { actorsByUuid, cleanedRoster, rosterChanged } = await this._resolveCleanRoster(sourceRoster);
    const entries = { character: [], creature: [], ship: [] };
    const summary = { activeCrewCount: 0, totalSalary: 0, totalHazardPay: 0 };

    for (const tab of TABS) {
      for (const rosterEntry of cleanedRoster[tab]) {
        const actor = actorsByUuid.get(rosterEntry.uuid);

        entries[tab].push({
          uuid: rosterEntry.uuid,
          active: rosterEntry.active,
          hazardPay: rosterEntry.hazardPay,
          hazardPayDisplay: Number.isInteger(rosterEntry.hazardPay) ? String(rosterEntry.hazardPay) : "",
          name: actor.name,
          job: getJobLabel(actor),
          salary: getSalaryLabel(actor),
          salaryValue: getNumericSalary(actor),
          img: actor.img
        });
      }

      sortEntries(entries[tab]);
      addInactiveDivider(entries[tab]);

      if (tab === "character" || tab === "creature") {
        for (const entry of entries[tab]) {
          if (!entry.active) continue;
          summary.activeCrewCount += 1;
          if (Number.isFinite(entry.salaryValue)) {
            summary.totalSalary += entry.salaryValue;
          }
        }
      }

      if (tab === "creature") {
        for (const entry of entries[tab]) {
          if (!entry.active) continue;
          if (!Number.isFinite(entry.salaryValue)) continue;
          if (!Number.isInteger(entry.hazardPay)) continue;
          summary.totalHazardPay += entry.salaryValue * entry.hazardPay;
        }
      }
    }

    const tabs = [
      { id: "character", label: game.i18n.localize("MoshQoL.Common.PlayerCharacters") },
      { id: "creature", label: game.i18n.localize("MoshQoL.Common.Contractors") },
      { id: "ship", label: game.i18n.localize("MoshQoL.Common.AuxiliaryCraft") }
    ];

    return { cleanedRoster, entries, rosterChanged, summary, tabs };
  }

  async _prepareContext() {
    const sourceRoster = this.actor?.getFlag(MODULE_ID, FLAG_KEY) ?? {};
    const { cleanedRoster, entries, rosterChanged, summary, tabs } = await this._buildRosterContext(sourceRoster);
    this._lastRosterCleanupCandidate = { cleanedRoster, rosterChanged };

    return {
      actorName: this.actor?.name ?? game.i18n.localize("MoshQoL.CrewRoster.Fallbacks.ActorName"),
      actorImg: this.actor?.img ?? MOSH_FALLBACK_ACTOR_IMAGE,
      themeColor: getThemeColor(),
      activeTab: this._activeTab,
      activeTabLabel: tabs.find((tab) => tab.id === this._activeTab)?.label ?? game.i18n.localize("MoshQoL.CrewRoster.Fallbacks.Entries"),
      showContractorColumns: this._activeTab === "creature",
      tableColumnCount: this._activeTab === "creature" ? 6 : 4,
      summary: {
        activeCrewCount: summary.activeCrewCount,
        totalSalary: formatCurrency(summary.totalSalary),
        totalHazardPay: formatCurrency(summary.totalHazardPay)
      },
      tabs,
      entries
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    root.removeEventListener("dragover", this._onDragOver);
    root.removeEventListener("drop", this._boundDrop);
    root.removeEventListener("change", this._boundHazardChange);
    root.addEventListener("dragover", this._onDragOver);
    root.addEventListener("drop", this._boundDrop);
    root.addEventListener("change", this._boundHazardChange);

    const cleanupCandidate = this._lastRosterCleanupCandidate;
    this._lastRosterCleanupCandidate = null;
    this._cleanupRosterFlagIfNeeded(cleanupCandidate);
  }

  _onClose(options) {
    const root = this.element;
    if (root) {
      root.removeEventListener("dragover", this._onDragOver);
      root.removeEventListener("drop", this._boundDrop);
      root.removeEventListener("change", this._boundHazardChange);
    }

    this._lastRosterCleanupCandidate = null;
    return super._onClose(options);
  }

  _cleanupRosterFlagIfNeeded(candidate = null) {
    if (!this.actor) return Promise.resolve(false);
    if (this._cleanupInFlight) return this._cleanupInFlight;

    this._cleanupInFlight = (async () => {
      const cleanupCandidate = candidate ?? await this._resolveCleanRoster(this.actor.getFlag(MODULE_ID, FLAG_KEY));
      if (!cleanupCandidate.rosterChanged) return false;

      return this._scheduleRosterCommit(cleanupCandidate.cleanedRoster);
    })();

    this._cleanupInFlight.finally(() => {
      this._cleanupInFlight = null;
    });

    return this._cleanupInFlight;
  }

  async _normalizeRosterForCommit(roster) {
    const { cleanedRoster } = await this._resolveCleanRoster(roster);
    return cleanedRoster;
  }

  _scheduleRosterCommit(nextRoster) {
    if (!this.actor) return Promise.resolve(false);

    this._pendingRosterCommit = normalizeRoster(nextRoster);

    if (!this._commitScheduled) {
      this._commitScheduled = true;
      queueMicrotask(() => {
        this._commitScheduled = false;

        if (this._commitInFlight) return;

        this._commitInFlight = this._flushRosterCommit();
        this._commitInFlight.finally(() => {
          this._commitInFlight = null;
          if (this._pendingRosterCommit) {
            this._scheduleRosterCommit(this._pendingRosterCommit);
          }
        });
      });
    }

    if (this._commitInFlight) return this._commitInFlight;
    return Promise.resolve(true);
  }

  async _flushRosterCommit() {
    if (!this.actor || !this._pendingRosterCommit) return false;

    const pendingRoster = this._pendingRosterCommit;
    this._pendingRosterCommit = null;
    const rosterToCommit = await this._normalizeRosterForCommit(pendingRoster);

    await this.actor.setFlag(MODULE_ID, FLAG_KEY, rosterToCommit);
    this.render();
    return true;
  }

  _onDragOver = (event) => {
    event.preventDefault();
  };

  _onHazardChange(event) {
    const target = event?.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("crew-roster-hazard-input")) return;

    if (this.element instanceof HTMLFormElement) {
      this.element.requestSubmit();
    }
  }

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
    if (!bucket) return;

    const roster = normalizeRoster(this.actor.getFlag(MODULE_ID, FLAG_KEY));

    for (const tab of TABS) {
      roster[tab] = roster[tab].filter((entry) => entry.uuid !== droppedActor.uuid);
    }

    roster[bucket].push({ uuid: droppedActor.uuid, active: true, hazardPay: null });
    this._activeTab = bucket;
    this._scheduleRosterCommit(roster);
  }

  static async _onSubmit(event, form, formData) {
    if (!this.actor) return;

    const submitted = formData?.object ?? {};
    const hazardPayUpdates = new Map();

    for (const [key, value] of Object.entries(submitted)) {
      const [root, tab, ...uuidParts] = key.split(".");
      if (root !== "hazardPay") continue;
      if (!TABS.includes(tab)) continue;

      const uuid = uuidParts.join(".");
      if (!uuid) continue;

      const normalizedHazardPay = normalizeHazardPayValue(value);

      if (!hazardPayUpdates.has(tab)) {
        hazardPayUpdates.set(tab, new Map());
      }

      hazardPayUpdates.get(tab).set(uuid, normalizedHazardPay);

      if (form instanceof HTMLFormElement) {
        const input = form.elements.namedItem(key);
        if (input instanceof HTMLInputElement) {
          const sanitizedValue = normalizedHazardPay === null ? "" : String(normalizedHazardPay);
          if (input.value !== sanitizedValue) {
            input.value = sanitizedValue;
          }
        }
      }
    }

    if (!hazardPayUpdates.size) return;

    const roster = normalizeRoster(this.actor.getFlag(MODULE_ID, FLAG_KEY));
    let hasChanges = false;

    for (const tab of TABS) {
      const tabUpdates = hazardPayUpdates.get(tab);
      if (!tabUpdates?.size) continue;

      roster[tab] = roster[tab].map((entry) => {
        if (!tabUpdates.has(entry.uuid)) return entry;

        const nextHazardPay = tabUpdates.get(entry.uuid);
        if (entry.hazardPay === nextHazardPay) return entry;

        hasChanges = true;
        return { ...entry, hazardPay: nextHazardPay };
      });
    }


    if (!hasChanges) return;

    await this._scheduleRosterCommit(roster);
  }

  static async _onSetTab(event, target) {
    event?.preventDefault();
    const tab = target?.dataset?.tab;
    if (!tab) return;

    if (this._activeTab === tab) return;

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
    await this._scheduleRosterCommit(roster);
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

    await this._scheduleRosterCommit(roster);
  }
}
