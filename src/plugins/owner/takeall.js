/**
 * @file src/plugins/owner/takeall.js
 *
 * .takeall — bundle every sticker found in this group's cached history
 * into a single WhatsApp sticker pack, named "nexora" in styled font.
 *
 * How it works:
 *   1. Scans the in-memory message store (last ~500 messages per chat,
 *      see connection.js) for sticker messages — including stickers inside
 *      documentWithCaptionMessage envelopes.
 *   2. Dedupes by fileSha256 (falls back to mediaKey), downloads each
 *      unique sticker via downloadMediaMessage.
 *   3. Sends one stickerPackMessage via the fork's native pack support
 *      ({ stickers, cover, name, publisher, description }) — max 60.
 *
 * The pack name is rendered with toSmallcaps ('nexora' → 'ɴᴇxᴏʀᴀ'), the
 * same styled font used for menu captions.
 *
 * Limits: only stickers since the bot's session cache (or the last 500
 * messages) are available — Baileys cannot back-search full server-side
 * history. Cap is 60 stickers per pack (WhatsApp hard limit).
 */

import { downloadMediaMessage } from 'baileys';
import { toSmallcaps } from '../../lib/smallcaps.js';

const MAX_PACK = 60; // fork/WhatsApp hard limit for stickerPackMessage

const stickerHash = (stickerMsg) => {
  const raw = stickerMsg?.fileSha256 ?? stickerMsg?.mediaKey ?? null;
  if (!raw) return null;
  return Buffer.isBuffer(raw) ? raw.toString('base64') : String(raw);
};

export default {
  name: 'takeall',
  aliases: ['packall', 'stealpack'],
  category: 'owner',
  description: 'Bundle all stickers in this group into a sticker pack named nexora (styled font).',
  permissions: {
    owner: true,
  },
  cooldown: 10000,
  execute: async ({ sock, m, prefix }) => {
    const p = prefix || '.';

    if (!m.isGroup) {
      return await m.reply.info('This command only works in a group.', '.TAKEALL');
    }

    const store = sock.opts?.messageStore;
    const chatMsgs = store?.get(m.from);
    if (!chatMsgs || chatMsgs.size === 0) {
      return await m.reply.info(
        'No cached messages for this group yet. Stickers are collected from the bot\u2019s live message cache \u2014 send or quote some stickers first, then try again.',
        '.TAKEALL'
      );
    }

    // 1. Collect unique sticker messages from the group's cached history
    const seen = new Set();
    const stickerMessages = [];
    for (const msg of chatMsgs.values()) {
      const stickerMsg =
        msg?.message?.stickerMessage ??
        msg?.message?.documentWithCaptionMessage?.message?.stickerMessage ??
        null;
      if (!stickerMsg) continue;

      const hash = stickerHash(stickerMsg);
      if (hash) {
        if (seen.has(hash)) continue;
        seen.add(hash);
      }
      stickerMessages.push({ msg, stickerMsg });
    }

    if (stickerMessages.length === 0) {
      return await m.reply.info(
        'No stickers found in the cached history of this group (last ~500 messages).',
        '.TAKEALL'
      );
    }

    const truncated = stickerMessages.length > MAX_PACK;
    const toFetch = stickerMessages.slice(0, MAX_PACK);

    const status = await m.reply.info(
      `Collecting ${toFetch.length} sticker${toFetch.length > 1 ? 's' : ''} into pack *${toSmallcaps('nexora')}\u2026*`,
      '.TAKEALL'
    );

    // 2. Download each sticker
    const buffers = [];
    let failed = 0;
    for (const { msg } of toFetch) {
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
          logger: () => {},
          reuploadRequest: sock.updateMediaMessage,
        });
        if (buffer && buffer.length > 0) buffers.push(buffer);
        else failed++;
      } catch (_) {
        failed++;
      }
    }

    if (buffers.length === 0) {
      return await m.reply.error(
        'All sticker downloads failed \u2014 they may be expired media. Ask someone to re-send a sticker and try again.'
      );
    }

    // 3. Send the sticker pack via the fork's native support
    //    ({ stickers, cover, name, publisher, description } → stickerPackMessage)
    try {
      await sock.sendMessage(m.from, {
        stickers: buffers.map((buf) => ({ data: buf })),
        cover: buffers[0],
        name: toSmallcaps('nexora'),
        publisher: 'NEXORA-MD',
        description: `All stickers from the group • ${buffers.length} stickers`,
      });

      if (status?.key?.id) {
        await sock.sendMessage(m.from, { delete: status.key });
      }

      let summary = `Sticker pack *${toSmallcaps('nexora')}* sent with ${buffers.length} sticker${buffers.length > 1 ? 's' : ''} \u2713`;
      if (failed > 0) summary += `\n\u26a0\ufe0f ${failed} sticker${failed > 1 ? 's' : ''} could not be downloaded (expired media)`;
      if (truncated) summary += `\n\u26a0\ufe0f Capped at ${MAX_PACK} (WhatsApp pack limit) \u2014 ${stickerMessages.length} unique stickers were found`;
      summary += `\n_Tap the pack card and hit *Add to favorites* to save it._`;
      await m.reply.success(summary);
    } catch (err) {
      console.error('[TAKEALL] Failed to send sticker pack:', err);
      await m.reply.error('Sticker pack send failed: ' + (err?.message || err));
    }
  },
};
