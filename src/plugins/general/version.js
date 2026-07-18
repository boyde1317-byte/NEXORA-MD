/**
 * version.js — bot/runtime version info.
 *
 * Tier 1: richResponse table + actionCard with follow-up buttons.
 * Tier 2: adReply card (original behaviour).
 */
import brand from '../../../config/brand.js';
import { replyAdReply } from '../../lib/waUtils.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { richTableCard, actionCardWithAd } from '../../lib/interactiveKit.js';
import client from '../../core/client.js';

export default {
  name: 'version',
  aliases: ['v', 'ver'],
  category: 'general',
  description: 'Displays current bot, developer, core, and runtime version details.',
  cooldown: 2000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    const totalCmds = client.commands?.size ?? 0;

    // ── Tier 1: richResponse table ─────────────────────────────────────────
    try {
      await richTableCard(sock, m.from, {
        title:   'VERSION INFO',
        headers: ['Component', 'Details'],
        rows: [
          ['Bot Name',    brand.name],
          ['Developer',   brand.creator],
          ['Core Engine', brand.core],
          ['Version',     `v${brand.version}`],
          ['Node.js',     process.version],
          ['Platform',    process.platform],
          ['Commands',    String(totalCmds)],
        ],
        footer: `${brand.name} — Up to date`,
      }, { quoted: m });

      const thumbnail = await getBrandThumbnail();
      return await actionCardWithAd(sock, m.from, {
        text:   `ℹ️ *${brand.name} v${brand.version}*\nCore: ${brand.core}`,
        footer: `${brand.name} • Framework Info`,
      }, [
        { label: '📊 Full System Stats', cmd: `${p}menu aiDynamic` },
        { label: '📋 About & Credits',   cmd: `${p}about` },
        { label: '🏓 Test Ping Speed',   cmd: `${p}ping` },
      ], {
        title: `${brand.name} v${brand.version}`,
        body:  `Core: ${brand.core}`,
        thumbnail,
      }, { quoted: m });
    } catch (err) {
      console.warn('[version] Tier 1 failed:', err.message);
    }

    // ── Tier 2: adReply fallback ───────────────────────────────────────────
    const text = [
      `╭─ VERSION`,
      `│ Bot: ${brand.name}`,
      `│ Developer: ${brand.creator}`,
      `│ Core: v${brand.version}`,
      `│ Runtime: Node.js ${process.version}`,
      `╰─ ${brand.signature}`,
    ].join('\n');

    const thumbnail = await getBrandThumbnail();
    await replyAdReply(m, sock, text, {
      title: `${brand.name} v${brand.version}`,
      body:  `Core: ${brand.core}`,
      thumbnail,
    });
  },
};
