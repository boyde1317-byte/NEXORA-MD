/**
 * qrcode2.js — .qrcode2 — QR code image from text or a URL.
 *
 * Ported from LUNA MD plugins/tools-qrcode.js. The LUNA original used the
 * quickchart.io QR endpoint via conn.sendFile; NexoraFlex has no sendFile,
 * so the image is fetched to a buffer first and sent with sock.sendMessage.
 *
 * Why qrcode2: NexoraFlex already ships src/plugins/utility/qr.js (.qr,
 * aliases qrcode/makeqr/genqr) via api.qrserver.com. This one keeps the
 * LUNA quickchart implementation as a second option — no alias claimed,
 * so the house command is untouched.
 */
export default {
  name: 'qrcode2',
  aliases: [],
  category: 'utility',
  description: 'Generate a QR code image from text or a URL (quickchart). Usage: .qrcode2 <text>',
  cooldown: 4000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const text = args.join(' ').trim();
    if (!text) {
      return await m.reply(`Usage: \`${p}qrcode2 <text>\`\n\nExample: \`${p}qrcode2 https://github.com\``);
    }
    if (text.length > 900) {
      return await m.reply.error('Text too long. Max 900 characters for QR codes.');
    }
    try {
      const res = await fetch(`https://quickchart.io/qr?text=${encodeURIComponent(text)}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error('QR code service unavailable.');
      const buffer = Buffer.from(await res.arrayBuffer());
      await sock.sendMessage(m.from, {
        image: buffer,
        caption: `✅ *QR Code Generated*\n\n📄 Content: ${text.length > 80 ? `${text.slice(0, 77)}...` : text}`,
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Could not generate the QR code: ${err.message}`);
    }
  },
};
