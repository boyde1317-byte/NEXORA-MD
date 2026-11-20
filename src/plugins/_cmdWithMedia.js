// ── INERT FRAMEWORK HOOK (staged from LUNA MD, NexoraFlex format) ──────────
// LUNA MD "before"/"all" hook: in the old framework this ran on every message.
// In NexoraFlex it is INERT: the loader (src/core/client.js) only registers a
// plugin whose default export is an object with a string `name` and an
// `execute` function, and the dispatcher (src/core/message.js) never calls
// plugin `before`/`all` hooks. Staged as-is for future porting; do not expect
// it to run until it is rewritten as a NexoraFlex command plugin.
// Expected loader outcome: SKIPPED — no default export (named `all` export only).
//   Loader warns: [PLUGIN WARN] Skipping _cmdWithMedia.js: No default export found
export async function all(m, chatUpdate) {
	if (m.isBaileys) return;
	if (!m.message) return;
	if (!m.msg?.fileSha256) return;
	let hash = Buffer.from(m.msg.fileSha256).toString('base64');
	if (!(hash in global.db.data.sticker)) return;

	let { text, mentionedJid } = global.db.data.sticker[hash];
	let messages = await baileys.generateWAMessage(
		m.sender,
		{ text: text, mentions: mentionedJid },
		{
			userJid: this.user.jid,
			quoted: m.quoted && m.quoted.fakeObj,
		}
	);
	messages.key.remoteJid = m.chat;
	messages.key.fromMe = baileys.areJidsSameUser(m.chat, this.user.id);
	messages.key.id = m.key.id;
	messages.pushName = m.pushName;
	if (m.isGroup) messages.key.participant = m.sender;
	let msg = {
		...chatUpdate,
		messages: [baileys.proto.WebMessageInfo.create(messages)],
		type: 'append',
	};
	this.ev.emit('messages.upsert', msg);
}
