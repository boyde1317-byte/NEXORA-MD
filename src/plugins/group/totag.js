/**
 * totag.js — forward a quoted message and mention every member on it.
 *
 * Ported from Rem Bot's group-totag.js. Their version forwarded m.quoted.fakeObj
 * with a mentions array; we rebuild the forward through Baileys' forward API so
 * the quoted payload survives the trip, and we cap the mention list so a 1000
 * member group cannot blow the node size limit.
 */
export default {
  name: 'totag',
  aliases: ['mentionall'],
  category: 'group',
  description: 'Reply to a message with .totag to forward it while mentioning everyone.',
  cooldown: 3000,
  permissions: { groupOnly: true, admin: true },
  execute: async ({ sock, m }) => {
    if (!m.quoted) return await m.reply.error('Reply to the message you want to tag everyone on.');
    const metadata = await m.getGroupMetadata().catch(() => null);
    if (!metadata) return await m.reply.error('Could not read the participant list.');

    const mentions = metadata.participants.map(p => p.id).filter(Boolean).slice(0, 500);
    const chat = m.chat || m.from;
    try {
      await sock.sendMessage(chat, {
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
