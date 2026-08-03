/**
 * about.js — NEXORA-MD system info + interactive card.
 *
 * Enhanced for rich-messages:
 *   Tier 1: sendInteractive with image header + subtitle + embedded adReply
 *           (double visual: interactive card + ad banner in one message)
 *   Tier 2: richResponse table (native WA table bubble) + mixedCard with buttons
 *   Tier 3: adReply banner (text fallback)
 */
import brand from '../../../config/brand.js';
import client from '../../core/client.js';
import os from 'os';
import { replyAdReply } from '../../lib/waUtils.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { richTableCard, mixedCard } from '../../lib/interactiveKit.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { capabilities } from '../../core/capabilities.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

export default {
  name: 'about',
  aliases: ['info', 'credits'],
  category: 'general',
  description: 'Displays branding, credits, and system info for NEXORA MD.',
  cooldown: 3000,
  execute: async ({ m, sock, prefix }) => {
    const totalCmds = client.commands?.size ?? 0;
    const uptimeSec = process.uptime();
    const hrs  = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = Math.floor(uptimeSec % 60);
    const ram  = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const p    = prefix || '.';

    // Build richer body text with visual stat rows and progress bars
    const memPercent = Math.min(100, Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100));
    const bodyText = [
      `\u2726 *${toSmallcaps(brand.name)}* \u2726`,
      ``,
      toSmallcaps(brand.description),
      toSmallcaps('Not your average bot. Yours.'),
      ``,
      asciiBuilder.divider(toSmallcaps('System Info')),
      ``,
      asciiBuilder.statRow('Developer', brand.creator),
      asciiBuilder.statRow('Framework', brand.core),
      asciiBuilder.statRow('Version', `v${brand.version}`),
      asciiBuilder.statRow('Runtime', `Node.js ${process.version}`),
      asciiBuilder.statRow('Commands', `${totalCmds} loaded`),
      asciiBuilder.statRow('RAM', `${ram} MB`),
      asciiBuilder.statRow('Uptime', `${hrs}h ${mins}m ${secs}s`),
      ``,
      asciiBuilder.progressBar(100 - memPercent, 14, 'Heap Free'),
      ``,
      asciiBuilder.badge('Engine', 'Baileys'),
      `  ${asciiBuilder.badge('Status', 'OPTIMAL')}`,
      ``,
      toSmallcaps(brand.signature),
    ].join('\n');

    const footerText = `${brand.name} v${brand.version} \u2502 ${totalCmds} commands`;
    const thumbnailUrl = await getBrandThumbnail();

    // Build adReply for embedded use
    const adReply = {
      title:                 brand.name,
      body:                  brand.description,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (thumbnailUrl) {
      adReply.thumbnailUrl = thumbnailUrl;
      adReply.originalImageUrl = thumbnailUrl;
    }

    // ── Tier 1: sendInteractive with image header + subtitle + embedded adReply ──
    if (capabilities.interactive) {
      try {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    bodyText,
          footer:  footerText,
          header:  {
            title:    `\u2726 ${toSmallcaps(brand.name + ' System Info')} \u2726`,
            subtitle: `v${brand.version} \u2502 ${totalCmds} ${toSmallcaps('commands')} \u2502 ${ram}MB RAM`,
            ...(thumbnailUrl ? { image: { url: thumbnailUrl } } : {}),
          },
          buttons: [
            { name: 'cta_url',     params: { display_text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,  url: 'https://wa.me/233533416608' } },
            { name: 'cta_url',     params: { display_text: `\u{1F4E1} ${toSmallcaps('Official Channel')}`,   url: 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' } },
            { name: 'quick_reply', params: { display_text: `\u{1F916} ${toSmallcaps('System Stats')}`,        id: `${p}menu aiDynamic` } },
            { name: 'quick_reply', params: { display_text: `\u{1F3D1} ${toSmallcaps('Ping Bot')}`,            id: `${p}ping` } },
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: m });
      } catch (err) {
        console.warn('[about] Tier 1 (sendInteractive + adReply) failed, trying richTable:', err.message);
      }
    }

    // ── Tier 2: richResponse table + mixed action card ─────────────────────
    try {
      await richTableCard(sock, m.from, {
        title:   `${brand.name} \u2014 System Info`,
        headers: ['Field', 'Value'],
        rows: [
          ['Bot',       brand.name],
          ['Developer', brand.creator],
          ['Framework', brand.core],
          ['Version',   `v${brand.version}`],
          ['Runtime',   `Node.js ${process.version}`],
          ['Commands',  String(totalCmds)],
          ['RAM Usage', `${ram} MB`],
          ['Uptime',    `${hrs}h ${mins}m ${secs}s`],
        ],
        footer: brand.signature,
      }, { quoted: m });

      return await mixedCard(sock, m.from, {
        text:   `\u2726 *${toSmallcaps(brand.name)}* \u2726\n${toSmallcaps(brand.description)}\n${toSmallcaps('Not your average bot. Yours.')}\n\n${toSmallcaps(brand.signature)}`,
        footer: `${brand.name} v${brand.version} \u2502 ${totalCmds} commands`,
      }, [
        { kind: 'url',    label: '\u{1F4AC} Contact Developer',  url:   'https://wa.me/233533416608' },
        { kind: 'url',    label: '\u{1F4E1} Official Channel',   url:   'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
        { kind: 'action', label: '\u{1F916} System Stats',       cmd:   `${p}menu aiDynamic` },
        { kind: 'action', label: '\u{1F3D1} Ping Bot',            cmd:   `${p}ping` },
      ], { quoted: m });
    } catch (err) {
      console.warn('[about] Tier 2 (richTable + mixedCard) failed:', err.message);
    }

    // ── Tier 3: adReply card (original fallback) ───────────────────────────
    await replyAdReply(m, sock, bodyText, {
      title: brand.name,
      body: brand.description,
      thumbnailUrl,
      originalImageUrl: thumbnailUrl,
      renderLargerThumbnail: true,
    });
  },
};
