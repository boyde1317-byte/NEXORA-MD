// ── INERT FRAMEWORK HOOK (staged from LUNA MD, NexoraFlex format) ──────────
// LUNA MD "before"/"all" hook: in the old framework this ran on every message.
// In NexoraFlex it is INERT: the loader (src/core/client.js) only registers a
// plugin whose default export is an object with a string `name` and an
// `execute` function, and the dispatcher (src/core/message.js) never calls
// plugin `before`/`all` hooks. Staged as-is for future porting; do not expect
// it to run until it is rewritten as a NexoraFlex command plugin.
// Expected loader outcome: SKIPPED — default export is a bare function with no
//   `.command`, so adaptLegacyHandler() returns it unchanged; typeof is 'function',
//   not 'object', so the loader warns: [PLUGIN WARN] Skipping _durability.js: No default export found
let handler = (m) => m;

handler.before = async function (m) {
	let user = db.data.users[m.sender];

	//Sword
	if (user.sword > 0) {
		if (user.sworddurability < 1) {
			user.sworddurability = 30;
			user.sword -= 1;
		}
	}
	if (user.sword == 0) {
		user.sworddurability = 0;
	}

	//pickaxe
	if (user.pickaxe > 0) {
		if (user.pickaxedurability < 1) {
			user.pickaxedurability = 30;
			user.pickaxe -= 1;
		}
	}
	if (user.pickaxe == 0) {
		user.pickaxedurability = 0;
	}

	//armor
	if (user.armor > 0) {
		if (user.armordurability < 1) {
			user.armordurability = 30;
			user.armor -= 1;
		}
	}
	if (user.armor == 0) {
		user.armordurability = 0;
	}
	//health
	if (user.health > 100) {
		user.health = 100;
	}
	if (user.health < 0) {
		user.health = 0;
	}
};
export default handler;
