/* global db */
// ── INERT FRAMEWORK HOOK (staged from LUNA MD, NexoraFlex format) ──────────
// LUNA MD "before"/"all" hook: in the old framework this ran on every message.
// In NexoraFlex it is INERT: the loader (src/core/client.js) only registers a
// plugin whose default export is an object with a string `name` and an
// `execute` function, and the dispatcher (src/core/message.js) never calls
// plugin `before`/`all` hooks. Staged as-is for future porting; do not expect
// it to run until it is rewritten as a NexoraFlex command plugin.
// Expected loader outcome: SKIPPED — default export is a bare function with no
//   `.command`, so adaptLegacyHandler() returns it unchanged; typeof is 'function',
//   not 'object', so the loader warns: [PLUGIN WARN] Skipping _premium.js: No default export found
let handler = (m) => m;

handler.before = async function (m) {
	let user = db.data.users[m.sender];
	if (new Date() - user.premiumTime > 0) {
		user.premiumTime = 0;
		user.premium = false;
	}
};

export default handler;
