/**
 * ceksn.js — .ceksn — show your serial number (MD5 of your JID).
 *
 * Ported from LUNA MD plugins/xp-ceksn.js.
 *
 * Differences from the LUNA original:
 *   - `handler.register = true` is dropped — NexoraFlex has no
 *     register-gate flag. The serial is derived from the sender JID,
 *     so it matches the one `verify` shows and `unregister` checks.
 *   - No DB fields used.
 */

import { createHash } from 'crypto';

export default {
  name: 'ceksn',
  category: 'utility',
  description: 'Show your serial number (used by .unregister). Usage: .ceksn',
  cooldown: 3000,
  execute: async ({ m }) => {
    const sn = createHash('md5').update(m.sender).digest('hex');
    await m.reply(`*SN:* ${sn}`);
  },
};
