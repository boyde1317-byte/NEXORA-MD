/**
 * welcome2.js — .welcome2 — per-group welcome on/off toggle (admin only).
 *
 * Ported from the LUNA MD plugins/#U062a#U0631#U062d#U064a#U0628.js
 * (command `welcome`). ONLY the toggle part is ported here:
 *   - the `.one` / `testwelcome` image command is ported separately
 *     as `testwelcome` — not in this file;
 *   - the `before`-hook auto-welcome that fires on joins is framework
 *     behaviour in NexoraFlex (greetingManager), not a plugin — not
 *     ported here either.
 *
 * HOW THE FLAG IS STORED:
 * NexoraFlex has NO per-group welcome enable flag. greetingConfig.js
 * only has a GLOBAL `enabled` switch (database/greeting.json) and
 * greetingManager.js renders welcomes without checking any per-group
 * flag. So this toggle stores the per-group flag on the group record:
 *   db.getGroup(m.from).welcomeEnabled  (boolean, default true)
 * via db.setGroup(). REPORTED: the greeting renderer does not read
 * this flag yet — a central edit must make greetingManager honour
 * `group.welcomeEnabled` (falling back to the global
 * greetingConfig.enabled) before this toggle has any visible effect.
 * The flag is written now so the wiring can land without a data
 * migration.
 *
 * Original LUNA flag: `global.db.data.chats[m.chat].welcome`
 * (boolean). NexoraFlex equivalent: `db.data.groups[jid].welcomeEnabled`.
 * Needed db field (not in db.js group defaults yet):
 *   groups.<jid>.welcomeEnabled, default true.
 */
export default {
  name: 'welcome2',
  aliases: [],
  category: 'group',
  description: 'Turn the welcome message on or off for this group (admin only). Usage: .welcome2 on / off',
  cooldown: 2000,
  permissions: { groupOnly: true, admin: true },
  execute: async ({ m, args, prefix, db }) => {
    const p = prefix || '.';
    const group = db.getGroup(m.from);
    // Unset = ON, matching the global default (greetingConfig.enabled: true).
    const current = group.welcomeEnabled !== false;

    const action = (args[0] || '').toLowerCase();
    if (action === 'on') {
      db.setGroup(m.from, { welcomeEnabled: true });
      return await m.reply('✅ *Welcome ON - NEXORA MD*\nNow everyone who joins will be welcomed automatically');
    }
    if (action === 'off') {
      db.setGroup(m.from, { welcomeEnabled: false });
      return await m.reply('❌ *Welcome OFF - NEXORA MD*');
    }
    return await m.reply(
      '*How to use:*\n' +
      `${p}welcome2 on = enable\n` +
      `${p}welcome2 off = disable\n\n` +
      `Status: ${current ? 'ON ✅' : 'OFF ❌'}`,
    );
  },
};
