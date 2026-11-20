/**
 * addprem.js — .addprem / .delprem / .+prem / .-prem — grant/remove premium.
 *
 * Ported from LUNA MD plugins/owner-premium.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; owner gating via permissions.
 *   - Target resolution follows the house pattern (see owner/ban.js):
 *     mention > quoted sender > phone number in args. The LUNA original
 *     mixed args[0] (days) and args[1] (target) and read
 *     `db.data.users[who]` directly, which crashes on an unknown user.
 *     Here the target is resolved first, then `db.getUser` creates the
 *     record if needed and `db.setUser` persists the change.
 *   - Usage is `.addprem <days|permanent> @user` (or reply to the user).
 *     The LUNA arg order (days first, target second) is kept.
 *   - Display name via getDisplayName — NexoraFlex user records carry
 *     no `name` field.
 *   - `m.mentionedJid` -> `m.mentioned`; `conn.reply(who, ...)` ->
 *     `sock.sendMessage(who, { text })`.
 *
 * DB FIELD NEEDED (central edit, not done here): `premiumTime` on the
 * user record — epoch ms when premium expires, or null for permanent.
 * Default 0. `premium` (boolean) already exists in src/database/db.js.
 * Used here with a safe fallback (`?? 0`).
 */
import { getDisplayName } from '../../lib/displayName.js';

const DAY_MS = 86400000;

function resolveTarget(m, args) {
  if (m.mentioned?.length) return m.mentioned[0];
  if (m.quoted?.sender) return m.quoted.sender;
  const digits = String(args[1] || '').replace(/[^0-9]/g, '');
  if (digits) return `${digits}@s.whatsapp.net`;
  return null;
}

export default {
  name: 'addprem',
  aliases: ['delprem', '+prem', '-prem'],
  category: 'owner',
  description: 'Grant or remove premium. Usage: .addprem <days|permanent> @user | .delprem @user',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, sock, args, db, prefix, commandName }) => {
    const p = prefix || '.';
    const who = resolveTarget(m, args);
    if (!who) return await m.reply.error(`Whose premium status do you want to change?\n\nExample: \`${p}addprem 30 @user\` (or reply to their message)`);
    const user = db.getUser(who);
    const name = (await getDisplayName(sock, who)) || who.split('@')[0];
    const today = new Date().toLocaleDateString('en-GH');

    // Which sub-command fired: the dispatcher passes the exact word the
    // user typed as `commandName` (delprem / -prem vs addprem / +prem).
    // `resolvedName` would be 'addprem' for every alias, so it can't
    // tell them apart — use commandName, not the plugin name.
    const invoked = String(commandName || '').toLowerCase();
    const isDel = invoked === 'delprem' || invoked === '-prem';

    if (isDel) {
      db.setUser(who, { premium: false, premiumTime: 0 });
      await m.reply(`⚠️ *Success*\n\n*Name:* ${name}\nPremium status removed on ${today}.`);
      try {
        await sock.sendMessage(who, { text: `✨ *Premium Info*\n\n*Name:* ${name}\nPremium status removed on ${today}.` });
      } catch (_) {}
      return;
    }

    const daysArg = args[0];
    if (!daysArg) return await m.reply.error(`For how many days??\n\nExample: \`${p}addprem 30 @${m.sender.split('@')[0]}\` or \`${p}addprem permanent @user\``);

    if (daysArg.toLowerCase() === 'permanent' || daysArg.toLowerCase() === 'permanen') {
      db.setUser(who, { premium: true, premiumTime: null });
      await m.reply(`✅ *Success*\n\n*Name:* ${name}\n*Premium Status:* Permanent\n*Date:* ${today}`);
      try {
        await sock.sendMessage(who, { text: `✨ *Premium Info*\n\n*Name:* ${name}\n*Premium Status:* Permanent\n*Date:* ${today}` });
      } catch (_) {}
      return;
    }

    if (isNaN(Number(daysArg))) {
      return await m.reply.error(`⚠️ Numbers only!\n\nExample:\n${p}addprem 30 @${m.sender.split('@')[0]}`);
    }
    const days = Number(daysArg);
    const now = Date.now();
    const currentExpiry = user.premiumTime ?? 0;
    const newExpiry = now < currentExpiry ? currentExpiry + DAY_MS * days : now + DAY_MS * days;
    db.setUser(who, { premium: true, premiumTime: newExpiry });
    const ends = new Date(newExpiry).toLocaleDateString('en-GH');
    await m.reply(`✅ *Success*\n\n*Name:* ${name}\n*Duration:* ${days} Days\n*Starts:* ${today}\n*Ends:* ${ends}`);
    try {
      await sock.sendMessage(who, { text: `✨ *Premium Info*\n\n*Name:* ${name}\n*Duration:* ${days} Days\n*Starts:* ${today}\n*Ends:* ${ends}` });
    } catch (_) {}
  },
};
