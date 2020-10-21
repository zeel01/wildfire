/**
 * A set of properties to define a random chance of an event occuring.
 *
 * @typedef Chance
 * @property {string} formula - The Roll formula for this chance
 * @property {number} target - The roll is considered a sucess if the result is this number or higher
 */

/**
 * The main class for the Wildfire module
 * contains methods for manipulating fires.
 *
 * @class Wildfire
 */
class Wildfire {
	/**
	 * Retrieves the grid position [row, col] that a given
	 * point [x, y] is within.
	 *
	 * @static
	 * @param {[number, number]} position - The [x, y] position of the point
	 * @return {[number, number]} The [row, col] of the grid position.
	 * @memberof Wildfire
	 */
	static getGridPos([x, y]) { return canvas.grid.grid.getGridPositionFromPixels(x, y); }
	
	/**
	 * Retrieves the pixel position [x, y] of the upper left
	 * corner of a grid position [row, col]
	 *
	 * @static
	 * @param {[number, number]} position - The [row, col] position of the grid space
	 * @return {[number, number]} The [x, y] coordinates of the point at the top-left of the space
	 * @memberof Wildfire
	 */
	static getPixelPos([row, col]) { return canvas.grid.grid.getPixelsFromGridPosition(row, col); }

	/**
	 * Retrieve an array of cells that are adjacent to the one specified
	 *
	 * @static
	 * @param {[number, number]} postion - The [row, col] position of the cell
	 * @return {[number, number][]} An array of [row, col] pairs refering to the locations of all adjacent cells.
	 * @memberof Wildfire
	 */
	static getNeighbors([row, col]) { return canvas.grid.grid.getNeighbors(row, col); }

	/**
	 * Return a new Wildfire based on a source token that
	 * will have a special Wildfire flag set.
	 *
	 * @static
	 * @param {Token} source - The token to base the rest of the fire off of
	 * @param {string} formula - The roll formula for fire spreading
	 * @param {number} target - The target result for the formula
	 * @return {Wildfire} The new instance of Wildfire 
	 * @memberof Wildfire
	 */
	static async createWildfire(source, formula, target) {
		await source.setFlag("wildfire", "fire", true);
		const fire = new Wildfire(source, { formula, target });
		const combatant = game.combats.active.createCombatant({ 
			"flags.wildfire.fire": true,
			"img": source.data.img,
			"name": source.data.name
		});

		if (!game.wildfires) game.wildfires = [];

		game.wildfires.push(fire);
		fire.combatant = combatant;

		return fire;
	}

	static async onCreateButtonClick() {
		if (canvas.tokens.controlled.length < 1) {
			ui.notifications.warn(game.i18n.localize("wildfire.notifications.noSelectedToken"));
			return;
		}

		ui.notifications.notify(game.i18n.localize("wildfire.notifications.addedWildfire"));
		
		Wildfire.createWildfire(canvas.tokens.controlled[0], "1d6", 1);
	}

	/**
	 * Sets a flammable flag on all selected drawings 
	 *
	 * @static
	 * @return {Array<object>} And array of data ojects of updated data
	 * @memberof Wildfire
	 */
	static async setFlammableDrawings() {
		const drawings = canvas.drawings.controlled;
		if (drawings.length < 1) {
			ui.notifications.warn(game.i18n.localize("wildfire.notifications.noSelectedDrawings"));
			return;
		}

		const data = drawings.map(d => ({ "_id": d.id, "flags.wildfire.flammable": true }));
		ui.notifications.notify(game.i18n.format("wildfire.notifications.setDrawingsFlammable", { n: data.length }));
		return await canvas.drawings.updateMany(data);
	}

	/**
	 * A copy of the data for a Token to be used
	 * as a representative of Fire.
	 * 
	 * Always returns a new copy rather than a reference.
	 *
	 * @memberof Wildfire
	 * @param {Token} tkn - A token to take the data of
	 * @type {Object}
	 */
	 get token() { return duplicate(this._token); }
	 set token(tkn) { this._token = duplicate(tkn.data) }

	/**
	 * Creates an instance of Wildfire.
	 *
	 * @memberof Wildfire
	 * @param {Token} prototype - A token to use as the prototype for all new fires
	 * @param {Chance} chance - A cahnce object defining the default chance of spreading for this Wildfire
	 */
	constructor(prototype, chance={ formula: "1d1", target: "1"}) {
		this.token = prototype;
		this.chance = chance;

		/**
		 * An array of new fires that have not yet been added to the scene as tokens
		 * @property {Object[]} newFires
		 * @memberof Wildfire
		 */
		this.newFires = [];

		/**
		 * When true, the spreading operation is in progress.
		 * This operation is time consuming, when true additional spreading operations are aborted.
		 *
		 * @memberof Wildfire
		 * @property {Boolean} spreading
		 */
		this.spreading = false;
	}

	/** 
	 * An array of all Fire tokens in the scene.
	 * 
	 * @memberof Wildfire
	 * @readonly
	 * @type {Token[]}
	 */
	get realFires() { return canvas.tokens.objects.children.filter(t => t.data.flags?.wildfire?.fire); }

	/**
	 * An array of all fires, both real Tokens and newFires
	 *
	 * @readonly
	 * @memberof Wildfire
	 * @type {Object[]}
	 */
	get fires() { return this.realFires.concat(this.newFires); }

	/**
	 * An array of all drawings with the flammable flag set to true.
	 *
	 * @readonly
	 * @memberof Wildfire
	 * @type {Drawing[]}
	 */
	get flammableAreas() { return canvas.drawings.objects.children.filter(d => d.data.flags?.wildfire?.flammable); }

	/**
	 * The width in pixels of a grid space
	 *
	 * @readonly
	 * @memberof Wildfire
	 */
	get gridSize() { return canvas.grid.grid.w; }

	/**
	 * Checks whether or not the cell is already on fire.
	 *
	 * @param {[number, number]} cell - The [row, col] location of this cell on the grid
	 * @return {Boolean} True if the cell contains a Fire already 
	 * @memberof Wildfire
	 */
	isBurning(cell) {
		const [x, y] = Wildfire.getPixelPos(cell);
		return this.fires.some(t => t.x == x && t.y == y);
	}

	/**
	 * Check whether or not the space is inside a drawing
	 * that has a flammable flag set to true.
	 *
	 * @param {[number, number]} cell - The [row, col] location of this cell on the grid
	 * @return {Boolean} True if the cell is in a drawing flagged as flammable
	 * @memberof Wildfire
	 */
	isInFlammableArea(cell) {
		return this.flammableAreas.some(area => this.areaContains(area, cell));
	}

	/**
	 * Tests whether or not the area of a drawing and the area of a cell
	 * overlap, if so the cell is considered to be within the flammable
	 * area of the drawing.
	 *
	 * @param {Drawing} area - The flammable drawing
	 * @param {[number, number]} cell - The [row, col] location of this cell on the grid
	 * @return {Boolean} True if the area defined by the drawing contains the cell 
	 * @memberof Wildfire
	 */
	areaContains(area, cell) {
		const [cx, cy] = Wildfire.getPixelPos(cell);

		// Top left of drawing
		const tl1 = { x: area.data.x, y: area.data.y };
		// Top left of cell
		const tl2 = { x: cx, y: cy };
		// Bottom right of drawing
		const br1 = { x: tl1.x + area.width, y: tl1.y + area.height };
		// Bottom right of cell
		const br2 = { x: tl2.x + this.gridSize, y: tl2.y + this.gridSize };

		return !(             // Return true if none of the following are true
			tl1.x >= br2.x || // - Drawing is completely to the right of the cell
			tl2.x >= br1.x || // - Cell is completely to the right of the drawing
			tl1.y >= br2.y || // - Drawing is completely above the cell
			tl2.y >= br1.y    // - Cell is completely above the drawing
		);
	}

	/**
	* Checks whether or not the cell can be set on fire.
	*
	* @param {[number, number]} cell - The [row, col] location of this cell on the grid
	* @return {Boolean} True if the cell can be set on fire
	* @memberof Wildfire
	*/
	isFlammable(cell) {
		return (
			!this.isBurning(cell)         &&
			 this.isInFlammableArea(cell)
		);
	}

	/**
	 * Create a new Fire in the specified grid cell
	 *
	 * @param {[number, number]} cell - The [row, col] location of this cell on the grid
	 * @memberof Wildfire
	 */
	light(cell) {
		const [x, y] = Wildfire.getPixelPos(cell);
		const data = duplicate(this.token);
		data.x = x;
		data.y = y;
		this.newFires.push(data);
	}

	/**
	 * Spread the fire into the given cell, if certain conditions are met
	 * conditions include the cell being possible to light
	 * and the success of a random die roll.
	 *
	 * @param {[number, number]} cell - The [row, col] location of this cell on the grid
	 * @param {Chance} chance - The random chance of the fire spreading
	 * @return {void} Returns early when the fire can not spread into the cell 
	 * @memberof Wildfire
	 */
	spreadToCell(cell, chance) {
		if (!this.isFlammable(cell)) return;
		if (new Roll(chance.formula).roll().total < chance.target) return;

		this.light(cell);
	}

	/**
	 * Spread the fire to all neighboring cells
	 *
	 * @param {Token} fire - The Fire token representing this fire
	 * @param {Chance} chance - The random chance of the fire spreading
	 * @memberof Wildfire
	 */
	spreadToNeighbors(fire, chance) {
		const location = [fire.x, fire.y];
		const cell = Wildfire.getGridPos(location);
		const neighbors = Wildfire.getNeighbors(cell);

		neighbors.forEach(cell => this.spreadToCell(cell, chance))
	}

	/**
	 * Spread all fires based on a given Chance of spreading.
	 *
	 * @param {Chance} chance - The random chance of the fire spreading
	 * @return {Promise<void>} A Promise that fullfills once the spreading operation is complete
	 * @memberof Wildfire
	 */
	async spread(chance=this.chance) {
		if (this.spreading) return;
		this.spreading = true;
		this.realFires.forEach(fire => this.spreadToNeighbors(fire, chance));

		await this.createNewFires()
		this.spreading = false;

		return;
	}

	/**
	 * Creates the new Fire Tokens
	 *
	 * @return {Promise<void>} A Promise that fullfills when the server createMany operations comeplets. 
	 * @memberof Wildfire
	 */
	async createNewFires() {
		await canvas.tokens.createMany(this.newFires);
		ui.notifications.notify(game.i18n.format("wildfire.notifications.createdFires", { n: this.newFires.length }));
		this.newFires = [];

		return;
	}
}

async function spreadFire() {
	const fire = await Wildfire.createWildfire(_token, "1d6", 1);
	fire.spread();
}

Hooks.on("getSceneControlButtons", (layers) => {
	console.log(layers);
	
	layers.find(l => l.name == "drawings").tools.push({
		icon: "fas fa-tree",
		name: "setflammable",
		title: "wildfire.title",
		button: true,
		onClick: () => Wildfire.setFlammableDrawings()
	});
})

Hooks.on("updateCombat", (combat) => {
	if (combat.combatant.flags?.wildfire?.fire) {
		if (!game.wildfires) return;
		game.wildfires.forEach(fire => fire.spread());
	}
})

Hooks.on("renderCombatTracker", (tracker, html) => {
	if (!tracker.combat) return;

	const button = $(`
		<a class="combat-control" title="${game.i18n.localize("wildfire.tooltips.addWildfire")}">
			<i class="fas fa-fire"></i>
		</a>
	`).click((event) => Wildfire.onCreateButtonClick());

	html.find("#combat-round [data-control=rollNPC]").after(button)
})