import { withReactionStatus } from '../../lib/cosmetics.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

export default {
  name: 'paste',
  aliases: ['pastebin', 'hastebin', 'upload'],
  category: 'utility',
  description: 'Uploads text to paste.rs and returns a shareable link. Reply to a text message or type directly.',
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    let text = '';

    if (m.quoted && m.quoted.body) {
      text = m.quoted.body.trim();
    } else {
      text = args.join(' ').trim();
    }

    if (!text) {
      return await m.reply.info(
        'Usage:\n• `!paste <your text>` — paste typed text\n• Reply to any message with `!paste` — paste that message\n\nReturns a shareable link.',
        'PASTE ONLINE'
      );
    }

    if (text.length > 50000) {
      return await m.reply.error('Text too long. Maximum 50 000 characters.');
    }

    await withReactionStatus(m, async () => {
      const res = await fetch('https://paste.rs/', {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    text,
        signal:  AbortSignal.timeout(10000),
      });

      if (!res.ok) throw new Error(`Paste service returned ${res.status}.`);
      const url = (await res.text()).trim();
      if (!url.startsWith('http')) throw new Error('Unexpected response from paste service.');

      const preview = text.slice(0, 80).replace(/\n/g, ' ');
      const output  = asciiBuilder.box('📋 PASTED ONLINE', [
        `🔗 Link    : ${url}`,
        `📝 Preview : ${preview}${text.length > 80 ? '...' : ''}`,
        `📏 Length  : ${text.length} characters`,
      ]);
      await m.reply(output);
    });
  }
};
