import { withReactionStatus } from '../../lib/cosmetics.js';

export default {
  name: 'grouplink',
  aliases: ['invitelink', 'invite', 'link'],
  category: 'group',
  description: 'Gets or resets the group invite link. Use `!grouplink reset` to revoke and generate a new one.',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    const doReset = args[0]?.toLowerCase() === 'reset' || args[0]?.toLowerCase() === 'revoke';

    await withReactionStatus(m, async () => {
      if (doReset) {
        await sock.groupRevokeInvite(m.from);
        await m.reply.success('Old invite link revoked! Generating new link...');
      }

      const code = await sock.groupInviteCode(m.from);
      if (!code) throw new Error('Could not retrieve invite link. Make sure I am a group admin.');

      const link = `https://chat.whatsapp.com/${code}`;
      const text = `🔗 *Group Invite Link*\n\n${link}\n\n_Tap to join • Share responsibly_${doReset ? '\n\n♻️ _This is a new link — the old one has been revoked._' : ''}`;
      await m.reply(text);
    });
  }
};
