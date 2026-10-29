// Shared persisted roster shape for the editor and read-only crew consumers.
export const ROSTER_TABS = Object.freeze(["character", "creature", "ship"]);

export function normalizeHazardPayValue(value) {
  const parsedHazardPay = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedHazardPay)) return null;
  return parsedHazardPay;
}

function normalizeEntry(entry) {
  const legacy = typeof entry === "string";
  const source = legacy ? { uuid: entry } : entry;
  if (!source || typeof source !== "object" || typeof source.uuid !== "string") {
    return { entry: null, changed: true };
  }

  const uuid = source.uuid.trim();
  if (!uuid) return { entry: null, changed: true };

  const hazardPay = normalizeHazardPayValue(source.hazardPay);
  const normalizedEntry = {
    uuid,
    active: source.active !== false,
    hazardPay
  };

  return {
    entry: normalizedEntry,
    changed: legacy || source.uuid !== uuid || source.active !== normalizedEntry.active || source.hazardPay !== hazardPay
  };
}

export function normalizeRosterWithChanges(roster = {}) {
  const normalized = {};
  let changed = !roster || typeof roster !== "object" || Array.isArray(roster);

  if (roster && typeof roster === "object") {
    changed ||= Object.keys(roster).some((tab) => (
      !ROSTER_TABS.includes(tab)
      && Array.isArray(roster[tab])
      && roster[tab].length > 0
    ));
  }

  for (const tab of ROSTER_TABS) {
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

export function normalizeRoster(roster = {}) {
  return normalizeRosterWithChanges(roster).roster;
}
