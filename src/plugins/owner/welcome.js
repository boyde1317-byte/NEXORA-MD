import { greetingConfig } from '../../greetings/greetingConfig.js';
import { db } from '../../database/db.js';
import { toSmallcaps } from '../../lib/smallcaps.js';

export default {
  name: 'welcome',
  aliases: [],
  category: 'owner',
  description: 'Toggle welcome messages on or off (per-group or global).',
  permissions: {
    admin: true
  },
  cooldown: 2000,
  execute: async ({ m, args, prefix, isOwner }) => {
    const p = prefix || '.';
    const opt = args[0] ? args[0].toLowerCase() : null;

    if (!opt || (opt !== 'on' && opt !== 'off')) {
      // Show both per-group and global status
      const globalStatus = greetingConfig.getEnabled() ? 'ON' : 'OFF';
      let info = `*${toSmallcaps('Global')}:* ${globalStatus}`;

      if (m.isGroup) {
        const groupData = db.getGroup(m.from);
        const groupStatus = groupData.welcome ? 'ON' : 'OFF';
        info = `*${toSmallcaps('This Group')}:* ${groupStatus}\n*${toSmallcaps('Global Default')}:* ${globalStatus}`;
      }

      return await m.reply.info(
        `${info}\n\n*${toSmallcaps('Usage')}:*\n• \`${p}welcome on\` — Enable ${m.isGroup ? 'in this group' : 'globally'}\n• \`${p}welcome off\` — Disable ${m.isGroup ? 'in this group' : 'globally'}\n\n_In a group, toggles per-group. In DM, toggles the global default._`,
        'WELCOME CONTROLS'
      );
    }

    // Global default (DM) stays owner-only.
    if (!m.isGroup && !isOwner) {
      return await m.reply.warn('Only the owner can change the global default. In a group, any admin can toggle it for that group.');
    }

    const enabled = opt === 'on';

    if (m.isGroup) {
      // Per-group toggle
      db.setGroup(m.from, { welcome: enabled });
      await m.reply.success(`👋 Welcome messages are now *${enabled ? 'ENABLED' : 'DISABLED'}* in *this group*!`);
    } else {
      // Global toggle (DM context)
      greetingConfig.setEnabled(enabled);
      await m.reply.success(`👋 Global welcome notifications are now *${enabled ? 'ENABLED' : 'DISABLED'}*!`);
    }
  }
};
