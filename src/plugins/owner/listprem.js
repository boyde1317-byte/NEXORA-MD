/**
 * listprem.js — .listprem / .listpremium — list premium users + remaining time.
 *
 * Ported from LUNA MD plugins/info-listprem.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract (export default { name, aliases, ... }).
 *   - `global.db.data.users` -> ctx `db.data.users`; user display names
 *     come from getDisplayName(sock, jid) — NexoraFlex user records carry
 *     no `name` field.
 *   - Owner-only (the LUNA original was open to anyone; premium roster
 *     is owner-only here).
 *   - `premiumTime` is read with a safe fallback (0 = no expiry recorded).
 *     A null premiumTime means permanent premium.
 *
 * DB FIELD NEEDED (central edit, not done here): `premiumTime` on the user
 * record — epoch ms when premium expires, or null for permanent. Default 0.
 * `premium` (boolean) already exists in src/database/db.js.
 */
import { getDisplayName } from '../../lib/displayName.js';

function formatRemaining(ms) {
  if (ms === null || ms === undefined) return 'Permanent';
  const diff = Math.max(0, Number(ms) - Date.now());
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000)) % 24;
  const minutes = Math.floor(diff / (60 * 1000)) % 60;
  return `${days} Days ${hours} Hours ${minutes} Minutes`;
}

export default {
  name: 'listprem',
  aliases: ['listpremium'],
  category: 'owner',
  description: 'List premium users and their remaining premium time (owner only).',
  permissions: { owner: true },
  cooldown: 3000,
  execute: async ({ m, sock, db }) => {
    const users = db?.data?.users || {};
    const premiumJids = Object.keys(users).filter((jid) => users[jid]?.premium);
    let response = '• *PREMIUM SUBSCRIPTION*\n\n';
    let totalPremium = 0;

    for (const jid of premiumJids) {
      const user = users[jid] || {};
      const number = jid.split('@')[0];
      const name = await getDisplayName(sock, jid);
      const premiumTime = user.premiumTime ?? 0;
      response += `∝───────•••───────\n◦  *${number}*\n•  ${name}\n*Active period*: ${formatRemaining(premiumTime === 0 ? Date.now() : premiumTime)}\n∝───────•••───────\n`;
      totalPremium++;
    }

    response += `┌  ◦  Total Premium : *${totalPremium}*\n`;
    response += '└  ◦  Upgrade Premium: *.owner*';

    return await m.reply(response, { mentions: premiumJids });
  },
};
