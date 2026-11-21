/**
 * privatemode.js — .privatemode [on|off] — owner-only private (silent) mode.
 *
 * When private mode is ON, the bot goes completely silent from commands:
 * it answers nothing at all — no command runs, no denial, no "did you
 * mean", no sticker shortcut, no group custom command. The ONLY command
 * that still works is the owner's own .privatemode (any of its aliases),
 * which is the way back out. A non-owner's toggle attempt is silent too.
 *
 * This is stricter than the existing .self/.public private mode, which
 * still replies with a "private mode" warning to non-owners.
 *
 * State lives in the bot settings (db.getSettings().silentMode), persisted
 * with db.setSettings, so it survives restarts. Enforcement lives in
 * src/handlers/message.js (typed commands + sticker shortcuts).
 */
const ENABLE_WORDS = new Set(['enable', 'on', 'true', '1']);
const DISABLE_WORDS = new Set(['disable', 'off', 'false', '0']);

export default {
  name: 'privatemode',
  aliases: ['silent', 'silentmode'],
  category: 'owner',
  description: 'Toggle private (silent) mode. Usage: .privatemode on | .privatemode off',
  cooldown: 2000,
  permissions: { owner: true },
  execute: async ({ m, args, db }) => {
    const word = (args[0] || '').toLowerCase();
    let want;
    if (ENABLE_WORDS.has(word)) want = true;
    else if (DISABLE_WORDS.has(word)) want = false;
    // No on/off word: flip the current value.
    const current = !!db.getSettings().silentMode;
    const enable = want !== undefined ? want : !current;
    db.setSettings({ silentMode: enable });
    if (enable) {
      return m.reply('🔒 *Private mode ON* — I am completely silent now. No command will get a reply, from anyone.\n\nOnly you can turn it back off: *.privatemode off*');
    }
    return m.reply('🔓 *Private mode OFF* — I answer commands again.');
  },
};
