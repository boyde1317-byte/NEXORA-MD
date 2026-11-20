/**
 * restart2.js — owner-only restart (second variant).
 *
 *   .restart2        hot-reload all plugins (no connection loss)
 *   .restart2 hard   save the db and exit so the container reboots
 *
 * Ported from the LUNA MD owner-restart.js plugin. NexoraFlex already
 * ships .restart (src/plugins/owner/restart.js), so this variant is
 * .restart2 and never shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/owner-restart.js):
 *   - The LUNA version posted 'restart' to `parentPort` (worker_threads)
 *     and threw unless run under `node index.js`. NexoraFlex runs as a
 *     plain `node server.js` process with no parent port, so that path
 *     is gone entirely.
 *   - Behaviour now mirrors the house restart.js: a plain call hot-reloads
 *     via `client.loadPlugins()` after `db.save()`; `hard` saves and
 *     exits the process for a container reboot.
 *   - Owner gating via `permissions: { owner: true }`; `m.chat` -> `m.from`.
 */
export default {
  name: 'restart2',
  aliases: [],
  category: 'owner',
  description: 'Hot-reload all plugins, or restart the container with .restart2 hard. Owner only.',
  permissions: { owner: true },
  cooldown: 3000,
  execute: async ({ m, args, prefix, db, client }) => {
    const p = prefix || '.';
    const isHardRestart = args.includes('hard');

    if (isHardRestart) {
      await m.reply('🔌 *Hard Restart: Saving database and terminating process for container reboot...*');
      try { db?.save(); } catch (_) {}
      setTimeout(() => {
        process.exit(0);
      }, 1000);
      return;
    }

    await m.reply('🔄 *Hot-Reload: Clearing and re-importing all command files...*');
    try {
      db?.save();
      await client.loadPlugins();
      await m.reply(
        `✅ *All plugins reloaded successfully!* Bot is updated without connection loss.\n\n` +
        `_Tip: Run \`${p}restart2 hard\` to completely reboot the bot container._`
      );
    } catch (err) {
      await m.reply.error(`*Hot-reload failed:* ${err.message}`);
      throw err;
    }
  },
};
