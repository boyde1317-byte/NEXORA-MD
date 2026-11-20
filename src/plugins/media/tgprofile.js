/**
 * tgprofile.js — .tgprofile / .mysetting / .teleprofile / .tgp — render a
 * Telegram-style settings profile card for a user.
 *
 * Ported from LUNA MD plugins/tgprofile.js. Draws a 1080x2350 Telegram
 * settings screen (avatar, name, phone, settings rows, premium card) on
 * @napi-rs/canvas and sends it as an image. @napi-rs/canvas is already a
 * NEXORA MD dependency; downloads use global fetch.
 *
 * Differences from the LUNA original:
 *   - conn.getName(who) -> getDisplayName(sock, who); m.chat -> m.from;
 *     target user from m.msg?.contextInfo?.mentionedJid?.[0] (with
 *     m.mentionedJid fallback) or the quoted message's sender.
 *   - The hardcoded Indonesian phone fallback ('+212 6 74 37 57 08')
 *     is gone — the card shows the target's real number. Default name
 *     'woli' -> 'User'. Language row 'Indonesian' -> 'English'.
 *   - No temp file: the canvas is encoded and sent as a buffer (the
 *     original wrote temp/tg_fix_<ts>.png and deleted it afterwards).
 *   - Reactions go through sock.sendMessage, matching house usage.
 */
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { getDisplayName } from '../../lib/displayName.js';

let fontLoaded = false;

async function dl(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// Draw the icons without emoji
function drawIcon(ctx, type, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'akun') { // person
    ctx.beginPath(); ctx.arc(cx, cy - 6, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy + 14, 16, Math.PI, 0); ctx.fill();
  } else if (type === 'chat') {
    ctx.beginPath(); ctx.roundRect(cx - 12, cy - 8, 24, 16, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + 8); ctx.lineTo(cx - 8, cy + 14); ctx.lineTo(cx, cy + 8); ctx.fill();
  } else if (type === 'lock') {
    ctx.beginPath(); ctx.roundRect(cx - 10, cy - 2, 20, 14, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 4, 7, Math.PI, 0); ctx.stroke();
  } else if (type === 'notif') {
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - 6); ctx.lineTo(cx + 10, cy - 6); ctx.lineTo(cx + 8, cy + 8); ctx.lineTo(cx - 8, cy + 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy + 12, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'data') {
    ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 10, cy - 4); ctx.lineTo(cx + 10, cy + 10); ctx.lineTo(cx, cy + 14); ctx.lineTo(cx - 10, cy + 10); ctx.lineTo(cx - 10, cy - 4); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - 4); ctx.lineTo(cx, cy + 2); ctx.lineTo(cx + 10, cy - 4); ctx.stroke();
  } else if (type === 'folder') {
    ctx.beginPath(); ctx.roundRect(cx - 12, cy - 6, 24, 16, 2); ctx.fill();
    ctx.fillRect(cx - 12, cy - 12, 12, 6);
  } else if (type === 'device') {
    ctx.strokeRect(cx - 12, cy - 8, 24, 16); ctx.fillRect(cx - 4, cy + 8, 8, 3);
  } else if (type === 'battery') {
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(cx - 12, cy - 6, 20, 12, 3); ctx.stroke();
    ctx.fillRect(cx + 9, cy - 2, 3, 6);
    ctx.fillRect(cx - 9, cy - 3, 10, 6);
  } else if (type === 'lang') {
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, 6, 12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.stroke();
  } else if (type === 'premium') { // star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = i * 144 - 90;
      const x = cx + 10 * Math.cos(a * Math.PI / 180);
      const y = cy + 10 * Math.sin(a * Math.PI / 180);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export default {
  name: 'tgprofile',
  aliases: ['mysetting', 'teleprofile', 'tgp'],
  category: 'media',
  description: 'Render a Telegram-style settings profile card for you or a tagged user.',
  cooldown: 10000,
  execute: async ({ m, sock }) => {
    try {
      await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } });

      const who = m.msg?.contextInfo?.mentionedJid?.[0] || m.mentionedJid?.[0]
        || m.quoted?.sender || m.quoted?.key?.participant || m.sender;
      const name = (await getDisplayName(sock, who)) || 'User';
      const phone = '+' + who.split('@')[0];
      const prettyPhone = phone.replace(/(\+\d{3})(\d)(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5 $6');

      let ppUrl;
      try { ppUrl = await sock.profilePictureUrl(who, 'image'); } catch { ppUrl = 'https://i.ibb.co/YB0V0Xg/telegram-default.jpg'; }
      const ppBuf = await dl(ppUrl);

      if (!fontLoaded) {
        const f = await dl('https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bslnt%2Cwght%5D.ttf');
        if (f) GlobalFonts.register(f, 'Inter');
        fontLoaded = true;
      }

      const W = 1080, H = 2350;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#0E1621';
      ctx.fillRect(0, 0, W, H);

      // top - no emoji so it does not turn into a square
      ctx.fillStyle = '#8A9CB0';
      ctx.font = '400 26px Inter';
      ctx.fillText('x72', 40, 50);
      ctx.textAlign = 'right';
      ctx.fillText('0:00', W - 40, 50);
      ctx.textAlign = 'left';

      // header <-...
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 48px Inter';
      ctx.fillText('<', 40, 130);
      ctx.textAlign = 'right';
      ctx.fillText('...', W - 40, 130);
      ctx.fillText('Q', W - 110, 130);
      ctx.textAlign = 'left';

      // avatar
      const avatar = 300, ax = (W - avatar) / 2, ay = 210;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, ay + avatar / 2, avatar / 2, 0, Math.PI * 2);
      ctx.clip();
      try { const im = await loadImage(ppBuf || ppUrl); ctx.drawImage(im, ax, ay, avatar, avatar); } catch { ctx.fillStyle = '#1E2C3A'; ctx.fillRect(ax, ay, avatar, avatar); }
      ctx.restore();

      // camera badge blue
      ctx.fillStyle = '#2AABEE';
      ctx.beginPath(); ctx.arc(W / 2 + avatar / 2 - 30, ay + avatar - 25, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('o', W / 2 + avatar / 2 - 30, ay + avatar - 16);
      ctx.textAlign = 'left';

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 52px Inter';
      ctx.fillText(name, W / 2, ay + avatar + 75);
      ctx.fillStyle = '#6D7F90';
      ctx.font = '400 34px Inter';
      ctx.fillText(prettyPhone, W / 2, ay + avatar + 115);
      ctx.textAlign = 'left';

      // main card
      const cardY = ay + avatar + 160;
      const cardH = 1280;
      ctx.fillStyle = '#17212B';
      ctx.beginPath(); ctx.roundRect(28, cardY, W - 56, cardH, 26); ctx.fill();

      const rows = [
        { t: 'akun', c: '#2AABEE', title: 'Account', sub: 'Number, username, bio' },
        { t: 'chat', c: '#FF9800', title: 'Chat Settings', sub: 'Wallpaper, night mode, animations' },
        { t: 'lock', c: '#4CAF50', title: 'Privacy and Security', sub: 'Last seen, devices, passkey' },
        { t: 'notif', c: '#F44336', title: 'Notifications', sub: 'Sounds, calls, badges' },
        { t: 'data', c: '#4CAF50', title: 'Data and Storage', sub: 'Media download settings' },
        { t: 'folder', c: '#2AABEE', title: 'Chat Folders', sub: 'Sort chats into folders' },
        { t: 'device', c: '#2AABEE', title: 'Devices', sub: 'Manage linked devices' },
        { t: 'battery', c: '#FF9800', title: 'Battery Saver', sub: 'Save battery when low' },
        { t: 'lang', c: '#9C27B0', title: 'Language', sub: 'English' },
      ];

      let y = cardY + 35;
      rows.forEach((r) => {
        ctx.fillStyle = r.c;
        ctx.beginPath(); ctx.roundRect(W - 125, y, 58, 58, 14); ctx.fill();
        drawIcon(ctx, r.t, W - 96, y + 29);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 33px Inter';
        ctx.fillText(r.title, W - 155, y + 30);
        ctx.fillStyle = '#6D7F90';
        ctx.font = '400 23px Inter';
        ctx.fillText(r.sub, W - 155, y + 58);
        ctx.textAlign = 'left';

        if (r.title !== 'Language') {
          ctx.strokeStyle = '#1F2C3A'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(60, y + 78); ctx.lineTo(W - 60, y + 78); ctx.stroke();
        }
        y += 104;
      });

      // second card
      const card2Y = cardY + cardH + 22;
      const card2H = 300;
      ctx.fillStyle = '#17212B';
      ctx.beginPath(); ctx.roundRect(28, card2Y, W - 56, card2H, 26); ctx.fill();

      const rows2 = [
        { t: 'premium', c: '#9C27B0', title: 'Telegram Premium' },
        { t: 'premium', c: '#FF9800', title: 'Telegram Stars' },
        { t: 'device', c: '#795548', title: 'Telegram Business' },
      ];
      y = card2Y + 35;
      rows2.forEach((r) => {
        ctx.fillStyle = r.c;
        ctx.beginPath(); ctx.roundRect(W - 125, y, 58, 58, 14); ctx.fill();
        drawIcon(ctx, r.t, W - 96, y + 29);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 31px Inter';
        ctx.fillText(r.title, W - 155, y + 38);
        ctx.textAlign = 'left';
        y += 85;
      });

      const png = Buffer.from(await canvas.encode('png'));
      await sock.sendMessage(m.from, { image: png, caption: `Telegram profile card for ${name}` }, { quoted: m });
      await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
    } catch (e) {
      console.log('[tgprofile]', e);
      await m.reply('Error: ' + e.message);
    }
  },
};
