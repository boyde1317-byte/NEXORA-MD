/**
 * tag.js — .tag — forward a quoted message and mention everyone on it.
 *
 * Ported from luna-md/plugins/group-totag.js, using the file's own
 * alternative command `tag` (`.totag` stays with NexoraFlex's
 * group/totag.js). The forward is rebuilt through the house pattern
 * from NX totag.js (forward: { key, message }) instead of the LUNA
 * original's m.quoted.fakeObj, and the bot itself is excluded from the
 * mention list. Group + admin only.
 */

export default {
  name: 'tag',
  aliases: [],
  category: 'group',
  description: 'Reply to a message with .tag to forward it while mentioning everyone.',
  permissions: { groupOnly: true, admin: true },
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    if (!m.quoted) return await m.reply.error('✳️ Reply to a message');
    const metadata = await m.getGroupMetadata().catch(() => sock.groupMetadata(m.from).catch(() => null));
    if (!metadata) return await m.reply.error('Could not read the participant list.');

    const botJid = sock.user?.id?.split(':')[0];
    const mentions = metadata.participants
      .map((p) => p.id)
      .filter(Boolean)
      .filter((id) => !botJid || !id.startsWith(`${botJid}@`))
      .slice(0, 500);

    try {
      await sock.sendMessage(m.from, {
        forward: {
          key: m.quoted.key,
          message: m.quoted.message ?? m.quoted.msg,
        },
        mentions,
      });
    } catch (err) {
      return await m.reply.error(`Forward failed: ${err.message}`);
    }
    return true;
  },
};
