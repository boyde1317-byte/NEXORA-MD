/**
 * addai.js — .addai — add the AI bot to this group.
 *
 * Ported from the LUNA MD plugins/addai.js, as-is.
 *
 * The bot JID in the original ("867051314767696@bot") is LUNA-specific,
 * so it is replaced by the clearly-marked placeholder below. Put the
 * AI bot's own JID there (the `@bot` JID of the AI assistant account
 * that should be added to groups) before using this command — with the
 * placeholder in place the add will fail.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `conn` -> `sock`,
 *     `m.chat` -> `m.from`.
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
// TODO (operator): put the AI bot's JID here, e.g. '123456789012345@bot'.
// The LUNA original used its own AI bot's JID; that value is not valid
// for NEXORA MD, so this ships as a placeholder on purpose.
const AI_BOT_JID = 'YOUR_AI_BOT_JID_HERE@bot';

export default {
  name: 'addai',
  aliases: [],
  category: 'general',
  description: 'Add the AI bot to this group. Usage: .addai (group only)',
  cooldown: 5000,
  execute: async ({ m, sock }) => {
    try {
      const groupJid = m.from;

      if (!groupJid.endsWith('@g.us')) {
        return await m.reply('This command only works in a group.');
      }

      if (!AI_BOT_JID || AI_BOT_JID.startsWith('YOUR_AI_BOT_JID_HERE')) {
        return await m.reply(
          '⚠️ The AI bot JID is not configured yet.\n' +
          'Set AI_BOT_JID at the top of src/plugins/general/addai.js to the AI bot\'s @bot JID first.',
        );
      }

      await sock.groupParticipantsUpdate(groupJid, [AI_BOT_JID], 'add');

      await m.reply('AI has been added 🫤');
    } catch (e) {
      console.error('[addai]', e);
      await m.reply(String(e?.stack || e));
    }
  },
};
