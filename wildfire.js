async function spreadFire() {
	const fire = canvas.tokens.objects.children.filter(t => t.data.name == "Fire");
	const newFires = [];

	for (let t of fire) {
		const s = canvas.grid.grid.w;
		const [r, c] = canvas.grid.grid.getGridPositionFromPixels(t.x, t.y);
		const neighbors = canvas.grid.grid.getNeighbors(r, c);
		const notBurning = neighbors.filter(n => {
			const [x, y] = canvas.grid.grid.getPixelsFromGridPosition(n[0], n[1]);
			const box = new PIXI.Rectangle(x, y, s, s);
			return !canvas.tokens.objects.children.some(t =>
				box.contains(t.x, t.y) && t.data.name == "Fire"
			)
		})
		notBurning.forEach(s => {
			if (new Roll("1d6").roll().total > 4) {
				const [x, y] = canvas.grid.grid.getPixelsFromGridPosition(s[0], s[1]);
				const tkn = duplicate(t.data);
				tkn.x = x; tkn.y = y;
				newFires.push(tkn);
			}
		})
	}

	canvas.tokens.createMany(newFires);
}