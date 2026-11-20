/**
 * iqc.js — .iqc / .qc2 — image quote-card maker (iOS-style fake chat quote).
 *
 * Ported from LUNA MD plugins/iqc.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `conn.sendMessage(m.chat, ...)` ->
 *     `sock.sendMessage(m.from, ...)`; `m.reply` for errors.
 *   - axios -> global fetch (axios is only an overrides entry in
 *     NexoraFlex, not a dependency). @napi-rs/canvas IS a NexoraFlex
 *     dependency and is kept.
 *   - Temp files go to os.tmpdir() instead of process.cwd()/temp, so
 *     nothing is written into the repo tree; both temp files are
 *     deleted after sending (best-effort).
 *   - Quoted-image download uses the house `m.quoted.download()` /
 *     `m.download()` pattern (see media/hd.js).
 *   - Branding: "iOS FAKE QUOTE" help text kept neutral; no LUNA strings.
 */
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const APPLE_EMOJI_JSON_URL = 'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json';

let appleEmojiMap = null;
let fontsLoaded = false;
const emojiImageCache = new Map();
let bgImgBuffer = null;

async function downloadFile(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function emojiToUnicode(emoji) { return [...emoji].map((c) => c.codePointAt(0).toString(16).padStart(4, '0')).join('-'); }

async function loadAppleEmojiMap() {
  if (appleEmojiMap) return appleEmojiMap;
  const buf = await downloadFile(APPLE_EMOJI_JSON_URL);
  appleEmojiMap = JSON.parse(buf.toString('utf-8'));
  return appleEmojiMap;
}

async function getEmojiImage(emoji) {
  if (emojiImageCache.has(emoji)) return emojiImageCache.get(emoji);
  const map = await loadAppleEmojiMap();
  const base = emojiToUnicode(emoji);
  const variants = [base, base.replace(/-fe0f/gi, ''), `${base.replace(/-fe0f/gi, '')}-fe0f`, base.toUpperCase(), base.replace(/-fe0f/gi, '').toUpperCase(), `${base.replace(/-fe0f/gi, '').toUpperCase()}-FE0F`];
  let b64 = null;
  for (const v of variants) { if (map[v]) { b64 = map[v]; break; } }
  if (!b64) return null;
  const buf = Buffer.from(b64, 'base64');
  const img = await loadImage(buf);
  emojiImageCache.set(emoji, img);
  return img;
}

async function drawAppleEmoji(ctx, emoji, x, y, size) {
  const img = await getEmojiImage(emoji);
  if (!img) { ctx.fillText(emoji, x, y); return; }
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}

const EMOJI_REGEX = /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu;

function measureTextCustom(ctx, text, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let totalWidth = 0;
  for (const part of parts) {
    if (!part) continue;
    EMOJI_REGEX.lastIndex = 0;
    if (EMOJI_REGEX.test(part)) totalWidth += fontSize * 1.05;
    else totalWidth += ctx.measureText(part).width;
    EMOJI_REGEX.lastIndex = 0;
  }
  return totalWidth;
}

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let currentX = x;
  for (const part of parts) {
    if (!part) continue;
    EMOJI_REGEX.lastIndex = 0;
    if (EMOJI_REGEX.test(part)) {
      const emojiSize = fontSize * 1.05;
      const emojiCX = currentX + emojiSize / 2;
      await drawAppleEmoji(ctx, part, emojiCX, y, emojiSize);
      currentX += emojiSize;
    } else {
      ctx.fillText(part, currentX, y);
      currentX += ctx.measureText(part).width;
    }
    EMOJI_REGEX.lastIndex = 0;
  }
}

function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `${fontSize}px InterRegular`;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.includes('\n')) {
      const parts = word.split('\n');
      for (let j = 0; j < parts.length; j++) {
        const test = cur + (cur ? ' ' : '') + parts[j];
        if (measureTextCustom(ctx, test, fontSize) > maxWidth && cur) { lines.push(cur); cur = parts[j]; }
        else cur = test;
        if (j < parts.length - 1) { lines.push(cur); cur = ''; }
      }
      continue;
    }
    const test = cur + (cur ? ' ' : '') + word;
    if (measureTextCustom(ctx, test, fontSize) > maxWidth && i > 0) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export default {
  name: 'iqc',
  aliases: ['qc2'],
  category: 'media',
  description: 'Make an iOS-style quote card from text or a replied image. Usage: .iqc <text>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const command = 'iqc';
    const p = prefix || '.';
    const tmpImgPath = join(tmpdir(), `iqc_${Date.now()}.png`);
    const outPath = join(tmpdir(), `rinchat-${Date.now()}.png`);
    try {
      const text = args.join(' ').trim();
      let targetText = text || (m.quoted?.text || m.quoted?.caption || '');
      let targetImgBuffer = null;
      try {
        if (m.quoted && /image/.test(m.quoted?.mtype || '')) {
          targetImgBuffer = await m.quoted.download();
        } else if (m.mtype && /image/.test(m.mtype)) {
          targetImgBuffer = await m.download();
        }
      } catch (_) {}

      if (!targetText && !targetImgBuffer) {
        return await m.reply(`💬 *IMAGE QUOTE CARD*\n\nType ${p}${command} <text>\nOr reply to a message with ${p}${command}\nExample: ${p}${command} hello world`);
      }

      let ts = m.messageTimestamp;
      if (ts && typeof ts === 'object' && ts.low !== undefined) ts = ts.low;
      ts = Number(ts) * 1000;
      const date = Number.isNaN(ts) ? new Date() : new Date(ts);
      const timeStr = `${String(date.getHours()).padStart(2, '0')}.${String(date.getMinutes()).padStart(2, '0')}`;

      let imgUrl = '';
      let caption = '';
      if (targetImgBuffer) { await writeFile(tmpImgPath, targetImgBuffer); imgUrl = tmpImgPath; caption = targetText || ''; }
      const txt = targetText || '';
      const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

      await sock.sendMessage(m.from, { react: { text: '🕕', key: m.key } });

      const RIN_BG_URL = 'https://cdn.jsdelivr.net/gh/ryyntwx/allimagerin@main/iqc-hytam.png';
      const RIN_FONTS = [{ url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2', file: 'Inter-Regular.ttf' }];
      const BG_W = 941;
      const BG_H = 1671;

      if (!fontsLoaded) {
        for (const f of RIN_FONTS) GlobalFonts.register(await downloadFile(f.url), 'InterRegular');
        fontsLoaded = true;
      }
      if (!bgImgBuffer) bgImgBuffer = await downloadFile(RIN_BG_URL);
      await loadAppleEmojiMap();

      const canvas = createCanvas(BG_W, BG_H);
      const ctx = canvas.getContext('2d');
      const bgImg = await loadImage(bgImgBuffer);
      ctx.drawImage(bgImg, 0, 0, BG_W, BG_H);

      ctx.fillStyle = '#ffffff';
      ctx.font = '27px InterRegular';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(timeStr, 463, 8);

      const chatFontSize = 30;
      const maxWidthLimit = 530;
      const minBubbleWidth = 280;
      const lineHeight = chatFontSize + 14;
      const paddingX = 30;
      const paddingY = 20;
      const rad = 28;
      const fixedX = 35;
      const fixedBaseY = 946;
      ctx.font = '22px InterRegular';
      const timeWidth = ctx.measureText(timeStr).width;
      let finalY;
      let finalBubbleHeight;
      let bubbleW;

      const drawBubble = (h, w, y) => {
        ctx.fillStyle = '#1c1c1e';
        ctx.beginPath();
        ctx.moveTo(fixedX + rad, y);
        ctx.lineTo(fixedX + w - rad, y);
        ctx.quadraticCurveTo(fixedX + w, y, fixedX + w, y + rad);
        ctx.lineTo(fixedX + w, y + h - rad);
        ctx.quadraticCurveTo(fixedX + w, y + h, fixedX + w - rad, y + h);
        ctx.lineTo(fixedX + rad, y + h);
        ctx.quadraticCurveTo(fixedX + 8, y + h, fixedX + 8, y + h - 8);
        ctx.lineTo(fixedX + 8, y + rad);
        ctx.quadraticCurveTo(fixedX + 8, y, fixedX + rad, y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(fixedX + 12, y + h - 20);
        ctx.quadraticCurveTo(fixedX - 2, y + h - 4, fixedX - 8, y + h);
        ctx.quadraticCurveTo(fixedX + 6, y + h, fixedX + 22, y + h - 2);
        ctx.closePath();
        ctx.fill();
      };

      if (!imgUrl) {
        ctx.font = `${chatFontSize}px InterRegular`;
        const chatLines = wrapText(ctx, txt, maxWidthLimit, chatFontSize);
        let longestW = 0;
        chatLines.forEach((l) => { const w = measureTextCustom(ctx, l.trim(), chatFontSize); if (w > longestW) longestW = w; });
        bubbleW = longestW + (paddingX * 2);
        bubbleW = Math.max(bubbleW, timeWidth + 75, 180);
        finalBubbleHeight = (chatLines.length * lineHeight) + paddingY + 12 + 22;
        finalY = fixedBaseY - finalBubbleHeight;
        drawBubble(finalBubbleHeight, bubbleW, finalY);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = `${chatFontSize}px InterRegular`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < chatLines.length; i++) {
          const lineY = finalY + paddingY + (i * lineHeight) + (chatFontSize / 2);
          await drawTextWithEmojis(ctx, chatLines[i].trim(), fixedX + paddingX, lineY, chatFontSize);
        }
        ctx.restore();
        ctx.fillStyle = '#727278';
        ctx.font = '22px InterRegular';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(timeStr, fixedX + bubbleW - 22, finalY + finalBubbleHeight - 38);
      } else {
        const imgBuf = imgUrl.startsWith('http') ? await downloadFile(imgUrl) : await readFile(imgUrl);
        const imgObj = await loadImage(imgBuf);
        const imgAspect = imgObj.width / imgObj.height;
        bubbleW = Math.min(Math.max(imgObj.width, minBubbleWidth), maxWidthLimit);
        const imgDrawH = Math.round(bubbleW / imgAspect);
        bubbleW = Math.max(bubbleW, timeWidth + 75);
        let captionLines = [];
        if (caption) { ctx.font = `${chatFontSize}px InterRegular`; captionLines = wrapText(ctx, caption, bubbleW - paddingX * 2, chatFontSize); }
        const captionH = captionLines.length > 0 ? paddingY + (captionLines.length * lineHeight) : 0;
        finalBubbleHeight = imgDrawH + captionH + 28 + (captionLines.length > 0 ? 4 : 0);
        finalY = fixedBaseY - finalBubbleHeight;
        drawBubble(finalBubbleHeight, bubbleW, finalY);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(fixedX + rad, finalY);
        ctx.lineTo(fixedX + bubbleW - rad, finalY);
        ctx.quadraticCurveTo(fixedX + bubbleW, finalY, fixedX + bubbleW, finalY + rad);
        ctx.lineTo(fixedX + bubbleW, finalY + imgDrawH);
        ctx.lineTo(fixedX + 8, finalY + imgDrawH);
        ctx.lineTo(fixedX + 8, finalY + rad);
        ctx.quadraticCurveTo(fixedX + 8, finalY, fixedX + rad, finalY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(imgObj, fixedX, finalY, bubbleW, imgDrawH);
        ctx.restore();
        if (captionLines.length > 0) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.font = `${chatFontSize}px InterRegular`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          for (let i = 0; i < captionLines.length; i++) {
            const lineY = finalY + imgDrawH + paddingY + (i * lineHeight) + (chatFontSize / 2);
            await drawTextWithEmojis(ctx, captionLines[i].trim(), fixedX + paddingX, lineY, chatFontSize);
          }
          ctx.restore();
        }
        ctx.fillStyle = '#727278';
        ctx.font = '22px InterRegular';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeStr, fixedX + bubbleW - 22, finalY + finalBubbleHeight - 28);
      }

      const emojiSize = Math.round(54 * 1.03);
      const emCardH = emojiSize + Math.round(44 * 1.03);
      const emCardW = Math.round(530 * 1.03);
      const emCardX = fixedX + 8;
      const emCardY = finalY - emCardH - 18;
      ctx.fillStyle = '#1c1c1e';
      ctx.beginPath();
      ctx.roundRect(emCardX, emCardY, emCardW, emCardH, [emCardH / 2]);
      ctx.fill();
      const startX = emCardX + 55;
      const spacingX = 76;
      const emojiCY = emCardY + (emCardH / 2) + 2;
      for (let i = 0; i < Math.min(emojis.length, 6); i++) {
        await drawAppleEmoji(ctx, emojis[i], startX + (i * spacingX), emojiCY, emojiSize);
      }
      ctx.fillStyle = '#8e8e93';
      ctx.font = `${Math.round(36 * 1.03)}px InterRegular`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', startX + (6 * spacingX) - 8, emCardY + (emCardH / 2) - 2);

      await writeFile(outPath, await canvas.encode('png'));
      await sock.sendMessage(m.from, { image: { url: outPath } }, { quoted: m });
      await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
    } catch (error) {
      bgImgBuffer = null;
      fontsLoaded = false;
      appleEmojiMap = null;
      console.error('[iqc]', error);
      try { await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } }); } catch (_) {}
      await m.reply(`❌ FAILED\n${error.message}`);
    } finally {
      if (existsSync(outPath)) { try { unlinkSync(outPath); } catch (_) {} }
      if (existsSync(tmpImgPath)) { try { unlinkSync(tmpImgPath); } catch (_) {} }
    }
  },
};
