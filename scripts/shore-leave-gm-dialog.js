import { SHORE_LEAVE_ACTIVITIES } from "./config/default-shore-leave-activities.js";

export class ShoreLeaveGMDialog {
  constructor() {
    this.activities = foundry.utils.deepClone(game.settings.get("mosh-greybearded-qol", "shoreLeaveCurrentOffer")) ?? [];
    this.maxActivities = Math.max(this.activities.length, 5);
  }

  async render() {
    const content = await this._renderTemplate();
    const dlg = new Dialog({
      title: "Configure Shore Leave Offer",
      content,
      buttons: {},
      resizable: true,
      render: (html) => {
        const dlgEl = html.closest(".app.window-app.dialog");
        dlgEl.css({ width: "1000px", height: "auto", maxHeight: "90vh", maxWidth: "95vw", margin: "0 auto" });
        dlgEl.find(".window-content").css("overflow-y", "auto");
        this.activateListeners(html);
      }
    });
    dlg.render(true);
  }

  async _renderTemplate() {
    return renderTemplate("modules/mosh-greybearded-qol/templates/shore-leave-gm-dialog.html", {
      activities: this.activities,
      maxActivities: this.maxActivities
    });
  }

  activateListeners(html) {
    const maxInput = html.find("#max-activities");
    maxInput.val(this.maxActivities);

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
      const index = parseInt(ev.currentTarget.closest(".pill").dataset.index);
      if (!isNaN(index)) {
        this.activities.splice(index, 1);
        this._refreshList(html);
      }
    });

    html.find(".fill-random").on("click", () => {
      const selectedTiers = html.find(".tier-filter:checked").map((_, el) => el.value).get();
      const pool = SHORE_LEAVE_ACTIVITIES[0].activities.filter(act => selectedTiers.includes(act.tier));
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

      html.find(".mod-selector").each((_, el) => {
        const index = parseInt(el.name.split("-")[1]);
        if (!isNaN(index) && this.activities[index]) {
          this.activities[index].modifier = el.value;
        }
      });

      await game.settings.set("mosh-greybearded-qol", "shoreLeaveCurrentOffer", this.activities);
      ui.notifications.info("Shore leave offer updated.");
    });
  }

  async _refreshList(html) {
    const content = await this._renderTemplate();
    const container = html.find("form.greybeardqol.shoreleave-gm-config");
    if (container.length) {
      container.html($(content).html());
      this.activateListeners(container);
    } else {
      html.html(content);
      this.activateListeners(html);
    }
  }
}
