/**
 * Buttons Card Menu (id: 5) — buttonsMessage format.
 *
 * This is the "grey text" card style: the body is wrapped in monospace
 * (triple backticks) so WhatsApp renders it in a muted/grey color.
 * The header uses a locationMessage with a high-quality thumbnail (300x300),
 * and the subtitle shows live time + status — exactly like the look from
 * BIGST4CK's ButtonV2 builder.
 *
 * Button types:
 *   type: 1 → quick reply (tappable pill button that runs a command)
 *   type: 1 + nativeFlowInfo → native flow list picker / single_select
 *
 * The biz/native_flow additionalNodes stanza is injected automatically
 * by baileysBridge.relayMessage() (hasNativeFlowContent checks buttonsMessage).
 */
import os from 'os';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { getGreeting } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { formatUptime } from '../../lib/utils.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

export const buttonsCardMenu = {
  id: 5,
  name: 'buttonsCard',
  description: 'Grey-text buttons card with high-quality thumbnail header, live time, and tappable pill buttons',
  supportedMessages: ['buttonsMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // ── Time & status (for the header subtitle) ───────────────────────────
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

    const cpuLoad  = os.loadavg()[0];
    const cpuCores = os.cpus().length;
    const loadPct  = (cpuLoad / cpuCores) * 100;
    const ramPct   = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    const serverStatus = loadPct > 80 || ramPct > 85 ? 'Degraded' : 'Online';

    // ── Body text: monospace wrapping = grey rendering in WhatsApp ────────
    const menuText = buildTextMenu(menuData);
    const greeting = getGreeting();
    const headerBlock =
      `${greeting}\n` +
      `${dateStr} · ${timeStr}\n` +
      `Prefix: ${menuData.prefix} · Commands: ${menuData.totalCommands}\n` +
      `─────────────────────────\n`;
    const bodyText = '```' + headerBlock + menuText + '```';

    // ── Footer: user/system stats in › style ─────────────────────────────
    const memUsage = process.memoryUsage();
    const ramMb = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
    const footerText =
      `*»* *SYSTEM*\n` +
      `  › *Status:* ${serverStatus}\n` +
      `  › *Uptime:* ${menuData.uptime}\n` +
      `  › *RAM:* ${ramMb} MB\n` +
      `  › *Commands:* ${menuData.totalCommands}\n` +
      `  › *Users:* ${menuData.users}\n` +
      `  › *Version:* v${brand.version}\n\n` +
      `${brand.name} ${brand.signature}`;

    // ── Thumbnail: high-quality brand image ───────────────────────────────
    let thumbnail = ASSET_URLS.thumbnail;
    try {
      const imgData = await imageManager.getMenuImage(5);
      if (imgData?.source?.startsWith('http')) {
        thumbnail = imgData.source;
      } else if (imgData?.buffer) {
        thumbnail = imgData.buffer;
      }
    } catch (_) {}

    // ── Buttons ───────────────────────────────────────────────────────────
    const p = menuData.prefix || '.';
    const buttons = [
      { displayText: '📋 All Commands', id: `${p}menu all`, type: 1 },
      { displayText: '🤖 System Info',  id: `${p}about`,    type: 1 },
      { displayText: '💰 Daily Reward', id: `${p}daily`,    type: 1 },
    ];

    // ── Send via buttonsMessage card ──────────────────────────────────────
    try {
      return await baileysBridge.sendButtonsCard(sock, m.from, {
        body:       bodyText,
        footer:     footerText,
        title:      brand.name,
        subtitle:   `${serverStatus} · ${timeStr}`,
        thumbnail,
        buttons,
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU buttonsCard] sendButtonsCard failed, falling back to text:', err.message);
      // Fallback: plain text with the same content
      throw err; // runWithFallback → plain text
    }
  },
};

export default buttonsCardMenu;
