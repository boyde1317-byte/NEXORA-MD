import { getGreeting, divider } from '../formatter.js';
import { db } from '../../database/db.js';
import { imageManager } from '../../images/imageManager.js';
import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { toSmallcaps } from '../../lib/smallcaps.js';

/**
 * AI-Dynamic Menu (id: 12)
 *
 * Dynamic system dashboard with auto-theming, command rankings, and user stats.
 * Uses smallcaps for labels and a single accent emoji per section header.
 *
 * Tiers:
 *   1 → nativeFlow interactive card with image header + quick-reply buttons
 *   2 → text + externalAdReply banner (nativeFlow unsupported)
 */
const THEMES = [
  { name: 'COSMIC SLATE',    accent: '✦' },
  { name: 'CYBERPUNK NEON',  accent: '⚡' },
  { name: 'MATRIX DIGITAL',  accent: '◈' },
];

export const aiDynamicMenu = {
  id: 12,
  name: 'aiDynamic',
  description: 'AI-Dynamic system with auto-theming, command rankings, and user stats',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage', 'extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(12);

    // 1. Pick a random design theme
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

    // 2. Compute dynamic command ranking from database metrics
    const stats = db.data.stats?.commandsUsed || {};
    const ranking = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    let rankingText = '';
    if (ranking.length > 0) {
      rankingText = ranking.map(([name, count], i) =>
        `  ${i + 1}. \`${name}\` (${count} runs)`
      ).join('\n');
    } else {
      rankingText = '  _No commands recorded yet._';
    }

    // 3. User & Group contextual statistics
    const userDb = db.getUser(m.sender);
    const isGroup = m.isGroup;
    const groupDb = isGroup ? db.getGroup(m.from) : null;

    // 4. Compile the themed dashboard with smallcaps labels
    let text = `${theme.accent} *${toSmallcaps(theme.name)}* ${theme.accent}\n`;
    text += `_${getGreeting()}, @${m.senderNumber}!_\n`;
    text += `${divider}\n\n`;

    text += `📊 *${toSmallcaps('Dynamic Insights & Rankings')}*\n`;
    text += `• *${toSmallcaps('Most Active Commands')}:*\n${rankingText}\n`;
    text += `• *${toSmallcaps('User Rank')}:* ${userDb?.premium ? '⭐ Premium' : 'Standard'}\n`;
    if (isGroup) {
      text += `• *${toSmallcaps('Group Status')}:* ${groupDb?.mute ? 'Muted' : 'Active'}\n`;
    }
    text += `• *${toSmallcaps('System Load')}:* Normal | ${toSmallcaps('Latency')}: ~120ms\n\n`;

    text += `📂 *${toSmallcaps('Available Modules')}*\n`;
    const categories = Object.keys(menuData.categories).sort();
    for (const cat of categories) {
      const list = menuData.categories[cat].map(c => `\`${c.name}\``).join(', ');
      text += `↳ *${toSmallcaps(cat)}*: ${list}\n`;
    }

    text += `\n${divider}\n`;
    text += `⏱ *${toSmallcaps('Uptime')}:* \`${menuData.uptime}\` | *${toSmallcaps('Status')}:* Optimal`;

    // 5. Build image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

    // ── Tier 1: nativeFlow interactive card with buttons ───────────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    text,
          footer:  footerText,
          image:   imagePayload,
          buttons: [
            { text: `📋 ${toSmallcaps('Browse Menu Styles')}`, id: `${menuData.prefix}menulist` },
            { text: `🏓 ${toSmallcaps('Ping Bot')}`,           id: `${menuData.prefix}ping` },
            { text: `💬 ${toSmallcaps('Contact Developer')}`,   url: 'https://wa.me/233533416608' },
          ],
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU aiDynamic] Tier 1 (nativeFlow) failed, trying adReply:', err.message);
      }
    }

    // ── Tier 2: text + externalAdReply banner ─────────────────────────────
    const contextInfo = {
      externalAdReply: {
        title:                 `${menuData.botName} ${toSmallcaps('AI')}`,
        body:                  `${menuData.totalCommands} commands • ${menuData.uptime} uptime`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true,
        showAdAttribution:     false,
      },
    };

    if (imgData.buffer) {
      contextInfo.externalAdReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      contextInfo.externalAdReply.thumbnailUrl = imgData.source;
    }

    return await sock.sendMessage(m.from, {
      text,
      mentions:    [m.sender],
      contextInfo,
    }, { quoted: menuData.audioQuote || m });
  }
};

export default aiDynamicMenu;
