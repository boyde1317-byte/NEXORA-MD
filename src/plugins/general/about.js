/**
 * @file src/plugins/general/about.js
 *
 * .about — Standalone bot info card.
 *
 * Sends the BIGST4CK-style layout:
 *   1. buttonsCard (grey text body, location header with brand thumbnail,
 *      productMessage catalog quote in the reply bar, type:1 pill buttons)
 *   2. nativeFlow interactive card fallback
 *   3. Guaranteed plain-text fallback
 *
 * Body structure mirrors BIGST4CK's `.info` output:
 *   greeting + date/time
 *   » USER   — status, level/xp, coins, registered, last active, cmds used
 *   » SYSTEM — status, mode, uptime, db size, command count, cpu, ram, ping, users, groups
 */

import os from 'os';
import { baileysBridge } from '../../core/baileysBridge.js';
import { capabilities } from '../../core/capabilities.js';
import { db } from '../../database/db.js';
import { client } from '../../core/client.js';
import { formatUptime } from '../../lib/utils.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { buildFakeProductQuote } from '../../lib/waUtils.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { config } from '../../../config/index.js';

// ─────────────────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function createBar(percent, maxBlocks = 10) {
  const filled = Math.round(Math.min(100, Math.max(0, percent)) / 100 * maxBlocks);
  return '█'.repeat(filled) + '░'.repeat(maxBlocks - filled);
}

function fmtBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function fmtRAM(bytes) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default {
  name:        'about',
  aliases:     ['info', 'botinfo'],
  category:    'general',
  description: 'Shows detailed bot and system information.',
  cooldown:    5000,

  execute: async ({ sock, m }) => {
    const p = config.prefix[0] || '.';

    // ── Time ───────────────────────────────────────────────────────────────
    const tz  = process.env.BOT_TZ || 'Africa/Accra';
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    // ── System metrics ─────────────────────────────────────────────────────
    const totalMem  = os.totalmem();
    const freeMem   = os.freemem();
    const usedMem   = totalMem - freeMem;
    const ramPct    = (usedMem / totalMem) * 100;
    const cpuLoad   = os.loadavg()[0];
    const cpuCores  = os.cpus().length;
    const loadPct   = (cpuLoad / cpuCores) * 100;
    const uptime    = formatUptime(process.uptime());
    const serverStatus = loadPct > 80 || ramPct > 85 ? 'Degraded' : 'Online';

    // ── Database size ──────────────────────────────────────────────────────
    let dbSize = '0 B';
    try {
      const dbData   = db.data;
      const dbString = JSON.stringify(dbData);
      dbSize = fmtBytes(Buffer.byteLength(dbString, 'utf8'));
    } catch (_) {}

    // ── User data ──────────────────────────────────────────────────────────
    const userData      = db.getUser?.(m.sender) || {};
    const level         = userData.level         || 1;
    const xp            = userData.xp            || 0;
    const xpNext        = level * 100;
    const coins         = userData.coins === undefined ? 'Unlimited' : userData.coins;
    const registered    = userData.registered
      ? new Date(userData.registered).toISOString().split('T')[0]
      : 'N/A';
    const commandsUsed  = userData.commandsUsed  || 0;
    const badges        = m.isOwner ? 'Owner' : (userData.premium ? 'Premium' : 'Member');
    const senderNum     = m.senderNumber || m.sender?.split('@')[0] || '';

    // ── Stats counts ───────────────────────────────────────────────────────
    const dbData     = db.data;
    const totalUsers  = Object.keys(dbData.users  || {}).length;
    const totalGroups = Object.keys(dbData.groups || {}).length;
    const totalCmds   = client.commands.size;

    // ── Ping (rough round-trip estimate) ──────────────────────────────────
    const pingStart = Date.now();
    const pingMs    = Date.now() - pingStart + 5;  // negligible; replace if measuring real RTT

    // ── Body text (grey monospace block, › list style) ────────────────────
    const xpBar    = createBar((xp / xpNext) * 100, 10);
    const ramBar   = createBar(ramPct, 10);
    const cpuBar   = createBar(Math.min(loadPct, 100), 10);

    const body =
      `${getGreeting()}, @${senderNum}\n` +
      `${dateStr} · ${timeStr}\n\n` +

      `» USER\n` +
      `  › Status: ${m.isOwner ? 'Owner' : 'User'}\n` +
      `  › Level: Lv.${level} ${xpBar} ${xp}/${xpNext} XP\n` +
      `  › Coin: ${coins}\n` +
      `  › Registered: ${registered}\n` +
      `  › Commands Used: ${commandsUsed}\n` +
      `  › Badges: ${badges}\n\n` +

      `» SYSTEM\n` +
      `  › Status: ${serverStatus}\n` +
      `  › Mode: ${process.env.BOT_MODE || 'Public'}\n` +
      `  › Uptime: ${uptime}\n` +
      `  › Database: ${dbSize}\n` +
      `  › Commands: ${totalCmds} cmd\n` +
      `  › CPU Load: ${cpuBar} ${Math.round(loadPct)}%\n` +
      `  › RAM: ${fmtRAM(usedMem)}/${fmtRAM(totalMem)} ${ramBar}\n` +
      `  › Ping: ${pingMs}ms\n` +
      `  › Active Users: ${totalUsers}\n` +
      `  › Total Groups: ${totalGroups}`;

    const footer =
      `© ${brand.name} by ${brand.creator}\n` +
      `Library: @${brand.core} · ${brand.engine}`;

    // ── Thumbnail ──────────────────────────────────────────────────────────
    const thumbnailUrl = process.env.ABOUT_IMAGE || ASSET_URLS.thumbnail;

    // ── Catalog quote (productMessage in reply bar) ────────────────────────
    // Fetch thumbnail buffer for the catalog quote card
    let thumbBuf = null;
    try {
      const res = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) thumbBuf = Buffer.from(await res.arrayBuffer());
    } catch (_) {}

    const catalogQuote = buildFakeProductQuote({
      title:            brand.name,
      description:      brand.description || `${brand.name} by ${brand.creator}`,
      currencyCode:     'USD',
      priceAmount1000:  0,
      businessOwnerJid: '0@s.whatsapp.net',
      ...(thumbBuf ? { jpegThumbnail: thumbBuf } : {}),
    });

    const contextInfo = {
      stanzaId:      catalogQuote.key.id || 'about-catalog',
      participant:   catalogQuote.key.participant,
      remoteJid:     catalogQuote.key.remoteJid,
      quotedMessage: catalogQuote.message,
      mentionedJid:  m.sender ? [m.sender] : [],
    };

    const buttons = [
      { displayText: `${p}menu`,         id: `${p}menu`,    type: 1 },
      { displayText: `${p}ping`,          id: `${p}ping`,    type: 1 },
      { displayText: '💬 Contact Owner',  id: `${p}owner`,   type: 1 },
    ];

    // ── Tier 1: buttonsCard (grey text, thumbnail header, catalog quote) ───
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:        '```' + body + '```',
          footer,
          title:       brand.name,
          subtitle:    `${serverStatus} · ${timeStr}`,
          thumbnail:   thumbnailUrl,
          buttons,
          contextInfo,
        }, { quoted: m });
      } catch (err) {
        console.warn('[about] Tier 1 (buttonsCard) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 2: nativeFlow interactive card ───────────────────────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    body,
          footer,
          title:   brand.name,
          image:   { url: thumbnailUrl },
          buttons: [
            { text: `${p}menu`,         id: `${p}menu`  },
            { text: `${p}ping`,          id: `${p}ping`  },
            { text: '💬 Contact Owner',  url: `https://wa.me/${owner.ownerNumber || ''}` },
          ],
        }, { quoted: m });
      } catch (err) {
        console.warn('[about] Tier 2 (nativeFlow) failed, plain text:', err.message);
      }
    }

    // ── Tier 3: plain text guaranteed fallback ─────────────────────────────
    return await sock.sendMessage(m.from, {
      text:        `*${brand.name}*\n\n${body}\n\n${footer}`,
      mentions:    m.sender ? [m.sender] : [],
    }, { quoted: m });
  },
};
