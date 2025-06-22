import { SHORE_LEAVE_ACTIVITIES } from "../config/default-shore-leave-activities.js";

// Ensure setting exists before use
if (!game.settings.settings.has("mosh-greybearded-qol.shoreLeaveCurrentOffer")) {
  game.settings.register("mosh-greybearded-qol", "shoreLeaveCurrentOffer", {
    name: "Current Shore Leave Activities",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
}

export class ShoreLeaveGMDialog {
  constructor() {
    this.activities = game.settings.get("mosh-greybearded-qol", "shoreLeaveCurrentOffer") ?? [];
    this.maxActivities = Math.max(this.activities.length, 5);
  }

  async render() {
    const content = await renderTemplate("modules/mosh-greybearded-qol/templates/shore-leave-gm-dialog.html", {
      activities: this.activities
    });

    new Dialog({
      title: "Configure Shore Leave Offer",
      content,
      buttons: {},
      close: () => {},
      render: (html) => this.activateListeners(html)
    }, { width: 640, height: "auto" }).render(true);
  }

  activateListeners(html) {
    const listContainer = html.find(".shoreleave-activity-list");
    const maxInput = html.find("#max-activities");

    // Update maxActivities input change
    maxInput.on("change", ev => {
      const val = parseInt(ev.target.value);
      this.maxActivities = Math.max(1, val);
      maxInput.val(this.maxActivities);
    });

    html.find(".adjust-count").on("click", (ev) => {
      const direction = ev.currentTarget.dataset.direction;
      this.maxActivities = Math.max(1, this.maxActivities + (direction === "+" ? 1 : -1));
      maxInput.val(this.maxActivities);
    });

    html.on("click", ".remove-entry", (ev) => {
      const index = parseInt(ev.currentTarget.dataset.index);
      this.activities.splice(index, 1);
      this._refreshList(html);
    });

    html.find(".fill-random").on("click", () => {
      const tiers = html.find(".tier-filter:checked").map((_, el) => el.value).get();
      const pool = SHORE_LEAVE_ACTIVITIES[0].activities.filter(act => tiers.includes(act.tier));
      const usedIds = new Set(this.activities.map(a => a.id));
      const candidates = pool.filter(a => !usedIds.has(a.id));

      while (this.activities.length < this.maxActivities && candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        const selected = candidates.splice(idx, 1)[0];
        this.activities.push({ id: selected.id, tier: selected.tier, label: selected.label, modifier: "" });
      }

      this._refreshList(html);
    });

    html.find("form").on("submit", async (ev) => {
      ev.preventDefault();

      // Capture modifiers
      html.find(".mod-selector").each((_, el) => {
        const index = parseInt(el.name.split("-")[1]);
        this.activities[index].modifier = el.value;
      });

      await game.settings.set("mosh-greybearded-qol", "shoreLeaveCurrentOffer", this.activities);
      ui.notifications.info("Shore leave offer updated.");
    });
  }

  async _refreshList(html) {
    const content = await renderTemplate("modules/mosh-greybearded-qol/templates/shore-leave-gm-dialog.html", {
      activities: this.activities
    });
    html.html(content);
    this.activateListeners(html);
  }
}
