/**
 * accept.js — .accept (alias .acceptall) — approve all pending join requests.
 *
 * Ported from the LUNA MD plugins/#U0642#U0628#U0648#U0644.js.
 * Admin + botAdmin, enforced by the dispatcher via permissions.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `conn` -> `sock`,
 *     `m.chat` -> `m.from`. The in-handler isGroup/isAdmin/isBotAdmin
 *     checks are dropped — the dispatcher enforces
 *     `permissions: { groupOnly, admin, botAdmin }` before execute runs.
 *   - The result is sent as PLAIN TEXT. The original wrapped the
 *     success line in a `requestPaymentMessage` (a fake payment request
 *     showing the accepted count as an amount) — that wrapper is
 *     dropped entirely, per the port brief.
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
export default {
  name: 'accept',
  aliases: ['acceptall'],
  category: 'group',
  description: 'Approve all pending join requests for this group (admin only, bot must be admin).',
  cooldown: 5000,
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  execute: async ({ m, sock }) => {
    try {
      // Get the list of pending requests
      const pending = await sock.groupRequestParticipantsList(m.from);

      if (!pending || pending.length === 0) {
        return await m.reply('✅ There are no pending requests right now');
      }

      let count = 0;
      // Accept all requests
      for (const req of pending) {
        try {
          await sock.groupRequestParticipantsUpdate(m.from, [req.jid || req], 'approve');
          count++;
          await new Promise((r) => setTimeout(r, 500));
        } catch (_) {}
      }

      await m.reply(`✅ Accepted *${count}* out of ${pending.length} requests`);
    } catch (e) {
      console.error('[accept]', e);
      await m.reply(`❌ Error: ${e.message}\nMake sure the join-request feature is enabled in the group settings`);
    }
  },
};
