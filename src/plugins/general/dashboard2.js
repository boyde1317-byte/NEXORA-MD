/**
 * dashboard2.js — .dashboard2 — command usage leaderboard.
 *
 * Ported from the LUNA MD info-dashboard plugin (luna-md/plugins/
 * info-dashboard.js). The LUNA original read per-plugin stats out of
 * db.data.stats ({ total, success, last, lastSuccess } per plugin key).
 * NexoraFlex does not keep that shape: the dispatcher
 * (src/handlers/message.js) only tallies db.data.stats.commandsUsed,
 * a { commandName: hits } map. So this port ranks commands by hits
 * alone — there is no success/last-used data to show, and none is
 * invented. Command descriptions come from the live client.commands
 * registry instead of a global.plugins object (which NexoraFlex
 * does not have).
 *
 * Why dashboard2 and not dashboard: NexoraFlex already ships
 * src/plugins/group/dashboard.js (.dashboard, group stats), so this
 * one stays separate and the existing command is untouched.
 */
export default {
  name: 'dashboard2',
  aliases: ['dash2'],
  category: 'general',
  description: 'Top 50 most-used commands by hit count.',
  cooldown: 3000,
  execute: async ({ m, db, client }) => {
    const used = db?.data?.stats?.commandsUsed || {};
    const entries = Object.entries(used)
      .map(([name, total]) => ({ name, total: Number(total) || 0 }))
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total);

    if (!entries.length) {
      return m.reply('No command usage recorded yet. Run a few commands and try again.');
    }

    const totalHits = entries.reduce((sum, e) => sum + e.total, 0);
    const lines = entries.slice(0, 50).map(({ name, total }, i) => {
      const plugin = client?.commands?.get(name);
      const label = plugin?.description
        ? String(plugin.description).split('\n')[0].slice(0, 60)
        : name;
      return `*${i + 1}.* *${name}*\n - *Hits* : ${total}\n - *About* : ${label}`;
    });

    await m.reply(
      `乂 *NEXORA MD — COMMAND DASHBOARD*\n\n` +
      `*Total command runs:* ${totalHits}\n` +
      `*Commands tracked:* ${entries.length}\n\n` +
      lines.join('\n\n')
    );
  },
};
