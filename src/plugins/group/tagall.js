/**
 * tagall.js — tag all group members with a message.
 *
 * Sends the @-mention announcement, then a nativeFlow follow-up card
 * with group management quick_reply buttons so admins can take action fast.
 */
import { withReactionStatus, getBrandThumbnail } from '../../lib/cosmetics.js';
import { actionCardWithAd } from '../../lib/interactiveKit.js';

export default {
  name: 'tagall',
  aliases: ['everyone', 'all', 'announce'],
  category: 'group',
  description: 'Mentions all participants in the group with an optional message.',
  permissions: { groupOnly: true, admin: true },
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    await withReactionStatus(m, async () => {
      const metadata = await m.getGroupMetadata();
      if (!metadata) {
        return await m.reply.error('Could not retrieve group participant list.');
      }

      const participants    = metadata.participants;
      const mentions        = participants.map(p => p.id);
      const customMessage   = args.join(' ') || 'Attention everyone!';

      let tagText = `📢 *${customMessage}*\n\n`;
      participants.forEach(p => { tagText += `@${p.id.split('@')[0]} `; });
      tagText += `\n\n_Tagged: ${participants.length} member${participants.length !== 1 ? 's' : ''}_`;

      // ── Single message: @-mention announcement + branded thumbnail +
      //    admin action buttons, all in one card ────────────────────────────
      const thumbnail = await getBrandThumbnail();
      try {
        await actionCardWithAd(sock, m.from, {
          text:   `${tagText}\n\n✅ *${participants.length} members tagged.*\n\nWhat would you like to do next?`,
          footer: `${metadata.subject || 'Group'} Admin Panel`,
        }, [
          { label: '🔇 Mute Group',     cmd: `${p}mute` },
          { label: '🔔 Unmute Group',   cmd: `${p}unmute` },
          { label: '📋 Group Info',     cmd: `${p}groupinfo` },
          { label: '🚫 Close Invites',  cmd: `${p}closeinvite` },
          { label: '📢 Tag Again',      cmd: `${p}tagall ${customMessage}` },
        ], {
          title:        '📢 GROUP ANNOUNCEMENT',
          body:         metadata.subject || 'Attention everyone!',
          thumbnail,
          mentionedJid: mentions,
        }, { mentions, quoted: m });
      } catch (_) {
        // Cosmetic card failed — the mentions must still go out.
        await sock.sendMessage(m.from, { text: tagText, mentions }, {});
      }
    });
  },
};
