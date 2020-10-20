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
		return new Wildfire(source, { formula, target });
	}

	/**
	 * Sets a flamable flag on all selected drawings 
	 *
	 * @static
	 * @return {Array<object>} And array of data ojects of updated data
	 * @memberof Wildfire
	 */
	static async setFlamableDrawings() {
		const drawings = canvas.drawings.controlled;
		if (drawings.length < 1) return;

		const data = drawings.map(d => ({ "_id": d.id, "flags.wildfire.flamable": true }));
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
		const box = new PIXI.Rectangle(x, y, this.gridSize, this.gridSize);
		return this.fires.some(t => box.contains(t.x, t.y))
	}

	/**
	* Checks whether or not the cell can be set on fire.
	*
	* @param {[number, number]} cell - The [row, col] location of this cell on the grid
	* @return {Boolean} True if the cell can be set on fire
	* @memberof Wildfire
	*/
	isFlamable(cell) {
		if (this.isBurning(cell)) return false;

		return true;
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
		if (!this.isFlamable(cell)) return;
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
		this.newFires = [];

		return;
	}
}

async function spreadFire() {
	await new Wildfire(_token).spread({
		formula: "1d8",
		target: 8
	});
}