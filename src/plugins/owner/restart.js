import { client } from '../../core/client.js';
import { db } from '../../database/db.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

export default {
  name: 'restart',
  aliases: ['reload', 'reboot'],
  category: 'owner',
  description: 'Hot-reloads all plugin files, or restarts the container process.',
  permissions: {
    owner: true
  },
  execute: async ({ m, args }) => {
    const isHardRestart = args.includes('hard');

    if (isHardRestart) {
      await withReactionStatus(m, async () => {
        await m.reply('🔌 *Hard Restart: Saving database and terminating process for container reboot...*');
        db.save();
        setTimeout(() => {
          process.exit(0);
        }, 1000);
      }, { clearOnSuccess: true }); // process is exiting — leave no stale ✅ reaction behind
    } else {
      await withReactionStatus(m, async () => {
        await m.reply('🔄 *Hot-Reload: Clearing and re-importing all command files...*');
        try {
          db.save();
          await client.loadPlugins();
          await m.reply('✅ *All plugins reloaded successfully!* Bot is updated without connection loss.\n\n_Tip: Run "!restart hard" to completely reboot the bot container._');
        } catch (err) {
          await m.reply(`❌ *Hot-reload failed:* ${err.message}`);
          throw err;
        }
      });
    }
  }
};
