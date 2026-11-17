import { generateWAMessageFromContent } from 'baileys';
import {
  BAR_PROBES,
  getBarProbe,
  resolveBarProbe,
  barSlots,
  barIsEmpty,
  buildBarCarrier,
} from '../../lib/galaxyBar.js';

/**
 * `.galaxybar` — the galaxy bar treated as an empty container.
 *
 * The theory: `messageParamsJson` is a container with three known slots (offer
 * strip, bottom sheet, tap callout). Menu 19 fills all three with fixed copy,
 * which hides what the container itself does. These probes send it empty, then
 * fill one slot at a time, on the same carrier menu 19 uses (viewOnce envelope,
 * zero-width body, no footer, no header) so the bar is the only variable.
 *
 * The probe list lives in src/lib/galaxyBar.js and is shared with `.testrich`,
 * so both commands mean the same thing by "baroffer".
 *
 *   .galaxybar                 empty container {}
 *   .galaxybar <id>            one probe from the list
 *   .galaxybar list            ids with what each one asks
 *   .galaxybar barfill <text>  filled probe with your own offer copy
 */
export default {
  name: 'galaxybar',
  aliases: ['gbar'],
  category: 'general',
  description: 'Sends the galaxy bar as an empty container, one slot at a time.',
  usage: '[id] [text] | list',
  cooldown: 3000,
  execute: async ({ sock, m, args, prefix }) => {
    const jid = m.from;
    const p = prefix || '.';
    const first = String(args[0] || '').trim();
    const rest = args.slice(1).join(' ').trim();

    if (first.toLowerCase() === 'list') {
      const lines = ['🫙 *Galaxy bar probes*\n'];
      for (const probe of BAR_PROBES) {
        lines.push(`• \`${probe.id}\` — ${probe.label}\n   ${probe.note}`);
      }
      lines.push(`\n_Usage: ${p}galaxybar <id> [text]_`);
      return await sock.sendMessage(jid, { text: lines.join('\n') }, { quoted: m });
    }

    const probe = first ? getBarProbe(first) : BAR_PROBES[0];
    if (!probe) {
      return await sock.sendMessage(jid, {
        text: `Unknown probe: *${first}*\n\nIds: ${BAR_PROBES.map((b) => b.id).join(', ')}`,
      }, { quoted: m });
    }

    const resolved = resolveBarProbe(probe, rest);

    try {
      const generated = generateWAMessageFromContent(jid, buildBarCarrier({
        bar: resolved.bar,
        buttons: resolved.buttons,
      }), { ...(sock.user?.id ? { userJid: sock.user.id } : {}) });

      await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
    } catch (err) {
      return await sock.sendMessage(jid, {
        text: `The client refused that bar: ${err.message}`,
      }, { quoted: m });
    }

    const slots = barSlots(resolved.bar);
    await sock.sendMessage(jid, {
      text: [
        `Sent: ${resolved.label}`,
        `Slots: ${slots.length ? slots.join(', ') : 'none (bar is {})'}`,
        `Bytes: ${Buffer.byteLength(resolved.bar, 'utf8')}${resolved.buttons.length ? ` + ${resolved.buttons.length} button` : ''}`,
      ].join('\n'),
    }, { quoted: m });
  },
};
