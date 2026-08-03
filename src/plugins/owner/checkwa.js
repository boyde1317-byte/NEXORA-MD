/**
 * checkwa.js — Check WhatsApp ban status for a phone number.
 *
 * Fixed: removed dead 'ban' button (no ban command exists).
 * Fixed: removed nonsensical 'checkwa reply' option (reply isn't a subcommand).
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { richTableCard, selectMenu } from '../../lib/interactiveKit.js';

export default {
  name: 'checkwa',
  aliases: ['checkban', 'wacheck', 'iswabanned'],
  category: 'owner',
  description: 'Check if a phone number is on WhatsApp and whether it has been banned.',
  cooldown: 5000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    let raw = args[0];

    // If no explicit arg, try quoted sender
    if (!raw && m.quoted?.sender) raw = m.quoted.sender;

    if (!raw) {
      return await selectMenu(sock, m.from, {
        text:   '🔎 *WHATSAPP BAN CHECK*\n\nProvide a number to check, or reply to a message and run this command.',
        footer: 'Owner-only command',
      }, '⚙️ Lookup Options', [
        { title: 'Related Commands', rows: [
          { id: `${p}checkchid`,  title: '🆔 Get Chat ID',  description: 'Get JID for current chat' },
          { id: `${p}userinfo`,    title: '👤 User Info',     description: 'Look up user details' },
        ]},
      ], [], { quoted: m });
    }

    const cleaned = raw.replace(/@s\.whatsapp\.net|@g\.us/g, '').replace(/[^\d+]/g, '');
    const jid     = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;

    if (jid.length < 6) {
      return await m.reply.error('Could not parse that as a valid phone number. Include the country code, e.g. `6281234567890`.');
    }

    await withReactionStatus(m, async () => {
      let result;
      try {
        result = await sock.checkWhatsApp(jid);
      } catch (err) {
        console.error('[checkwa]', err);
        await m.reply.error(`*Check failed:* ${err.message || err}`);
        throw err;
      }

      const rows = [['Number', result.number]];
      let statusLabel;

      if (result.isBanned) {
        statusLabel = '🚫 BANNED';
        rows.push(['Status', statusLabel]);
        if (result.data?.violation_type)           rows.push(['Violation',   result.data.violation_type]);
        if (result.data?.appeal_token)             rows.push(['Appeal Token', result.data.appeal_token]);
        if (result.data?.in_app_ban_appeal != null) {
          rows.push(['In-App Appeal', result.data.in_app_ban_appeal ? 'Available' : 'Not available']);
        }
      } else if (result.isNeedOfficialWa) {
        statusLabel = '⚠️ Restricted (official WA required)';
        rows.push(['Status', statusLabel]);
      } else {
        statusLabel = '✅ Clean — not banned';
        rows.push(['Status', statusLabel]);
      }

      try {
        await richTableCard(sock, m.from, {
          title:   '🔎 WHATSAPP BAN CHECK',
          headers: ['Field', 'Value'],
          rows,
          footer:  'NEXORA • WA Check',
        }, { quoted: m });

        return await selectMenu(sock, m.from, {
          text:   `Check complete for *${result.number}*\n\nStatus: *${statusLabel}*`,
          footer: 'What would you like to do next?',
        }, '⚙️ More Actions', [
          { title: 'Lookup Actions', rows: [
            { id: `${p}checkwa `,     title: '🔁 Check Another Number', description: 'Run a new ban check' },
            { id: `${p}checkchid`,   title: '🆔 Get Chat ID',          description: 'Get current chat JID' },
            { id: `${p}userinfo`,    title: '👤 User Info',              description: 'Look up user details' },
          ]},
        ], [], { quoted: m });
      } catch (err) {
        console.warn('[checkwa] Tier 1 failed:', err.message);
        const { replyTable } = await import('../../lib/cosmetics.js');
        await replyTable(m, sock, {
          caption: '🔎 WHATSAPP BAN CHECK',
          rows,
          footer:  '_NEXORA • WA Check_',
        });
      }
    });
  }
};
