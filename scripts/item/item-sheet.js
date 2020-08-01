/**
 * Provides the data and general interaction with Item Sheets
 *
 * The main purpose of this sheet class is to provide the correct
 * data to the template when rendering depending on what type
 * of item the sheet belongs too. Additionally, item sheet
 * interactivity and events are handled here.
 */

class ItemSheetWfrp2e extends ItemSheet
{
  constructor(item, options)
  {
    super(item, options);
    this.mce = null;
  }


  static get defaultOptions() {
    const options = super.defaultOptions;
    options.tabs = [{navSelector: ".tabs", contentSelector: ".content", initial: "description"}]
    options.scrollY = [".details"]
	  return options;
  }


  /**
   * Override header buttons to add custom ones.
   */
  _getHeaderButtons()
  {
    let buttons = super._getHeaderButtons();
    // Add "Post to chat" button
    // We previously restricted this to GM and editable items only. If you ever find this comment because it broke something: eh, sorry!
    buttons.push(
    {
      class: "post",
      icon: "fas fa-comment",
      onclick: ev => new ItemWfrp2e(this.item.data).postItem()
    })
    return buttons
  }

  // Add tooltips to header buttons
  async _render(force = false, options = {})
  {
    await super._render(force, options);
    $(this._element).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
    $(this._element).find(".configure-sheet").attr("title", game.i18n.localize("SHEET.Configure"));
    $(this._element).find(".post").attr("title", game.i18n.localize("SHEET.Post"));
    $(this._element).find(".import").attr("title", game.i18n.localize("SHEET.Import"));
  }


  /**
   * Use a type-specific template for each different item type
   */
  get template()
  {
    let type = this.item.type;
    return `systems/wfrp2e/templates/items/item-${type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /**
   * Prepare item sheet data.
   * 
   * Start with the base item data and extending with additional properties for rendering.
   * Each item type has specific data (typically from config constants) that needs to be rendered
   * 
   * Example: A weapon sheet needs all different weapon types to list in the weaponGroup dropdown (`data['weaponGroups'] = WFRP2E.weaponGroups;`)
   */
  getData()
  {
    const data = super.getData();

    if (this.item.type === "skill")
    {
      data['characteristics'] = WFRP2E.characteristics;
      data['skillGroup'] = WFRP2E.skillGroup;
      data['skillTypes'] = WFRP2E.skillTypes;
    }
    else if (this.item.type === "talent")
    {
      data['relatedSkills'] = data.data.relatedSkills.join(", ");
    }
    else if (this.item.type == "weapon")
    {
      data['weaponGroups'] = WFRP2E.weaponGroups;
      data['availability'] = WFRP2E.availability;
      data['reloadActions'] = WFRP2E.reloadActions
      data['ammunitionGroups'] = WFRP2E.ammunitionGroups;
      data['weaponTypes'] = WFRP2E.weaponTypes;
      data.isMelee = WFRP2E.groupToType[this.item.data.data.weaponGroup.value] == "melee"
    }
    else if (this.item.type == "ammunition")
    {
      data['availability'] = WFRP2E.availability;
      data['ammunitionGroups'] = WFRP2E.ammunitionGroups;
    }
    else if (this.item.type == "armour")
    {
      data['armorTypes'] = WFRP2E.armorTypes;
      data['availability'] = WFRP2E.availability;
    }
    else if (this.item.type == "spell")
    {
      if (WFRP2E.magicLores[this.item.data.data.lore.value])
      {
        data["loreValue"] = WFRP2E.magicLores[this.item.data.data.lore.value]
      }
      else
      {
        data["loreValue"] = this.item.data.data.lore.value;
      }
      data["descriptionAndLore"] = WFRP_Utility._spellDescription(this.item.data)

    }
    else if (this.item.type == "prayer")
    {
      data['prayerTypes'] = WFRP2E.prayerTypes;
    }


    else if (this.item.type == "career")
    {
      data['statusTiers'] = WFRP2E.statusTiers;
      data['skills'] = data.data.skills.join(", ").toString();
      data['earningSkills'] = data.data.incomeSkill.map(function (item)
      {
        return data.data.skills[item];
      });
      data['talents'] = data.data.talents.toString();
      data['trappings'] = data.data.trappings.toString();
      let characteristicList = duplicate(WFRP2E.characteristicsAbbrev);
      for (let char in characteristicList)
      {
        if (data.data.characteristics.includes(char))
          characteristicList[char] = {
            abrev: WFRP2E.characteristicsAbbrev[char],
            checked: true
          };
        else
          characteristicList[char] = {
            abrev: WFRP2E.characteristicsAbbrev[char],
            checked: false
          };
      }
      data['characteristicList'] = characteristicList;

    }

    else if (this.item.type == "trapping")
    {
      data['trappingTypes'] = WFRP2E.trappingTypes;
      data['availability'] = WFRP2E.availability;
    }

    else if (this.item.type == "trait")
    {
      data['characteristics'] = WFRP2E.characteristics;
      data['difficultyLabels'] = WFRP2E.difficultyLabels;
    }

    else if (this.item.type == "container")
    {
      data['availability'] = WFRP2E.availability;
    }

    else if (this.item.type == "mutation")
    {
      data['mutationTypes'] = WFRP2E.mutationTypes;
    }

    data.showBorder = data.item.img == "systems/wfrp2e/icons/blank.png" || !data.item.img
    data.isGM = game.user.isGM;
    data.isOwned = this.item.isOwned;
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html)
  {
    super.activateListeners(html);

    // Checkbox changes
    html.find('input[type="checkbox"]').change(event => this._onSubmit(event));


    // Lore input is tricky because we need to choose from a set of defined choices, but it isn't a dropdown
    html.find('.lore-input').change(async event =>
      {
        let inputLore = event.target.value;
        // Go through each lore name
        for (let lore in WFRP2E.magicLores)
        {
          // If lore value matches config, use that (Update the actor with the "key" value)
          if (inputLore == WFRP2E.magicLores[lore])
          {
            await this.item.update({'data.lore.value': lore});
            return;
          }
        }
        // Otherwise, if the input isn't recognized, store user input directly as a custom lore
        await this.item.update({'data.lore.value': inputLore});

      }),


      // For a career, when characteristic checkbox is changed, ensure list of 
      // characteristics for that career remains valid.
      html.find('.char-checkbox').click(async event =>
      {
        this._onSubmit(event);
        let charChanged = $(event.currentTarget).attr("name")

        let characteristicList = duplicate(this.item.data.data.characteristics);

        // If the charChanged is already in the list, remove it
        if (characteristicList.includes(charChanged))
          characteristicList.splice(characteristicList.findIndex(c => c == charChanged));
        else // If it isn't in the list, add it
          characteristicList.push(charChanged);

        await this.item.update({'data.characteristics': characteristicList})

      }),

      // Generalized checkbox update for various different items. TODO: is this needed?
      html.find(".item-checkbox").click(async event =>
      {
        this._onSubmit(event);
        let target = $(event.currentTarget).attr("data-target");
        let path = target.split(".");
        if(path[0]== "flags")
        {
          if(!this.item.data.flags.hasOwnProperty(path[1]))
            this.item.data.flags[path[1]] = false;
          this.item.update({[`${target}`]: !this.item.data.flags[path[1]]})
        }
        else
          this.item.update({[`data.${target}`]: !this.item.data.data[path[0]][path[1]]})
      }),

      // This listener converts comma separated lists in the career section to arrays,
      // placing them in the correct location using update
      html.find('.csv-input').change(async event =>
      {
        this._onSubmit(event);
        let list = event.target.value.split(",").map(function (item)
        {
          return item.trim();
        });
        
        if (hasProperty(this.item.data, event.target.attributes["data-dest"].value))
          this.item.update({ [event.target.attributes["data-dest"].value] : list})

      });



      html.find(".bonus-input").change(ev => {
        let data = this.item.data;
        let bonuses = duplicate(data.data.bonuses)
        let index = Number($(ev.currentTarget).attr("index"))
        let target = $(ev.currentTarget).attr("target")
        if (!bonuses.length)
          bonuses = [{display : ev.target.value}]
        else
        {
          if (target != "constant")
            bonuses[index][target] = ev.target.value
          else 
          {
            bonuses[index]["constant"] = !bonuses[index]["constant"]
          }
        }
        this.item.update({"data.bonuses" : bonuses})
      })

      html.find(".add-talent-bonus").change(ev => {
        let bonuses = duplicate(this.item.data.data.bonuses)
        bonuses.push({});
        this.item.update({"data.bonuses" : bonuses})
      })

      html.find(".bonus-input.checkbox").click(ev => {
        this._onSubmit(event);
        let data = this.item.data;
        let bonuses = duplicate(data.data.bonuses)
        let index = Number($(ev.currentTarget).attr("index"))
        bonuses[index]["constant"] = !bonuses[index]["constant"]
        this.item.update({"data.bonuses" : bonuses})
      })

      html.find(".add-talent-bonus").click(ev => {
        let bonuses = duplicate(this.item.data.data.bonuses)
        bonuses.push({display: "New Bonus"});
        this.item.update({"data.bonuses" : bonuses})
      })





    // If the user changes a grouped skill that is in their current career,
    // offer to propagate that change to the career as well.
    html.on("change", ".item-name", ev => {
      if (this.item.type != "skill" || !this.item.actor || this.item.data.data.grouped.value != "isSpec")
        return;
      // If no change
      if (ev.target.value == this.item.name)
        return
      
      let currentCareer = duplicate(this.item.actor.data.items.filter(i => i.type == "career").find(i => i.data.current.value));

      // If career has the skill that was changed, change the name in the career
      if(currentCareer && currentCareer.data.skills.includes(this.item.name))
        currentCareer.data.skills[currentCareer.data.skills.indexOf(this.item.name)] = ev.target.value;
      else // if it doesn't, return
        return;
      
      let oldName = this.item.name

      // Ask the user to confirm the change
      new Dialog({
          title : game.i18n.localize("SHEET.CareerSkill"),
          content: `<p>${game.i18n.localize("SHEET.CareerSkillPrompt")}</p>`,
          buttons: {
            yes: {
              label: "Yes",
              callback: async dlg => {
                ui.notifications.notify(`Changing ${oldName} to ${ev.target.value} in ${currentCareer.name}`)
                this.item.actor.updateEmbeddedEntity("OwnedItem", currentCareer)
              }
            },
            no: {
              label: "No",
              callback: async dlg => {
                return;
              }
            },
          },
          default: 'yes'
        }).render(true);
      });

    // Support custom entity links
    html.on("click", ".chat-roll", ev =>
    {
      WFRP_Utility.handleRollClick(ev)
    })

    html.on("click", ".symptom-tag", ev =>
    {
	  WFRP_Utility.handleSymptomClick(ev)
    })

    html.on("click", ".condition-chat", ev =>
    {
      WFRP_Utility.handleConditionClick(ev)
    })

    html.on('mousedown', '.table-click', ev =>
    {
      WFRP_Utility.handleTableClick(ev)
    })

    html.on('mousedown', '.pay-link', ev => {
      WFRP_Utility.handlePayClick(ev)
    })

    html.on('mousedown', '.credit-link', ev => {
      WFRP_Utility.handleCreditClick(ev)
    })
  }
}

Items.unregisterSheet("core", ItemSheet);
Items.registerSheet("wfrp2e", ItemSheetWfrp2e,
{
  makeDefault: true
});