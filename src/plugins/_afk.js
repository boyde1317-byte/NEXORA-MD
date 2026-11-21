/* global conn */
// ── INERT FRAMEWORK HOOK (staged from LUNA MD, NexoraFlex format) ──────────
// LUNA MD "before"/"all" hook: in the old framework this ran on every message.
// In NexoraFlex it is INERT: the loader (src/core/client.js) only registers a
// plugin whose default export is an object with a string `name` and an
// `execute` function, and the dispatcher (src/core/message.js) never calls
// plugin `before`/`all` hooks. Staged as-is for future porting; do not expect
// it to run until it is rewritten as a NexoraFlex command plugin.
// Expected loader outcome: SKIPPED — no default export (named `before` export only).
//   Loader warns: [PLUGIN WARN] Skipping _afk.js: No default export found
export function before(m) {
	let user = global.db.data.users[m.sender];
	if (user?.afk > -1) {
		m.reply(
			`
${conn.getName(m.sender)} stopped being AFK${user.afkReason ? ' after ' + user.afkReason : ''}
For ${(new Date() - user.afk).toTimeString()}
  `.trim()
		);
		user.afk = -1;
		user.afkReason = '';
	}
	let jids = [...new Set([...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])])];
	for (let jid of jids) {
		let user = global.db.data.users[jid];
		if (!user) continue;
		let afkTime = user.afk;
		if (!afkTime || afkTime < 0) continue;
		let reason = user.afkReason;
		m.reply(
			`
${conn.getName(m.sender)} Don't tag them!
They are AFK ${reason ? 'with the reason ' + reason : 'without a reason'}
For ${(new Date() - afkTime).toTimeString()}
  `.trim()
		);
	}
	return true;
}
