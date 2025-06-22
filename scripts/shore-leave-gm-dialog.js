import { SHORE_LEAVE_ACTIVITIES } from "../config/default-shore-leave-activities.js";

export class ShoreLeaveGMDialog {
  constructor() {
    this.maxActivities = 5;
    this.activities = [];
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
    }, { width: 600 }).render(true);
  }

  activateListeners(html) {
    const listContainer = html.find(".shoreleave-activity-list");

    // Adjust activity count
    html.find(".adjust-count").on("click", (ev) => {
      const direction = ev.currentTarget.dataset.direction;
      const input = html.find("#max-activities")[0];
      this.maxActivities = Math.max(1, parseInt(input.value) + (direction === "+" ? 1 : -1));
      input.value = this.maxActivities;
      this._refreshList(html);
    });

    // Remove entry
    html.find(".shoreleave-activity-list").on("click", ".remove-entry", (ev) => {
      const index = parseInt(ev.currentTarget.dataset.index);
      this.activities.splice(index, 1);
      this._refreshList(html);
    });

    // Fill random
    html.find(".fill-random").on("click", () => {
      const tiers = html.find(".tier-filter:checked").map((_, el) => el.value).get();
      const pool = SHORE_LEAVE_ACTIVITIES[0].activities.filter(act => tiers.includes(act.tier));
      const usedIds = new Set(this.activities.map(a => a.id));
      const candidates = pool.filter(a => !usedIds.has(a.id));

      while (this.activities.length < this.maxActivities && candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        const selected = candidates.splice(idx, 1)[0];
        this.activities.push({ id: selected.id, label: selected.label, modifier: "" });
      }

      this._refreshList(html);
    });

    // Confirm submit
    html.find("form").on("submit", async (ev) => {
      ev.preventDefault();

      // Save into world settings
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
