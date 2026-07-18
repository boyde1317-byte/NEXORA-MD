/**
 * promote.js — Promote a group participant to admin.
 *
 * Upgraded: uses actionCard confirmation after promotion with follow-up
 * admin management buttons.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { actionCard } from '../../lib/interactiveKit.js';

export default {
  name: 'promote',
  aliases: ['admin', 'pm'],
  category: 'group',
  description: 'Promotes a group participant to Group Admin.',
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
        'Please reply to a message, @mention a user, or supply their number to promote.'
      );
    }

    const targetNumber = target.split('@')[0];

    await withReactionStatus(m, async () => {
      await sock.groupParticipantsUpdate(m.from, [target], 'promote');

      // ── Tier 1: actionCard confirmation ─────────────────────────────────
      try {
        return await actionCard(sock, m.from, {
          text:   `⬆️ *@${targetNumber}* has been promoted to Group Admin.`,
          footer: 'NEXORA Guard • Group Management',
        }, [
          { label: '⬇️  Demote Again',     cmd: `${p}demote @${targetNumber}` },
          { label: '🚫 Remove Member',     cmd: `${p}kick` },
          { label: '📋 Group Info',        cmd: `${p}groupinfo` },
        ], { quoted: m, mentions: [target] });
      } catch (_) {
        // Tier 2: plain reply
        await m.reply(`✅ *@${targetNumber}* has been successfully promoted to Admin!`, {
          mentions: [target]
        });
      }
    });
  }
};
