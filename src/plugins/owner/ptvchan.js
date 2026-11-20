/**
 * ptvchan.js — .ptvchan — send a round (PTV) video to the NEXORA channel.
 *
 * Ported from LUNA MD plugins/ptvchan.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; owner gating via permissions.
 *   - The hardcoded LUNA channel id is GONE. The channel comes from the NexoraFlex channel store —
 *     `getChannelContext()` in src/lib/channelPromo.js, which reads
 *     settings.channelId / settings.channelName set by `.setchannel
 *     <...@newsletter>` (fallback: the default NEXORA Updates channel).
 *     Run `.setchannel` first if the video lands on the wrong channel.
 *   - The original's `readFileSync('./config.js')` + regex scrape for
 *     a channel block is gone — that file doesn't exist here.
 *   - `m.chat` -> `m.from`; quoted-video download uses the house
 *     `m.quoted.download()` pattern (see media/sticker.js).
 *   - Reactions go through `m.react` instead of a raw sendMessage react.
 *   - "© 2026 LUNA MD | MOONSON" footer -> NEXORA MD.
 */
import { getChannelContext } from '../../lib/channelPromo.js';

export default {
  name: 'ptvchan',
  aliases: ['ptvch', 'ptvchanel'],
  category: 'owner',
  description: 'Send a round PTV video to the NEXORA channel. Usage: reply to a video with .ptvchan',
  permissions: { owner: true },
  cooldown: 5000,
  execute: async ({ m, sock, prefix }) => {
    const q = m.quoted || m;
    const mime = q.msg?.mimetype || q.mimetype || q.mediaType || '';
    if (!/video/.test(mime)) {
      return await m.reply(
        `⚠️ *How to Use PTV Channel*\n\nReply to a video with the command:\n*${prefix || '.'}ptvchan*\n\nExample: reply to a video with \`${prefix || '.'}ptvchan\``
      );
    }

    const channel = getChannelContext();
    if (!channel?.jid) {
      return await m.reply.error('No channel set. Run `.setchannel <...@newsletter>` first, then try again.');
    }

    await m.reply('⏳ _Sending round PTV to the Channel..._');
    try {
      const videoBuffer = await q.download();
      if (!videoBuffer) throw new Error('Download failed');

      await sock.sendMessage(channel.jid, {
        video: videoBuffer,
        mimetype: 'video/mp4',
        ptv: true,
      });

      await m.react('✅');
      return await m.reply(`✅ *Success!*\nRound PTV sent to the Channel\n${channel.name || channel.jid}\nID: ${channel.jid}\n\n© 2026 NEXORA MD`);
    } catch (e) {
      console.error('[ptvchan]', e);
      try { await m.react('❌'); } catch (_) {}
      return await m.reply(`❌ *Failed!*\n\nMake sure the bot is an ADMIN of the Channel.\nError: ${e.message}`);
    }
  },
};
