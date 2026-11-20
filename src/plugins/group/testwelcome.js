/**
 * testwelcome.js — .testwelcome / .one — render a test welcome card for a
 * member (profile picture on a background + number + "WELCOME TO GROUP").
 *
 * Ported from LUNA MD plugins/welcome.js (its only live command was
 * `.one`; `.welcome` was claimed but returned early).
 *
 * Differences from the original:
 *   - Jimp is NOT a NexoraFlex dependency, so the image is composed with
 *     `sharp` (a house dependency): background resized to 1080x1080,
 *     profile picture cropped to a 350px circle, text drawn as an SVG
 *     overlay. Same layout as the original (picture centred at y=270,
 *     number at y=680, "WELCOME TO GROUP" at y=760, credit at the foot).
 *   - No external background image: the original composited over the old
 *     owner's catbox picture (litter.catbox.moe/4evj2u.jpg). This version
 *     draws a solid dark background with a ring, so the card is fully
 *     self-contained. If the profile picture cannot be fetched, a plain
 *     dark circle is used instead of the old fallback catbox picture.
 *   - The old owner's dev number in the footer is replaced with moonson's
 *     owner number 233533416608.
 *   - `conn.profilePictureUrl` -> `sock.profilePictureUrl`;
 *     `conn.sendMessage(m.chat, ...)` -> `sock.sendMessage(m.from, ...)`;
 *     reactions go through `m.react` (house pattern); group-only is
 *     enforced with `m.isGroup` (house pattern).
 *   - Name is `testwelcome` with alias `one` — `.welcome` is left free
 *     (NexoraFlex's greeting system owns the word "welcome").
 */
import sharp from 'sharp';

const OWNER_NUMBER = '233533416608';

async function getBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function circleSvg(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`
  );
}

async function makeCircleAvatar(ppBuffer) {
  const resized = await sharp(ppBuffer).resize(350, 350, { fit: 'cover' }).png().toBuffer();
  return sharp(resized)
    .composite([{ input: circleSvg(350), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function blankAvatar() {
  const svg = Buffer.from(
    '<svg width="350" height="350"><circle cx="175" cy="175" r="175" fill="#2a2a35"/></svg>'
  );
  return sharp(svg).png().toBuffer();
}

async function createWelcome(ppBuffer, number) {
  const avatar = ppBuffer ? await makeCircleAvatar(ppBuffer) : await blankAvatar();
  const textSvg = Buffer.from(
    `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">`
    + `<circle cx="540" cy="445" r="200" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="4"/>`
    + `<text x="540" y="730" font-family="sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">+${number}</text>`
    + `<text x="540" y="790" font-family="sans-serif" font-size="32" fill="#ffffff" text-anchor="middle">WELCOME TO GROUP</text>`
    + `<text x="20" y="1055" font-family="sans-serif" font-size="16" fill="#ffffff">NEXORA MD | ${OWNER_NUMBER}</text>`
    + `</svg>`
  );
  return sharp({
    create: { width: 1080, height: 1080, channels: 3, background: { r: 11, g: 11, b: 18 } },
  })
    .composite([
      { input: avatar, left: 365, top: 270 },
      { input: textSvg, left: 0, top: 0 },
    ])
    .jpeg()
    .toBuffer();
}

export default {
  name: 'testwelcome',
  aliases: ['one'],
  category: 'group',
  description: 'Render a test welcome card for a member. Usage: .one @user (group only)',
  cooldown: 5000,
  execute: async ({ m, sock }) => {
    if (!m.isGroup) return m.reply('This command only works in groups.');

    try { await m.react('🔥'); } catch (_) {}

    try {
      const who = m.mentionedJid?.[0] || m.sender;
      const number = who.split('@')[0];

      let ppBuffer = null;
      try {
        const ppUrl = await sock.profilePictureUrl(who, 'image');
        ppBuffer = await getBuffer(ppUrl);
      } catch (_) {
        ppBuffer = null; // blank circle avatar
      }

      const welcomeImg = await createWelcome(ppBuffer, number);

      await sock.sendMessage(m.from, {
        image: welcomeImg,
        caption: `🚀 *WELCOME - NEXORA MD*\n\n> 👋 Welcome @${number}!\n> 📞 Number: +${number}\n> 🎉 Hope you enjoy your stay in the group!\n\n© NEXORA MD - ${OWNER_NUMBER}`,
        mentions: [who],
      }, { quoted: m });

      try { await m.react('✅'); } catch (_) {}
    } catch (e) {
      console.error('[testwelcome]', e);
      try { await m.react('❌'); } catch (_) {}
      return m.reply(`❌ Error: ${e.message}`);
    }
  },
};
