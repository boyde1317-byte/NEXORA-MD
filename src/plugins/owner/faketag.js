/**
 * faketag.js — .faketag / .ftag <text with @names> — send a message
 * that looks like it tags people who are not in the group (owner only).
 *
 * Ported from LUNA MD plugins/faketag.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - Owner gating is `permissions: { owner: true }` (enforced by the
 *     dispatcher) instead of the in-handler `isOwner` check.
 *   - The multi/legacy parsers and the fake group-JID builder are kept
 *     verbatim — that is the whole trick of the plugin.
 */
function randomGroupJid() {
  const a = 120363000000000000n + BigInt(Math.floor(Math.random() * 1e12));
  const b = BigInt(Date.now() % 1e9) * 1000n + BigInt(Math.floor(Math.random() * 999));
  return `${a + b}@g.us`;
}

function tidy(s) {
  return String(s || '').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseMulti(input) {
  const parts = input.split('|').map((s) => s.trim());
  if (parts.length < 2) return null;
  const tags = [];
  let prefix = '';
  let suffix = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    const at = part.lastIndexOf('@');
    if (at === -1) {
      if (i === 0 && tags.length === 0) prefix = part;
      else suffix = suffix ? `${suffix} ${part}` : part;
      continue;
    }
    const before = part.slice(0, at).replace(/[ \t]+$/g, '');
    const name = part.slice(at + 1).trim().replace(/^@+/, '').trim();
    if (!name) continue;
    if (i === 0 && before) prefix = before;
    tags.push(name);
  }
  if (!tags.length) return null;
  return { prefix, tags, suffix };
}

function parseLegacy(input) {
  if (input.includes('|')) {
    const i = input.indexOf('|');
    const nama = input.slice(0, i).trim().replace(/^@+/, '');
    const pesan = input.slice(i + 1).trim();
    if (!nama) return null;
    return { tags: [nama], pesan };
  }
  const nama = input.replace(/^@+/, '').trim();
  if (!nama) return null;
  return { tags: [nama], pesan: '' };
}

function buildMentions(tags) {
  return tags.map((name) => ({ groupJid: randomGroupJid(), groupSubject: name }));
}

function buildText(prefix, mentionText, suffix) {
  let out = '';
  if (prefix) {
    out = prefix;
    if (!/[\s\n]$/.test(prefix)) out += ' ';
  }
  out += mentionText;
  if (suffix) {
    if (!/^\s/.test(suffix) && !/[\s\n]$/.test(out)) out += ' ';
    out += suffix;
  }
  return tidy(out);
}

export default {
  name: 'faketag',
  aliases: ['ftag'],
  category: 'owner',
  description: 'Send a message that looks like it tags people who are not in the group (owner only). Usage: .faketag <name> | <text>',
  cooldown: 3000,
  permissions: { owner: true },
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'faketag';
    const input = String((args || []).join(' ').trim());
    if (!input) {
      return m.reply(
        `*Multi format:*\n${prefix}${cmd} join ada @Mark Zuckerberg|@Meta Ai| text\n${prefix}${cmd} https://link.com\njoin @A|@B| jir\n\n*Old format:*\n${prefix}${cmd} Mark Zuckerberg\n${prefix}${cmd} Mark Zuckerberg | halo semua`
      );
    }
    let groupMentions = [];
    let textBody = '';
    const multi = parseMulti(input);
    if (multi && multi.tags.length >= 1 && input.split('|').length >= 2) {
      groupMentions = buildMentions(multi.tags);
      const mentionText = groupMentions.map((v) => `@${v.groupJid}`).join(' ');
      textBody = buildText(multi.prefix, mentionText, multi.suffix);
    } else {
      const leg = parseLegacy(input);
      if (!leg) return m.reply('❌ Tag name is empty.');
      groupMentions = buildMentions(leg.tags);
      const mentionText = groupMentions.map((v) => `@${v.groupJid}`).join(' ');
      textBody = leg.pesan ? buildText('', mentionText, leg.pesan) : mentionText;
    }
    try {
      await sock.relayMessage(m.from, {
        extendedTextMessage: {
          text: textBody,
          previewType: 0,
          contextInfo: {
            mentionedJid: [],
            groupMentions,
          },
        },
      }, {});
    } catch (e) {
      console.error('[faketag]', e);
      return m.reply(`❌ Error: ${e.message}`);
    }
  },
};
