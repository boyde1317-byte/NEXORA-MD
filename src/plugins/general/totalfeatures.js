/**
 * totalfeatures.js — .totalfeatures — how many commands the bot has.
 *
 * Ported from the LUNA MD info-totalfitur plugin
 * (luna-md/plugins/info-totalfitur.js). The original counted
 * Object.values(global.plugins) and sent it as an ad-reply card with a
 * local thumbnail and the title 'Total My Love For You'. NexoraFlex has
 * no global.plugins — the registry is client.commands — so the count
 * comes from there, and the reply is plain text: no local thumbnail
 * file to read and no leftover pet-name title.
 */
import { buildCategoryIndex } from '../../lib/commandDirectory.js';

export default {
  name: 'totalfeatures',
  aliases: [],
  category: 'general',
  description: 'Show the total number of NEXORA MD features (commands).',
  cooldown: 3000,
  execute: async ({ m, client }) => {
    const total = client?.commands?.size || 0;
    const byCat = buildCategoryIndex();
    const breakdown = [...byCat.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat, cmds]) => `• ${cat}: ${cmds.length}`)
      .join('\n');

    await m.reply(
      `乂 *NEXORA MD — FEATURES*\n\n` +
      `*Total bot features right now: ${total}*\n` +
      `*Categories: ${byCat.size}*\n\n` +
      (breakdown || 'No commands loaded.')
    );
  },
};
