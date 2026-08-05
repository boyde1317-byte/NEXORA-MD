/**
 * Buttons Card Menu (id: 5) — buttonsMessage format.
 *
 * This is the "grey text" card style: the body is wrapped in monospace
 * (triple backticks) so WhatsApp renders it in a muted/grey color.
 * The header uses a locationMessage with a high-quality thumbnail (300x300),
 * and the subtitle shows live time + status — exactly like the look from
 * BIGST4CK's ButtonV2 builder.
 *
 * Two modes:
 *   • Main menu (no args) → greeting body + system stats footer + Store + Navigation
 *   • Category menu (args) → monospace command list (grey) + simple footer + Main Menu + Navigation
 *
 * The biz/native_flow additionalNodes stanza is injected automatically
 * by baileysBridge.relayMessage() (hasNativeFlowContent checks buttonsMessage).
 */
import os from 'os';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { getGreeting } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildAboutContextInfo, resolveThumbnail } from '../../lib/waUtils.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Build the navigation single_select button (native flow list picker).
 * Opens a modal sheet with all command categories — tapping one runs
 * `.menu <category>` to show that category's commands.
 */
export function buildNavigationButton(prefix) {
  const p = prefix || '.';
  const categories = [
    { title: 'All Commands', description: 'Show all commands', id: `${p}menu all` },
    { title: 'AI',           description: 'AI chat & generation', id: `${p}menu ai` },
    { title: 'Downloader',   description: 'Media downloaders',  id: `${p}menu downloader` },
    { title: 'Tools',        description: 'Utility commands',    id: `${p}menu tools` },
    { title: 'Games',        description: 'Mini games',          id: `${p}menu games` },
    { title: 'Group',        description: 'Group management',    id: `${p}menu group` },
    { title: 'Sticker',      description: 'Sticker commands',    id: `${p}menu sticker` },
    { title: 'Owner',        description: 'Owner commands',     id: `${p}menu owner` },
    { title: 'About',        description: 'Bot info',            id: `${p}about` },
  ];
  return {
    buttonText: { displayText: '☰ Navigation' },
    buttonId: 'menu_nav',
    type: 1,
    nativeFlowInfo: {
      name: 'single_select',
      paramsJson: JSON.stringify({
        title: 'Select Category',
        sections: [{
          title: `${brand.name} Menu`,
          rows: categories,
        }],
      }),
    },
  };
}

export const buttonsCardMenu = {
  id: 5,
  name: 'buttonsCard',
  description: 'Grey-text buttons card with high-quality thumbnail header, live time, and tappable pill buttons',
  supportedMessages: ['buttonsMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // ── Time & status (for the header subtitle) ───────────────────────────
    const tz = process.env.BOT_TZ || 'Africa/Accra';
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

    const cpuLoad  = os.loadavg()[0];
    const cpuCores = os.cpus().length;
    const loadPct  = (cpuLoad / cpuCores) * 100;
    const ramPct   = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    const serverStatus = loadPct > 80 || ramPct > 85 ? 'Degraded' : 'Online';

    // ── Thumbnail: high-quality brand image ───────────────────────────────
    let imgData = null;
    try {
      imgData = await imageManager.getMenuImage(5);
    } catch (_) {}
    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);

    // ── Catalog quote (productMessage fake quote for the reply bar) ───────
    const contextInfo = buildAboutContextInfo({
      botName: brand.name,
      description: brand.description || `${brand.name} by ${brand.creator}`,
      thumbnail: imgData?.buffer,
    });

    // ── Check if this is a category-specific menu (args passed) ───────────
    const p = menuData.prefix || '.';
    const categoryArg = m.text?.split(/\s+/)?.[1]?.toLowerCase();
    const isCategoryMenu = categoryArg && categoryArg !== 'all';

    if (isCategoryMenu) {
      // ── CATEGORY MENU: monospace command list (grey text) ───────────────
      const menuText = buildTextMenu(menuData);
      const bodyText = '```' + menuText + '```';

      const footerText =
        `${brand.name} v${brand.version} · ${menuData.totalCommands} commands\n` +
        `${brand.signature}`;

      const buttons = [
        { displayText: '📋 Main Menu', id: `${p}menu`, type: 1 },
        { displayText: '📜 All Commands', id: `${p}menu all`, type: 1 },
        buildNavigationButton(p),
      ];

      return await baileysBridge.sendButtonsCard(sock, m.from, {
        body:       bodyText,
        footer:     footerText,
        title:      brand.name,
        subtitle:   `${serverStatus} · ${timeStr}`,
        thumbnail,
        buttons,
        contextInfo,
      }, { quoted: m });

    } else {
      // ── MAIN MENU: greeting body + system stats footer ─────────────────
      const greeting = getGreeting();
      const senderNumber = m.senderNumber || m.sender?.split('@')[0] || '';

      // Body: greeting + date/time (regular text, NOT monospace — like BIGST4CK)
      const bodyText =
        `${greeting}, @${senderNumber}\n` +
        `${dateStr} · ${timeStr}`;

      // Footer: system stats with bold labels and progress bars (› style)
      const memUsage = process.memoryUsage();
      const ramMb = (memUsage.heapUsed / 1024 / 1024).toFixed(1);
      const totalMem = os.totalmem();
      const usedMem = totalMem - os.freemem();
      const fmtRAM = (b) => {
        const mb = b / 1024 / 1024;
        return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
      };

      const createBar = (percent, maxBlocks = 8) => {
        const filled = Math.round((percent / 100) * maxBlocks);
        return '█'.repeat(filled) + '░'.repeat(maxBlocks - filled);
      };

      const footerText =
        `*»* *USER*\n` +
        `  › *Status:* ${m.isOwner ? 'Owner' : 'User'}\n` +
        `  › *Prefix:* ${p}\n\n` +
        `*»* *SYSTEM*\n` +
        `  › *Status:* ${serverStatus}\n` +
        `  › *Uptime:* ${menuData.uptime}\n` +
        `  › *RAM:* ${fmtRAM(usedMem)}/${fmtRAM(totalMem)} ${createBar(ramPct, 8)}\n` +
        `  › *CPU:* ${createBar(Math.min(loadPct, 100), 10)} ${Math.round(loadPct)}%\n` +
        `  › *Commands:* ${menuData.totalCommands}\n` +
        `  › *Users:* ${menuData.users}\n` +
        `  › *Groups:* ${menuData.groups}\n` +
        `  › *Version:* v${brand.version}\n\n` +
        `${brand.name} ${brand.signature}`;

      // Buttons: Store/quick action + Navigation single_select
      const buttons = [
        { displayText: '📋 All Commands', id: `${p}menu all`, type: 1 },
        { displayText: '🤖 System Info',  id: `${p}about`,    type: 1 },
        buildNavigationButton(p),
      ];

      // Add mentionedJid for the @sender mention in body
      const contextInfoWithMention = buildAboutContextInfo({
        botName: brand.name,
        description: brand.description || `${brand.name} by ${brand.creator}`,
        thumbnail: imgData?.buffer,
        mentionedJid: m.sender ? [m.sender] : [],
      });

      return await baileysBridge.sendButtonsCard(sock, m.from, {
        body:       bodyText,
        footer:     footerText,
        title:      brand.name,
        subtitle:   `${serverStatus} · ${timeStr}`,
        thumbnail,
        buttons,
        contextInfo: contextInfoWithMention,
      }, { quoted: m });
    }
  },
};

export default buttonsCardMenu;
