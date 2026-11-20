/**
 * quoted.js — .quoted / .q — forward the message that the message you
 * replied to was itself replying to (the "quoted of the quoted").
 *
 * Ported from LUNA MD plugins/tools-sendquoted.js.
 *
 * Differences from the original:
 *   - The original used `m.getQuotedObj()` + `copyNForward`, which do not
 *     exist on NexoraFlex's serialized messages. This version finds the
 *     inner quoted message by probing the shapes NexoraFlex's serializer
 *     actually produces (`m.quoted.quoted`, or the `contextInfo.
 *     quotedMessage` nested inside the quoted message's own content), then
 *     forwards it with the Baileys socket's `copyNForward`, rebuilding a
 *     minimal WAMessage (key + message) from the stanza id / participant
 *     in that same contextInfo.
 *   - If the inner message cannot be resolved to a forwardable stanza
 *     (some serializers strip the inner quote), it falls back to sending
 *     the inner message's text, if any can be read; otherwise it says so
 *     instead of throwing a raw error.
 *   - `m.chat` -> `m.from`; the two "throw" usage errors are replies.
 *
 * Honest caveat: the inner-quote shape is probed at runtime because
 * NexoraFlex's serializer does not document it — the forward path is
 * best-effort and the text fallback covers the common (text) case.
 */
function innerText(msg) {
  if (!msg || typeof msg !== 'object') return null;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    null
  );
}

function findInnerQuote(q) {
  if (!q) return null;
  // 1. Serializer nested it directly.
  if (q.quoted) return { proto: q.quoted?.message ?? q.quoted, ctx: q.quoted?.contextInfo };
  // 2. Raw proto: the quoted message's own content carries a contextInfo
  //    whose quotedMessage is the message IT was replying to.
  const content = q.message;
  if (content && typeof content === 'object') {
    for (const key of Object.keys(content)) {
      const node = content[key];
      const ci = node?.contextInfo;
      if (ci?.quotedMessage) return { proto: ci.quotedMessage, ctx: ci };
    }
  }
  // 3. contextInfo attached directly on the serialized quoted object.
  if (q.contextInfo?.quotedMessage) return { proto: q.contextInfo.quotedMessage, ctx: q.contextInfo };
  return null;
}

export default {
  name: 'quoted',
  aliases: ['q'],
  category: 'utility',
  description: 'Forward the message that your replied-to message was replying to. Reply to a reply, then .quoted',
  cooldown: 2000,
  execute: async ({ m, sock }) => {
    if (!m.quoted) return m.reply('Reply to a message!');
    const inner = findInnerQuote(m.quoted);
    if (!inner) return m.reply('The message you replied to does not contain a reply!');

    // Preferred path: forward the real stanza so media/quotes survive.
    const stanzaId = inner.ctx?.stanzaId || inner.ctx?.quotedMessage?.stanzaId;
    const participant = inner.ctx?.participant;
    if (stanzaId && typeof sock.copyNForward === 'function') {
      try {
        await sock.copyNForward(
          m.from,
          {
            key: { remoteJid: m.from, fromMe: false, id: stanzaId, ...(participant ? { participant } : {}) },
            message: inner.proto,
          },
          true
        );
        return;
      } catch (e) {
        console.warn('[quoted] copyNForward failed, falling back to text:', e?.message);
      }
    }

    // Fallback: re-send the inner text, if it can be read.
    const text = innerText(inner.proto);
    if (text) {
      await sock.sendMessage(m.from, { text }, { quoted: m });
      return;
    }
    return m.reply('Could not forward that inner message (its content could not be read).');
  },
};
