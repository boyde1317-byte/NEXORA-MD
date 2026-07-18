/**
 * about.js — NEXORA-MD system info + interactive card.
 *
 * Tier 1: richResponse table (native WA table bubble) with system stats
 *         + mixedCard with URL/quick-reply/copy buttons.
 * Tier 2: adReply banner (existing behaviour, kept as fallback).
 */
import brand from '../../../config/brand.js';
import client from '../../core/client.js';
import os from 'os';
import { replyAdReply } from '../../lib/waUtils.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { richTableCard, mixedCard } from '../../lib/interactiveKit.js';

export default {
  name: 'about',
  aliases: ['info', 'credits'],
  category: 'general',
  description: 'Displays branding, framework credits, and system info for NEXORA MD.',
  cooldown: 3000,
  execute: async ({ m, sock, prefix }) => {
    const totalCmds = client.commands?.size ?? 0;
    const uptimeSec = process.uptime();
    const hrs  = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = Math.floor(uptimeSec % 60);
    const ram  = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const p    = prefix || '.';

    // ── Tier 1: richResponse table + mixed action card ─────────────────────
    try {
      await richTableCard(sock, m.from, {
        title:   `${brand.name} — System Info`,
        headers: ['Field', 'Value'],
        rows: [
          ['Bot',       brand.name],
          ['Developer', brand.creator],
          ['Engine',    brand.core],
          ['Version',   `v${brand.version}`],
          ['Runtime',   `Node.js ${process.version}`],
          ['Commands',  String(totalCmds)],
          ['RAM Usage', `${ram} MB`],
          ['Uptime',    `${hrs}h ${mins}m ${secs}s`],
        ],
        footer: brand.signature,
      }, { quoted: m });

      return await mixedCard(sock, m.from, {
        text:   `╭─「 ${brand.name} 」\n│ ${brand.description}\n╰─ ${brand.signature}`,
        footer: `${brand.name} v${brand.version} • ${totalCmds} commands`,
      }, [
        { kind: 'url',    label: '💬 Contact Developer',  url:   'https://wa.me/233533416608' },
        { kind: 'url',    label: '📢 Official Channel',   url:   'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
        { kind: 'copy',   label: '📋 Copy Prefix',        value: p },
        { kind: 'action', label: '🤖 System Stats',       cmd:   `${p}menu aiDynamic` },
        { kind: 'action', label: '🏓 Ping Bot',           cmd:   `${p}ping` },
        { kind: 'action', label: '📋 Version Details',    cmd:   `${p}version` },
      ], { quoted: m });
    } catch (err) {
      console.warn('[about] Tier 1 (richTable + mixedCard) failed:', err.message);
    }

    // ── Tier 2: adReply card (original fallback) ───────────────────────────
    const text = [
      `╭─「 ${brand.name} 」`,
      `│`,
      `│ Next Generation`,
      `│ WhatsApp MD Framework`,
      `│`,
      `├─ Developer`,
      `│  ${brand.creator}`,
      `│`,
      `├─ System`,
      `│  Engine:`,
      `│  ${brand.core}`,
      `│  Version: ${brand.version}`,
      `│  Runtime: Node.js ${process.version}`,
      `│  Commands: ${totalCmds} loaded`,
      `│  RAM: ${ram} MB`,
      `│  Uptime: ${hrs}h ${mins}m ${secs}s`,
      `│`,
      `╰─ ${brand.signature}`,
    ].join('\n');

    const thumbnail = await getBrandThumbnail();
    await replyAdReply(m, sock, text, { title: brand.name, body: brand.description, thumbnail });
  },
};
