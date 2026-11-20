/**
 * readviewonce.js — .readviewonce / .read / .rvo — reveal a view-once message.
 *
 * Ported from LUNA MD plugins/tools-readviewonce.js. The original read the
 * quoted message's viewOnce flag through m.quoted.mediaMessage and
 * m.getQuotedObj(); NexoraFlex serializes the quoted message as
 * m.quoted.message with the viewOnceMessage / viewOnceMessageV2 envelope
 * (possibly wrapped in ephemeralMessage), and media downloads via
 * m.quoted.download() — the same unwrap shape the house media/viewonce.js
 * plugin uses.
 *
 * No owner/admin gate in the original and none added here: in DMs anyone
 * can use it; the audience is the chat itself.
 *
 * Note: the house already ships media/viewonce.js (.vv / .reveal /
 * .readonce) doing the same job with a group admin gate. This is the LUNA
 * variant under its own name.
 */
const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];

/** Walk up to 4 envelope layers to find the view-once inner media. */
function unwrapViewOnce(message) {
  let node = message;
  for (let depth = 0; node && depth < 4; depth++) {
    const type = node ? Object.keys(node)[0] : '';
    const inner = node?.[type];
    if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2') {
      const content = inner?.message;
      if (!content) return null;
      for (const t of MEDIA_TYPES) {
        if (content[t]) return { type: t, msg: content[t] };
      }
      return null;
    }
    if (type === 'ephemeralMessage') {
      node = inner?.message;
      continue;
    }
    return null;
  }
  return null;
}

export default {
  name: 'readviewonce',
  aliases: ['read', 'rvo'],
  category: 'media',
  description: 'Reveal a view-once photo/video: reply to it with .readviewonce.',
  cooldown: 5000,
  execute: async ({ m, sock }) => {
    if (!m.quoted) {
      return await m.reply('Reply to the image/video you want to view.');
    }
    const found = unwrapViewOnce(m.quoted.message || {});
    if (!found) {
      return await m.reply('This is not a view-once message.');
    }
    await m.react('⏳');
    try {
      const media = await m.quoted.download();
      if (!media || !media.length) {
        await m.react('❌');
        return await m.reply.error('Failed to download the media — it may have expired from WhatsApp servers.');
      }
      const caption = found.msg?.caption || '';
      let payload;
      if (found.type === 'imageMessage') payload = { image: media, caption };
      else if (found.type === 'videoMessage') payload = { video: media, caption };
      else if (found.type === 'audioMessage') payload = { audio: media, mimetype: found.msg?.mimetype || 'audio/mp4', ptt: found.msg?.ptt || false };
      else if (found.type === 'stickerMessage') payload = { sticker: media };
      else payload = { document: media, mimetype: found.msg?.mimetype || 'application/octet-stream', fileName: found.msg?.fileName || 'viewonce', caption };
      await sock.sendMessage(m.from, payload, { quoted: m });
      await m.react('👁️');
    } catch (err) {
      await m.react('❌');
      await m.reply.error(`Could not reveal the media: ${err.message}`);
    }
  },
};
