import { withReactionStatus } from '../../lib/cosmetics.js';

const SETTINGS = {
  open:    { announcement: false, label: '🌐 Open',   desc: 'All members can send messages.' },
  close:   { announcement: true,  label: '🔒 Closed', desc: 'Only admins can send messages.' },
  lock:    { restrict: true,      label: '🔐 Locked', desc: 'Only admins can edit group info.' },
  unlock:  { restrict: false,     label: '🔓 Unlocked', desc: 'All members can edit group info.' },
};

export default {
  name: 'groupsettings',
  aliases: ['gset', 'open', 'close', 'lock', 'unlock'],
  category: 'group',
  description: 'Change group settings. Options: open, close (messages), lock, unlock (info editing).',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 4000,
  execute: async ({ m, sock, args, body, prefix }) => {
    const rawCmd = body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
    const action = SETTINGS[rawCmd] ? rawCmd : args[0]?.toLowerCase();

    if (!action || !SETTINGS[action]) {
      return await m.reply.info(
        'Available settings:\n\n• `!open` — Allow all members to send messages\n• `!close` — Restrict to admins only\n• `!lock` — Only admins can edit group info\n• `!unlock` — Allow all members to edit group info',
        'GROUP SETTINGS'
      );
    }

    const setting = SETTINGS[action];

    await withReactionStatus(m, async () => {
      if ('announcement' in setting) {
        await sock.groupSettingUpdate(m.from, setting.announcement ? 'announcement' : 'not_announcement');
      }
      if ('restrict' in setting) {
        await sock.groupSettingUpdate(m.from, setting.restrict ? 'locked' : 'unlocked');
      }
      await m.reply.success(`${setting.label} — ${setting.desc}`);
    });
  }
};
