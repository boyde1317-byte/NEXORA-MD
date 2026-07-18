/**
 * kick.js — Remove a group participant.
 *
 * Upgraded: uses actionCard confirmation after removal with related
 * admin-action follow-up buttons.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { actionCard } from '../../lib/interactiveKit.js';

export default {
  name: 'kick',
  aliases: ['remove', 'k'],
  category: 'group',
  description: 'Removes a participant from the group.',
  permissions: {
    groupOnly: true,
    admin: true,
    botAdmin: true
  },
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    let target = '';

    if (m.quoted) {
      target = m.quoted.sender;
    } else if (m.msg?.contextInfo?.mentionedJid?.length) {
      target = m.msg.contextInfo.mentionedJid[0];
    } else if (args[0]) {
      const cleanNum = args[0].replace(/[^0-9]/g, '');
      if (cleanNum) target = `${cleanNum}@s.whatsapp.net`;
    }

    if (!target) {
      return await m.reply.error(
        'Please reply to a member\'s message, mention them using @, or provide their phone number.'
      );
    }

    const targetNumber = target.split('@')[0];

    if (target === sock.user.id.split(':')[0] + '@s.whatsapp.net') {
      return await m.reply.error('Nice try, but I won\'t kick myself.');
    }

    await withReactionStatus(m, async () => {
      await sock.groupParticipantsUpdate(m.from, [target], 'remove');

      // ── Tier 1: actionCard confirmation ────────────────────────────────
      try {
        return await actionCard(sock, m.from, {
          text:   `🚫 *@${targetNumber}* has been removed from the group.`,
          footer: 'NEXORA Guard • Group Management',
        }, [
          { label: '⚠️  Warn Next Member',   cmd: `${p}warn` },
          { label: '🔇 Mute Group',           cmd: `${p}mute` },
          { label: '📋 Group Info',           cmd: `${p}groupinfo` },
        ], { quoted: m, mentions: [target] });
      } catch (_) {
        // Tier 2: plain reply
        await m.reply(`✅ Successfully removed *@${targetNumber}* from the group.`, {
          mentions: [target]
        });
      }
    });
  }
};
