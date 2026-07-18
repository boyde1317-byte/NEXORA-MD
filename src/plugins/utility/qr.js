import { withReactionStatus } from '../../lib/cosmetics.js';

export default {
  name: 'qr',
  aliases: ['qrcode', 'makeqr', 'genqr'],
  category: 'utility',
  description: 'Generates a QR code image from any text or URL.',
  cooldown: 4000,
  execute: async ({ m, sock, args }) => {
    const text = args.join(' ').trim();
    if (!text) {
      return await m.reply.info(
        'Usage: `!qr <text or URL>`\n\nExamples:\n• `!qr https://github.com`\n• `!qr Hello World`\n• `!qr +233597514499`',
        'QR CODE GENERATOR'
      );
    }

    if (text.length > 900) {
      return await m.reply.error('Text too long. Max 900 characters for QR codes.');
    }

    await withReactionStatus(m, async () => {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=20&color=000000&bgcolor=ffffff&data=${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('QR code service unavailable.');

      const buffer = Buffer.from(await res.arrayBuffer());
      await sock.sendMessage(m.from, {
        image: buffer,
        caption: `✅ *QR Code Generated*\n\n📄 Content: ${text.length > 80 ? text.slice(0, 77) + '...' : text}`,
      }, { quoted: m });
    });
  }
};
