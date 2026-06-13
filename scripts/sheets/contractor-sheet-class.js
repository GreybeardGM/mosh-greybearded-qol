import { qolSheetClasses, templatePath } from "../codex/constants.js";
import { getThemeColor } from "../utils/get-theme-color.js";
import { chatOutput } from "../utils/chat-output.js";
import { parseCurrencyValue } from "../utils/normalization.js";
import { attachCurrencyFieldHandlers } from "../utils/currency-field.js";
import { ClassSelectorApp } from "../character-creator/select-class.js";
import { rollLoadout } from "../character-creator/roll-loadout.js";
import { MOTIVATION_TABLE } from "./contractor-motivation-table.js";

export class QoLContractorSheet extends foundry.appv1.sheets.ActorSheet {

    /** @override */
    static get defaultOptions() {
        var options = {
            classes: qolSheetClasses("actor", "creature", "contractor"),
            template: templatePath("sheets/contractor-sheet.html"),
            width: 700,
            height: 650,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "character" }]
        };

        return foundry.utils.mergeObject(super.defaultOptions, options);
    }

    async _updateObject(event, formData) {
        const salaryPath = "system.contractor.baseSalary";
        if (salaryPath in formData) {
            formData[salaryPath] = parseCurrencyValue(formData[salaryPath]);
        }
        formData["system.health.value"] = 0;
        formData["system.health.max"] = 0;

        const actor = this.object;
        const updateData = foundry.utils.expandObject(formData);

        await actor.update(updateData, {
            diff: false
        });
    }

    /* -------------------------------------------- */


    /** @override */
    async getData() {
      const sheetData = await super.getData();
      sheetData.dtypes = ["String", "Number", "Boolean"];
      let actorData = sheetData.data;
    
      this._prepareContractorItems(sheetData);
        
      // Feste Settings als Platzhalter
      actorData.system.contractor = {
        isNamed: this.actor.system.contractor?.isNamed ?? false,
        baseSalary: this.actor.system.contractor?.baseSalary ?? 0,
        role: this.actor.system.contractor?.role ?? "",
        motivation: this.actor.system.contractor?.motivation ?? "",
        hiddenMotivation: this.actor.system.contractor?.hiddenMotivation ?? ""
      };

           
      if (actorData.system.settings == null) actorData.system.settings = {};
      actorData.system.settings.hideWeight = game.settings.get("mosh", "hideWeight");
      actorData.system.settings.firstEdition = game.settings.get("mosh", "firstEdition");
        
      const TE = foundry.applications.ux.TextEditor.implementation;
      actorData.enriched = {
        description: await TE.enrichHTML(actorData.system.description ?? "", { async: true }),
        biography:  await TE.enrichHTML(actorData.system.biography  ?? "", { async: true })
      };

      actorData.isGM = game.user.isGM;
      actorData.themeColor = getThemeColor();
      actorData.contractorLabel = game.i18n.localize("MoshQoL.Common.Contractor");
        
      return actorData;
    }

    /**
     * Get the remaining wounds of the creature
     * @param {JQuery} html 
     * @returns {int} hits.max - hits.value
     */
    getWoundsLeft(html){
        return html.find(`input[name="system.hits.max"]`).prop('value') - html.find(`input[name="system.hits.value"]`).prop('value'); 
    }

    _duplicateEmbeddedItem(itemId) {
        return foundry.utils.duplicate(this.actor.getEmbeddedDocument("Item", itemId));
    }

    _duplicateItemFromEvent(event) {
        const li = event.currentTarget.closest(".item");
        return this._duplicateEmbeddedItem(li.dataset.itemId);
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareContractorItems(sheetData) {
        const actorData = sheetData.data;
    
        // Initialize containers.
        const abilities = [];
        const weapons = [];
        const armors = [];
        const gear = [];
        const skills = [];
        const conditions = [];
        let armorPoints = 0;
        let damageReduction = 0;
    
        // Iterate through items, allocating to containers
        for (let i of sheetData.items) {
            const item = i.system;
            i.img = i.img || DEFAULT_TOKEN;
    
            if (i.type === 'ability') {
                abilities.push(i);
    
            } else if (i.type === 'item') {
                gear.push(i);
    
            } else if (i.type === 'armor') {
                if (item.equipped) {
                    armorPoints += item.armorPoints || 0;
                    damageReduction += item.damageReduction || 0;
                }
                armors.push(i);
    
            } else if (i.type === 'weapon') {
                if (item?.ranges?.value === "" && item.ranges.medium > 0) {
                    item.ranges.value = `${item.ranges.short}/${item.ranges.medium}/${item.ranges.long}`;
                    item.ranges.medium = 0;
                }
                weapons.push(i);

            } else if (i.type === 'skill') {
                skills.push(i);

            } else if (i.type === 'condition') {
                item.treatment = item.treatment ?? {};
                item.treatment.value = Number(item.treatment.value ?? 0);
                item.treatment.max = Number(item.treatment.max ?? 0);
                item.severity = Number(item.severity ?? 0);
                conditions.push(i);
            }
        }

        const existingArmor = actorData.system.stats?.armor ?? {};
        const cover = existingArmor.cover ?? "";
        
        // Assign and return
        actorData.abilities = abilities;
        actorData.weapons = weapons;
        actorData.armors = armors;
        actorData.gear = gear;
        actorData.skills = skills;
        actorData.conditions = conditions;

        actorData.system.stats = actorData.system.stats ?? {};
        actorData.system.stats.armor = {
            ...existingArmor,
            mod: armorPoints,
            damageReduction: damageReduction,
            cover: cover
        };
    }


    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        attachCurrencyFieldHandlers(html);

        // Attribute Rolls
        // Rollable Attribute
        html.find('.stat-roll').click(ev => {
            const div = $(ev.currentTarget);
            const statName = div.data("key");
            this.actor.rollCheck("1d100", "low", statName, null, null, null);
        });
        
        // ITEMS
        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));        
        html.find('.skill-create').click(this._onItemCreate.bind(this));
        
        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
            li.slideUp(200, () => this.render(false));
        });

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
          const li = $(ev.currentTarget).parents(".item");
          const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
          item.sheet.render(true);
        });

        html.find('.skill-edit').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
            item.sheet.render(true);
        });

        html.find('.skill-roll').click(ev => {
            const item = this._duplicateItemFromEvent(ev);

            this.actor.rollCheck("1d100", "low", null, item.name, item.system.bonus, null);
        });

        html.on('mousedown', '.treatment-button', async ev => {
            ev.preventDefault();
            const li = ev.currentTarget.closest(".item");
            if (!li?.dataset?.itemId) return;

            const item = this._duplicateEmbeddedItem(li.dataset.itemId);

            const treatment = item.system.treatment ?? {};
            const current = Number(treatment.value ?? 0);
            const max = Number(treatment.max ?? 0);
            let next = current;

            if (ev.button === 0) {
                next = Math.min(max, current + 1);
            } else if (ev.button === 2) {
                next = Math.max(0, current - 1);
            }

            item.system.treatment = { ...treatment, value: next, max };
            await this.actor.updateEmbeddedDocuments('Item', [item]);
        });

        html.on('mousedown', '.severity, .severity-button', async ev => {
            ev.preventDefault();
            const li = ev.currentTarget.closest(".item");
            if (!li?.dataset?.itemId) return;

            const item = this._duplicateEmbeddedItem(li.dataset.itemId);

            const severity = Number(item.system.severity ?? 0);
            const maxSeverity = Number(item.system.maxSeverity ?? 4);
            let nextSeverity = severity;

            if (ev.button === 0) {
                nextSeverity = Math.min(maxSeverity, severity + 1);
            } else if (ev.button === 2) {
                nextSeverity = Math.max(0, severity - 1);
            }

            item.system.severity = nextSeverity;
            await this.actor.updateEmbeddedDocuments('Item', [item]);
        });

        //Quantity adjuster
        html.on('mousedown', '.item-quantity', ev => {
          const item = this._duplicateItemFromEvent(ev);
          const amount = item.system.quantity;
    
          if (ev.button == 0) {
            item.system.quantity = Number(amount) + 1;
          } else if (ev.button == 2) {
            item.system.quantity = Number(amount) - 1;
          }
    
          this.actor.updateEmbeddedDocuments('Item', [item]);
        });        

        // Rollable Item/Anything with a description that we want to click on.
        html.find('.description-roll').click(ev => {
            const li = ev.currentTarget.closest(".item");
            this.actor.printDescription(li.dataset.itemId, {
                event: ev
            });
        });        

        // WEAPONS
        // Add Inventory Item
        html.find('.weapon-create').click(this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find('.weapon-edit').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const weapon = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
            weapon.sheet.render(true);
        });

        // Rollable Weapon
        html.find('.weapon-roll').click(ev => {
            const item = this._duplicateItemFromEvent(ev);
            this.actor.rollCheck("1d100", "low", "combat", null, null, item);
        });

        // Rollable Damage
        html.find('.dmg-roll').click(ev => {
            const item = this._duplicateItemFromEvent(ev);
            this.actor.rollCheck(null, null, "damage", null, null, item);
        });

        //increase ammo
        html.on('mousedown', '.weapon-ammo', ev => {
            const item = this._duplicateItemFromEvent(ev);
            const amount = item.system.ammo;
            //increase ammo
            if (ev.button == 0) {
                if (amount >= 0) {
                    item.system.ammo = Number(amount) + 1;
                }
            } else if (ev.button == 2) {
                if (amount > 0) {
                    item.system.ammo = Number(amount) - 1;
                }
            }
            //update ammo count
            this.actor.updateEmbeddedDocuments('Item', [item]);
        });
        
        //increase shots
        html.on('mousedown', '.weapon-shots', ev => {
            const item = this._duplicateItemFromEvent(ev);
            if (ev.button == 0) {
                if (item.system.curShots >= 0 && item.system.curShots < item.system.shots && item.system.ammo > 0) {
                    item.system.curShots = Number(item.system.curShots) + 1;
                    item.system.ammo = Number(item.system.ammo) - 1;
                }
            } else if (ev.button == 2) {
                if (item.system.curShots > 0) {
                    item.system.curShots = Number(item.system.curShots) - 1;
                    item.system.ammo = Number(item.system.ammo) + 1;
                }
            }
            this.actor.updateEmbeddedDocuments('Item', [item]);
        });

        //Reload Shots
        html.on('mousedown', '.weapon-reload', ev => {
            const li = ev.currentTarget.closest(".item");
            this.actor.reloadWeapon(li.dataset.itemId);
        });

        // ARMOR
        // Equip
        html.find('.item-equip').click(ev => {
          const item = this._duplicateItemFromEvent(ev);
    
          item.system.equipped = !item.system.equipped;
          this.actor.updateEmbeddedDocuments('Item', [item]);
        });
        
        //increase oxygen
        html.on('mousedown', '.armor-oxy', ev => {
          const item = this._duplicateItemFromEvent(ev);
          const amount = item.system.oxygenCurrent;
          if (ev.button == 0) {
            if (amount < item.system.oxygenMax) {
              item.system.oxygenCurrent = Number(amount) + 1;
            }
          } else if (ev.button == 2) {
            if (amount > 0) {
              item.system.oxygenCurrent = Number(amount) - 1;
            }
          }
          this.actor.updateEmbeddedDocuments('Item', [item]);
        });
    
        // Clicking on Armor
        html.find('.armor-roll').click(ev => {
          //roll panic check
          this.actor.chooseCover();
        });

        // DRAG & DROP
        // Drag events for macros.
        if (this.actor.isOwner) {
            let handler = ev => this._onDragStart(ev);

            html.find('li.dropitem').each((i, li) => {
                if (li.classList.contains("inventory-header")) return;
                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", handler, false);
            });
        }

    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const data = foundry.utils.duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            data: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"];

        // Finally, create the item!
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }


    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    _onRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const dataset = element.dataset;


        if (dataset.roll) {
            let roll = new Roll(dataset.roll, this.actor.system);
            let label = dataset.label ? `Rolling ${dataset.label} to score under ${dataset.target}` : '';
            roll.roll().toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: label
            });
        }
    }

  /**
   * Rolls a motivation from the MOTIVATION_TABLE and stores it in system.contractor.hiddenMotivation
   * @param {Actor} actor - The actor to update
   */
  async _rollContractorMotivation(actor) {
    const roll = new Roll("1d100z");
    await roll.evaluate();

    const rolledValue = roll.total;
    const result = MOTIVATION_TABLE.find(entry => rolledValue >= entry.min && rolledValue <= entry.max);

    if (!result) {
      ui.notifications.warn(game.i18n.localize("MoshQoL.Contractor.NoMatchingMotivation"));
      return;
    }

    await actor.update({ "system.contractor.hiddenMotivation": result.text }, { diff: false });
    this.render(); // Re-render sheet if needed
  }

  async _rollContractorLoyalty(actor) {
    const roll = new Roll("2d10 + 10");
    await roll.evaluate();
    const total = roll.total;
  
    await actor.update({
      "system.stats.loyalty.value": total,
      "system.stats.loyalty.enabled": true
    });
  
    await chatOutput({
      actor,
      title: game.i18n.localize("MoshQoL.LoyaltyRolled"),
      subtitle: actor.name,
      image: actor.img,
      blocks: [{ type: "counter", value: total, label: "Loyalty" }],
      roll
    });
  
    this.render(); // Falls `this` hier noch Sheet-Kontext ist  
  }

  async _rollContractorLoadout(actor) {
    const selectedClass = await ClassSelectorApp.wait({ actor, applyStats: false });
    if (selectedClass) await rollLoadout(actor, selectedClass, {
      rollCredits: false,
      clearItems: true
    });
  }

}
