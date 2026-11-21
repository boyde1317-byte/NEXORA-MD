/* global appenTextMessage baileys */
// ── INERT FRAMEWORK HOOK (staged from LUNA MD, NexoraFlex format) ──────────
// LUNA MD "before"/"all" hook: in the old framework this ran on every message.
// In NexoraFlex it is INERT: the loader (src/core/client.js) only registers a
// plugin whose default export is an object with a string `name` and an
// `execute` function, and the dispatcher (src/core/message.js) never calls
// plugin `before`/`all` hooks. Staged as-is for future porting; do not expect
// it to run until it is rewritten as a NexoraFlex command plugin.
// Expected loader outcome: SKIPPED — no default export (named `all` export only).
//   Loader warns: [PLUGIN WARN] Skipping _templateResponse.js: No default export found
export async function all(m, chatUpdate) {
	if (m.isBaileys) return;
	if (!m.message) return;
	if (!(m.message.buttonsResponseMessage || m.message.templateButtonReplyMessage || m.message.listResponseMessage || m.message.interactiveResponseMessage || m.message.pollUpdateMessage)) return;

	let id =
		m.mtype === 'conversation'
			? m.message.conversation
			: m.mtype == 'imageMessage'
				? m.message.imageMessage.caption
				: m.mtype == 'videoMessage'
					? m.message.videoMessage.caption
					: m.mtype == 'extendedTextMessage'
						? m.message.extendedTextMessage.text
						: m.mtype == 'buttonsResponseMessage'
							? m.message.buttonsResponseMessage.selectedButtonId
							: m.mtype == 'listResponseMessage'
								? m.message.listResponseMessage.singleSelectReply.selectedRowId
								: m.mtype == 'templateButtonReplyMessage'
									? m.message.templateButtonReplyMessage.selectedId
									: m.mtype == 'interactiveResponseMessage'
										? JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson).id
										: m.mtype == 'templateButtonReplyMessage'
											? appenTextMessage(m.msg.selectedId, chatUpdate)
											: m.mtype === 'messageContextInfo'
												? m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text
												: '';

	let messages = await baileys.generateWAMessage(
		m.chat,
		{ text: id, mentions: m.mentionedJid },
		{
			userJid: this.user.jid,
			quoted: m.quoted && m.quoted.fakeObj,
		}
	);
	messages.key.remoteJid = m.chat;
	messages.key.fromMe = baileys.areJidsSameUser(m.sender, this.user.id);
	messages.key.id = m.key.id;
	messages.pushName = m.pushName;
	if (m.isGroup) messages.key.participant = messages.participant = m.sender;
	let msg = {
		...chatUpdate,
		messages: [baileys.proto.WebMessageInfo.create(messages)].map((v) => ((v.conn = this), v)),
		type: 'append',
	};
	this.ev.emit('messages.upsert', msg);
}
